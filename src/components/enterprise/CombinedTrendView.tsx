import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail, Loader2, FileSpreadsheet } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataCoverageBadge } from "./DataCoverageBadge";

type TrendViewMode = "monthly" | "quarterly";

interface CombinedTrendViewProps {
  storeIds: string[];
  selectedDepartmentNames: string[];
  selectedKpiMetrics: string[];
  selectedFinancialMetrics: string[];
  startMonth: string;
  endMonth: string;
  brandDisplayName: string;
  filterName: string;
  onBack: () => void;
}

export function CombinedTrendView({
  storeIds,
  selectedDepartmentNames,
  selectedKpiMetrics,
  selectedFinancialMetrics,
  startMonth,
  endMonth,
  brandDisplayName,
  filterName,
  onBack,
}: CombinedTrendViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFormat, setEmailFormat] = useState<"html" | "excel">("html");
  const [trendViewMode, setTrendViewMode] = useState<TrendViewMode>("monthly");

  // Generate list of months in range
  const months = useMemo(() => {
    const result: string[] = [];
    let current = new Date(startMonth + '-15');
    const end = new Date(endMonth + '-15');
    
    while (current <= end) {
      result.push(format(current, 'yyyy-MM'));
      current = new Date(current.setMonth(current.getMonth() + 1));
    }
    
    return result;
  }, [startMonth, endMonth]);

  // Group months by quarter
  const quarterlyMonths = useMemo(() => {
    const quarters: Record<string, string[]> = {};
    months.forEach(month => {
      const date = new Date(month + '-15');
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const quarterKey = `Q${quarter} ${year}`;
      if (!quarters[quarterKey]) {
        quarters[quarterKey] = [];
      }
      quarters[quarterKey].push(month);
    });
    return quarters;
  }, [months]);

  // Fetch recipients (super_admins and store GMs)
  const { data: recipients = [], isLoading: loadingRecipients } = useQuery({
    queryKey: ["combined_trend_recipients", storeIds],
    queryFn: async () => {
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];

      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");
      const gmIds = gmRoles?.map(r => r.user_id) || [];

      const allUserIds = [...new Set([...superAdminIds, ...gmIds])];
      if (allUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, store_id, stores(name)")
        .in("id", allUserIds);

      return (profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        store_name: (p as any).stores?.name,
      }));
    },
    enabled: emailDialogOpen,
  });

  // Fetch stores info
  const { data: stores } = useQuery({
    queryKey: ["combined_trend_stores", storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, brand, brands(name)")
        .in("id", storeIds);
      if (error) throw error;
      return data;
    },
    enabled: storeIds.length > 0,
  });

  // Fetch all departments for stores
  const { data: departments } = useQuery({
    queryKey: ["combined_trend_departments", storeIds, selectedDepartmentNames],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, store_id")
        .in("store_id", storeIds);
      if (error) throw error;
      
      // Handle Fixed Combined - include both Parts and Service
      const expandedNames = selectedDepartmentNames.flatMap(name => {
        if (name === 'Fixed Combined') {
          return data?.filter(d => 
            d.name.toLowerCase().includes('parts') || 
            d.name.toLowerCase().includes('service')
          ).map(d => d.name) || [];
        }
        return [name];
      });
      
      if (expandedNames.length > 0) {
        return data?.filter(d => expandedNames.includes(d.name)) || [];
      }
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const departmentIds = useMemo(() => {
    return departments?.map(d => d.id) || [];
  }, [departments]);

  // Fetch KPI definitions
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["combined_trend_kpi_definitions", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*, departments(id, name, store_id)")
        .in("department_id", departmentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0,
  });

  const kpiIds = useMemo(() => {
    return kpiDefinitions?.map(k => k.id) || [];
  }, [kpiDefinitions]);

  // Fetch scorecard entries for the date range (monthly KPIs)
  const { data: scorecardEntries, isLoading: loadingKpis } = useQuery({
    queryKey: ["combined_trend_kpi_entries", kpiIds, startMonth, endMonth],
    queryFn: async () => {
      if (kpiIds.length === 0) return [];
      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "monthly")
        .gte("month", startMonth)
        .lte("month", endMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: kpiIds.length > 0,
  });

  // Fetch financial entries for date range
  const { data: financialEntries, isLoading: loadingFinancial } = useQuery({
    queryKey: ["combined_trend_financial", departmentIds, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id)")
        .in("department_id", departmentIds)
        .gte("month", startMonth)
        .lte("month", endMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0,
  });

  const isLoading = loadingKpis || loadingFinancial;

  // Get KPI types for formatting
  const kpiTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    kpiDefinitions?.forEach(kpi => {
      map.set(kpi.name, kpi.metric_type);
    });
    return map;
  }, [kpiDefinitions]);

  // Build financial metric mapping (including support for sub-metrics)
  const financialMetricDefs = useMemo(() => {
    const allMetrics = getMetricsForBrand(null);
    const nameToKey = new Map<string, string>();
    const keyToName = new Map<string, string>();
    const keyToDef = new Map<string, any>();
    
    allMetrics.forEach((m: any) => {
      nameToKey.set(m.name, m.key);
      keyToName.set(m.key, m.name);
      keyToDef.set(m.key, m);
    });
    
    return { nameToKey, keyToName, keyToDef, allMetrics };
  }, []);

  // Parse sub-metric key to get lookup pattern
  const parseSubMetricKey = (metricName: string): { isSubMetric: boolean; parentKey: string; subName: string } | null => {
    // Sub-metrics are named like "↳ SubMetricName"
    if (metricName.startsWith('↳ ')) {
      // This means it's a sub-metric, but we need to find the actual key from selectedFinancialMetrics
      return null; // Will be handled by direct lookup
    }
    return null;
  };

  // Get the metric key for lookup - handles both regular metrics and sub-metrics
  const getMetricLookupKey = (metricName: string, monthData: Map<string, number>): string | null => {
    const { nameToKey } = financialMetricDefs;
    
    // Check if it's a sub-metric (starts with arrow)
    if (metricName.startsWith('↳ ')) {
      const subName = metricName.substring(2); // Remove "↳ "
      
      // Find matching sub-metric entry in the month data
      // Sub-metrics are stored as "sub:parentKey:order:subName"
      for (const [key] of monthData) {
        if (key.startsWith('sub:')) {
          const parts = key.split(':');
          if (parts.length >= 4) {
            const storedName = parts.slice(3).join(':');
            if (storedName === subName) {
              return key; // Return the full sub-metric key
            }
          }
        }
      }
      return null;
    }
    
    // Regular metric - use name to key mapping
    return nameToKey.get(metricName) || null;
  };

  // Process KPI data
  const kpiData = useMemo(() => {
    if (!scorecardEntries || !stores || !departments || !kpiDefinitions) return {};
    
    const kpiToStore = new Map<string, string>();
    const kpiToName = new Map<string, string>();
    
    kpiDefinitions.forEach(kpi => {
      const dept = departments.find(d => d.id === kpi.department_id);
      if (dept) {
        kpiToStore.set(kpi.id, dept.store_id);
      }
      kpiToName.set(kpi.id, kpi.name);
    });

    const storeMonthData: Record<string, Record<string, Map<string, number | null>>> = {};
    
    stores.forEach(store => {
      storeMonthData[store.id] = {};
      months.forEach(month => {
        storeMonthData[store.id][month] = new Map();
      });
    });

    scorecardEntries.forEach(entry => {
      const storeId = kpiToStore.get(entry.kpi_id);
      const kpiName = kpiToName.get(entry.kpi_id);
      if (!storeId || !kpiName || !storeMonthData[storeId]) return;
      
      const month = entry.month;
      if (!month || !storeMonthData[storeId][month]) return;
      
      storeMonthData[storeId][month].set(kpiName, entry.actual_value);
    });

    return storeMonthData;
  }, [scorecardEntries, stores, departments, kpiDefinitions, months]);

  // Process financial data
  const financialData = useMemo(() => {
    if (!financialEntries || !stores || !departments) return {};
    
    const storeMonthData: Record<string, Record<string, Map<string, number>>> = {};
    
    stores.forEach(store => {
      storeMonthData[store.id] = {};
      months.forEach(month => {
        storeMonthData[store.id][month] = new Map();
      });
    });

    // Aggregate entries
    financialEntries.forEach(entry => {
      const storeId = (entry as any)?.departments?.store_id;
      if (!storeId || !storeMonthData[storeId]) return;
      
      const month = entry.month;
      if (!storeMonthData[storeId][month]) return;
      
      const currentValue = storeMonthData[storeId][month].get(entry.metric_name) || 0;
      storeMonthData[storeId][month].set(entry.metric_name, currentValue + (entry.value || 0));
    });

    // Calculate derived metrics using store-specific brand
    const calculateDerivedMetric = (storeMetrics: Map<string, number>, metricDef: any): number => {
      if (!metricDef.calculation) return storeMetrics.get(metricDef.key) || 0;
      
      const calc = metricDef.calculation;
      
      if ('numerator' in calc && 'denominator' in calc) {
        const num = storeMetrics.get(calc.numerator) || 0;
        const denom = storeMetrics.get(calc.denominator) || 0;
        return denom !== 0 ? (num / denom) * 100 : 0;
      }
      
      if (calc.type === 'subtract') {
        let value = storeMetrics.get(calc.base) || 0;
        (calc.deductions || []).forEach((d: string) => {
          value -= storeMetrics.get(d) || 0;
        });
        return value;
      }
      
      if (calc.type === 'complex') {
        let value = storeMetrics.get(calc.base) || 0;
        (calc.deductions || []).forEach((d: string) => {
          value -= storeMetrics.get(d) || 0;
        });
        (calc.additions || []).forEach((a: string) => {
          value += storeMetrics.get(a) || 0;
        });
        return value;
      }
      
      return storeMetrics.get(metricDef.key) || 0;
    };

    stores.forEach(store => {
      // Use store-specific brand metrics for calculations
      const storeBrand = store.brand || (store as any).brands?.name || null;
      const storeMetrics = getMetricsForBrand(storeBrand);
      
      months.forEach(month => {
        const monthData = storeMonthData[store.id][month];
        
        storeMetrics.forEach((metricDef: any) => {
          if (metricDef.type === 'dollar' && metricDef.calculation) {
            const calculated = calculateDerivedMetric(monthData, metricDef);
            monthData.set(metricDef.key, calculated);
          }
        });
        
        storeMetrics.forEach((metricDef: any) => {
          if (metricDef.type === 'percentage') {
            const calculated = calculateDerivedMetric(monthData, metricDef);
            monthData.set(metricDef.key, calculated);
          }
        });
      });
    });

    return storeMonthData;
  }, [financialEntries, stores, departments, months]);

  // Calculate quarterly weighted averages
  const quarterlyData = useMemo(() => {
    if (!stores) return {};
    
    const result: Record<string, {
      kpiQuarters: Record<string, Record<string, { value: number | null; weight: number }>>;
      financialQuarters: Record<string, Record<string, { value: number | null; weight: number }>>;
    }> = {};

    stores.forEach(store => {
      result[store.id] = { kpiQuarters: {}, financialQuarters: {} };
      
      Object.entries(quarterlyMonths).forEach(([quarter, monthList]) => {
        // KPI quarterly calculation - weighted by Total Hours
        const kpiQuarterData: Record<string, { value: number | null; weight: number }> = {};
        let totalHoursForQuarter = 0;
        
        // First pass: calculate total hours for the quarter
        monthList.forEach(month => {
          const kpiMonthData = kpiData[store.id]?.[month];
          const totalHours = kpiMonthData?.get('Total Hours') || 0;
          totalHoursForQuarter += totalHours;
        });
        
        // Calculate weighted averages for KPI metrics
        selectedKpiMetrics.forEach(metricName => {
          let weightedSum = 0;
          let totalWeight = 0;
          
          monthList.forEach(month => {
            const kpiMonthData = kpiData[store.id]?.[month];
            const value = kpiMonthData?.get(metricName);
            const hours = kpiMonthData?.get('Total Hours') || 0;
            
            if (value !== null && value !== undefined) {
              weightedSum += value * hours;
              totalWeight += hours;
            }
          });
          
          kpiQuarterData[metricName] = {
            value: totalWeight > 0 ? weightedSum / totalWeight : null,
            weight: totalWeight,
          };
        });
        
        result[store.id].kpiQuarters[quarter] = kpiQuarterData;
        
        // Financial quarterly calculation - weighted by Total Sales
        const financialQuarterData: Record<string, { value: number | null; weight: number }> = {};
        let totalSalesForQuarter = 0;
        
        const { nameToKey } = financialMetricDefs;
        
        // First pass: calculate total sales for the quarter
        monthList.forEach(month => {
          const finMonthData = financialData[store.id]?.[month];
          const totalSales = finMonthData?.get('total_sales') || 0;
          totalSalesForQuarter += totalSales;
        });
        
        // Calculate weighted averages for financial metrics
        selectedFinancialMetrics.forEach(metricName => {
          const isSubMetric = metricName.startsWith('↳ ');
          let metricKey: string | null = null;
          
          // For sub-metrics, we need to find the key dynamically
          if (isSubMetric) {
            // Try to find the sub-metric key from any month's data
            for (const month of monthList) {
              const finMonthData = financialData[store.id]?.[month];
              if (finMonthData) {
                metricKey = getMetricLookupKey(metricName, finMonthData);
                if (metricKey) break;
              }
            }
          } else {
            metricKey = nameToKey.get(metricName) || null;
          }
          
          if (!metricKey) {
            financialQuarterData[metricName] = { value: null, weight: 0 };
            return;
          }
          
          let weightedSum = 0;
          let totalWeight = 0;
          // Sub-metrics are typically dollar amounts, not percentages
          let isPercentage = !isSubMetric && financialMetricDefs.keyToDef.get(metricKey)?.type === 'percentage';
          
          monthList.forEach(month => {
            const finMonthData = financialData[store.id]?.[month];
            // For sub-metrics, look up the value using the dynamic key finder
            const lookupKey = isSubMetric ? getMetricLookupKey(metricName, finMonthData || new Map()) : metricKey;
            const value = lookupKey ? finMonthData?.get(lookupKey) : undefined;
            const sales = finMonthData?.get('total_sales') || 0;
            
            if (value !== undefined) {
              if (isPercentage) {
                // For percentages, weight by sales
                weightedSum += value * sales;
                totalWeight += sales;
              } else {
                // For dollar amounts, sum directly
                weightedSum += value;
                totalWeight = 1; // Just use sum, not average
              }
            }
          });
          
          financialQuarterData[metricName] = {
            value: isPercentage 
              ? (totalWeight > 0 ? weightedSum / totalWeight : null)
              : weightedSum,
            weight: totalWeight,
          };
        });
        
        result[store.id].financialQuarters[quarter] = financialQuarterData;
      });
    });

    return result;
  }, [stores, quarterlyMonths, kpiData, financialData, selectedKpiMetrics, selectedFinancialMetrics, financialMetricDefs, getMetricLookupKey]);

  const formatKpiValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";

    const metricType = kpiTypeMap.get(metricName);

    if (metricType === "percentage") {
      return `${value.toFixed(1)}%`;
    }

    if (metricType === "dollar" || metricType === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatFinancialValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";
    
    // Sub-metrics (starting with ↳) are always dollar amounts
    if (metricName.startsWith('↳ ')) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    
    const metrics = getMetricsForBrand(null);
    const metricDef = metrics.find((m: any) => m.name === metricName);
    
    if (metricDef?.type === "percentage" || metricName.includes("%")) {
      return `${value.toFixed(1)}%`;
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonthHeader = (month: string) => {
    return format(new Date(month + '-15'), 'MMM yy');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSendEmail = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSendingEmail(true);
    try {
      const recipientEmails = recipients
        .filter(r => selectedRecipients.includes(r.id))
        .map(r => r.email);

      const { data, error } = await supabase.functions.invoke("send-combined-trend-email", {
        body: {
          recipientEmails,
          stores: stores?.map(s => ({ id: s.id, name: s.name })) || [],
          months,
          quarters: Object.keys(quarterlyMonths),
          selectedKpiMetrics,
          selectedFinancialMetrics,
          quarterlyData,
          startMonth,
          endMonth,
          brandDisplayName,
          filterName,
          format: emailFormat,
          kpiTypeMap: Object.fromEntries(kpiTypeMap),
          departmentNames: selectedDepartmentNames,
        },
      });

      if (error) throw error;

      toast.success(`Report sent to ${recipientEmails.length} recipient(s)`);
      setEmailDialogOpen(false);
      setSelectedRecipients([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const storeEntries = stores?.filter(s => storeIds.includes(s.id)) || [];
  const quarters = Object.keys(quarterlyMonths);

  return (
    <>
      {/* Screen header - hidden when printing */}
      <div className="print:hidden">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">
              {filterName || "Combined Monthly Trend Report"}
            </h2>
            <p className="text-muted-foreground">
              <span className="font-medium">{brandDisplayName}</span>
              {" • "}{selectedDepartmentNames.join(", ")}
              {" • "}{storeEntries.length} store{storeEntries.length !== 1 ? 's' : ''}
              {" • "}{format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {trendViewMode === "quarterly" 
                ? "KPI metrics weighted by Total Hours • Financial metrics weighted by Total Sales"
                : "Monthly breakdown view"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={trendViewMode} onValueChange={(v) => setTrendViewMode(v as TrendViewMode)}>
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => setEmailDialogOpen(true)} variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              Email Report
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report content - print-friendly */}
      <div ref={printRef} className="print:p-0">
        <div className="space-y-8 print:space-y-4">
          {/* Print header - only shown when printing */}
          <div className="hidden print:block print:mb-4">
            <h1 className="text-2xl font-bold text-black">
              {filterName || "Combined Monthly Trend Report"}
            </h1>
            <p className="text-sm text-gray-600">
              {brandDisplayName} • {selectedDepartmentNames.join(", ")} • {format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
            </p>
            <p className="text-xs text-gray-500">
              KPI metrics weighted by Total Hours • Financial metrics weighted by Total Sales
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : storeEntries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-lg font-semibold text-muted-foreground">No data available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  There are no entries for the selected stores and date range.
                </p>
                <Button onClick={onBack} variant="outline" className="mt-4">
                  Back to Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            storeEntries.map(store => {
              // Calculate months with data for this store (check both KPI and financial data)
              const monthsWithData = months.filter(month => {
                const hasKpiData = selectedKpiMetrics.some(metricName => {
                  const value = kpiData[store.id]?.[month]?.get(metricName);
                  return value !== null && value !== undefined;
                });
                const hasFinancialData = selectedFinancialMetrics.some(metricName => {
                  const { nameToKey } = financialMetricDefs;
                  const monthData = financialData[store.id]?.[month];
                  if (!monthData) return false;
                  const metricKey = getMetricLookupKey(metricName, monthData);
                  return metricKey && monthData.get(metricKey) !== undefined;
                });
                return hasKpiData || hasFinancialData;
              }).length;
              
              return (
              <Card key={store.id} className="print:shadow-none print:border print:break-inside-avoid">
                <CardHeader className="print:py-2">
                  <CardTitle className="text-xl print:text-lg flex items-center">
                    <span>{store.name} {selectedDepartmentNames.length > 0 && `- ${selectedDepartmentNames.join(", ")}`}</span>
                    <DataCoverageBadge monthsWithData={monthsWithData} totalMonths={months.length} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="print:p-2 space-y-6">
                  {/* KPI Metrics Section */}
                  {selectedKpiMetrics.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-primary">
                        KPI Scorecard Metrics
                        {trendViewMode === "quarterly" && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">(Weighted by Total Hours)</span>
                        )}
                      </h3>
                      <div className="overflow-x-auto">
                        <Table className="print:text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] print:bg-gray-100 print:font-bold">
                                KPI
                              </TableHead>
                              {trendViewMode === "monthly" ? (
                                months.map(month => (
                                  <TableHead key={month} className="text-center min-w-[80px] print:bg-gray-100 print:font-bold">
                                    {formatMonthHeader(month)}
                                  </TableHead>
                                ))
                              ) : (
                                quarters.map(quarter => (
                                  <TableHead key={quarter} className="text-center min-w-[100px] print:bg-gray-100 print:font-bold">
                                    {quarter}
                                  </TableHead>
                                ))
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedKpiMetrics.map(metricName => (
                              <TableRow key={metricName} className="print:border-b print:border-gray-300">
                                <TableCell className="font-medium sticky left-0 bg-background z-10 print:bg-white">
                                  {metricName}
                                </TableCell>
                                {trendViewMode === "monthly" ? (
                                  months.map(month => {
                                    const value = kpiData[store.id]?.[month]?.get(metricName) ?? null;
                                    return (
                                      <TableCell key={month} className="text-center">
                                        {formatKpiValue(value, metricName)}
                                      </TableCell>
                                    );
                                  })
                                ) : (
                                  quarters.map(quarter => {
                                    const data = quarterlyData[store.id]?.kpiQuarters[quarter]?.[metricName];
                                    return (
                                      <TableCell key={quarter} className="text-center">
                                        {formatKpiValue(data?.value ?? null, metricName)}
                                      </TableCell>
                                    );
                                  })
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Financial Metrics Section */}
                  {selectedFinancialMetrics.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-primary">
                        Financial Summary Metrics
                        {trendViewMode === "quarterly" && (
                          <span className="text-xs font-normal text-muted-foreground ml-2">(Weighted by Total Sales)</span>
                        )}
                      </h3>
                      <div className="overflow-x-auto">
                        <Table className="print:text-xs">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] print:bg-gray-100 print:font-bold">
                                Metric
                              </TableHead>
                              {trendViewMode === "monthly" ? (
                                months.map(month => (
                                  <TableHead key={month} className="text-center min-w-[80px] print:bg-gray-100 print:font-bold">
                                    {formatMonthHeader(month)}
                                  </TableHead>
                                ))
                              ) : (
                                quarters.map(quarter => (
                                  <TableHead key={quarter} className="text-center min-w-[100px] print:bg-gray-100 print:font-bold">
                                    {quarter}
                                  </TableHead>
                                ))
                              )}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedFinancialMetrics.map(metricName => {
                              const isSubMetric = metricName.startsWith('↳ ');
                              
                              return (
                                <TableRow key={metricName} className={`print:border-b print:border-gray-300 ${isSubMetric ? 'bg-muted/50' : ''}`}>
                                  <TableCell className={`font-medium sticky left-0 z-10 print:bg-white ${isSubMetric ? 'bg-muted pl-6 text-muted-foreground' : 'bg-background'}`}>
                                    {metricName}
                                  </TableCell>
                                  {trendViewMode === "monthly" ? (
                                    months.map(month => {
                                      const monthData = financialData[store.id]?.[month];
                                      const metricKey = monthData ? getMetricLookupKey(metricName, monthData) : null;
                                      const value = metricKey ? monthData?.get(metricKey) ?? null : null;
                                      return (
                                        <TableCell key={month} className="text-center">
                                          {formatFinancialValue(value, metricName)}
                                        </TableCell>
                                      );
                                    })
                                  ) : (
                                    quarters.map(quarter => {
                                      const data = quarterlyData[store.id]?.financialQuarters[quarter]?.[metricName];
                                      return (
                                        <TableCell key={quarter} className="text-center">
                                          {formatFinancialValue(data?.value ?? null, metricName)}
                                        </TableCell>
                                      );
                                    })
                                  )}
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )})
          )}
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Combined Trend Report</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Email Format</Label>
              <RadioGroup
                value={emailFormat}
                onValueChange={(v) => setEmailFormat(v as "html" | "excel")}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="html" id="html" />
                  <Label htmlFor="html" className="cursor-pointer">HTML Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel" className="cursor-pointer flex items-center gap-1">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Attachment
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">Select Recipients</Label>
              <ScrollArea className="h-[200px] mt-2 border rounded-md p-3">
                {loadingRecipients ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recipients found</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map(recipient => (
                      <div key={recipient.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={recipient.id}
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={() => toggleRecipient(recipient.id)}
                        />
                        <Label htmlFor={recipient.id} className="cursor-pointer text-sm">
                          {recipient.full_name} ({recipient.email})
                          {recipient.store_name && (
                            <span className="text-muted-foreground ml-1">
                              - {recipient.store_name}
                            </span>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendingEmail || selectedRecipients.length === 0}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { 
            size: landscape;
            margin: 0.5in;
          }
          body { 
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table { font-size: 9px !important; }
        }
      `}</style>
    </>
  );
}
