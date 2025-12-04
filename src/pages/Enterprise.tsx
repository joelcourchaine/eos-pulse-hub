import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft, CalendarIcon, Save, Bookmark, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MetricComparisonTable from "@/components/enterprise/MetricComparisonTable";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";

type FilterMode = "brand" | "group" | "custom";
type MetricType = "weekly" | "monthly" | "financial";
type ComparisonMode = "none" | "targets" | "current_year_avg" | "previous_year";
type DatePeriodType = "month" | "full_year" | "custom_range";

export default function Enterprise() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>("brand");
  const [metricType, setMetricType] = useState<MetricType>("weekly");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedDepartmentNames, setSelectedDepartmentNames] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("none");
  const [datePeriodType, setDatePeriodType] = useState<DatePeriodType>("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1)); // Jan 1st
  const [endMonth, setEndMonth] = useState<Date>(new Date());
  const [saveFilterName, setSaveFilterName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sortByMetric, setSortByMetric] = useState<string>("");

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch saved filters
  const { data: savedFilters } = useQuery({
    queryKey: ["enterprise_filters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("enterprise_filters")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Save filter mutation
  const saveFilterMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase.from("enterprise_filters").insert({
        user_id: user.id,
        name,
        filter_mode: filterMode,
        selected_brand_ids: selectedBrandIds,
        selected_group_ids: selectedGroupIds,
        selected_store_ids: selectedStoreIds,
        selected_department_names: selectedDepartmentNames,
        metric_type: metricType,
        date_period_type: datePeriodType,
        selected_year: selectedYear,
        selected_metrics: selectedMetrics,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise_filters"] });
      toast.success("Filter saved successfully");
      setSaveDialogOpen(false);
      setSaveFilterName("");
    },
    onError: () => {
      toast.error("Failed to save filter");
    },
  });

  // Delete filter mutation
  const deleteFilterMutation = useMutation({
    mutationFn: async (filterId: string) => {
      const { error } = await supabase
        .from("enterprise_filters")
        .delete()
        .eq("id", filterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise_filters"] });
      toast.success("Filter deleted");
    },
    onError: () => {
      toast.error("Failed to delete filter");
    },
  });

  // Update filter mutation
  const updateFilterMutation = useMutation({
    mutationFn: async (filterId: string) => {
      const { error } = await supabase
        .from("enterprise_filters")
        .update({
          filter_mode: filterMode,
          selected_brand_ids: selectedBrandIds,
          selected_group_ids: selectedGroupIds,
          selected_store_ids: selectedStoreIds,
          selected_department_names: selectedDepartmentNames,
          metric_type: metricType,
          date_period_type: datePeriodType,
          selected_year: selectedYear,
          selected_metrics: selectedMetrics,
        })
        .eq("id", filterId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise_filters"] });
      toast.success("Filter updated");
    },
    onError: () => {
      toast.error("Failed to update filter");
    },
  });

  // Load a saved filter
  const loadFilter = (filter: any) => {
    setFilterMode(filter.filter_mode as FilterMode);
    setSelectedBrandIds(filter.selected_brand_ids || []);
    setSelectedGroupIds(filter.selected_group_ids || []);
    setSelectedStoreIds(filter.selected_store_ids || []);
    setSelectedDepartmentNames(filter.selected_department_names || []);
    setMetricType(filter.metric_type as MetricType);
    setDatePeriodType(filter.date_period_type as DatePeriodType || "month");
    if (filter.selected_year) setSelectedYear(filter.selected_year);
    if (filter.selected_metrics) setSelectedMetrics(filter.selected_metrics);
    toast.success(`Loaded filter: ${filter.name}`);
  };

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: storeGroups } = useQuery({
    queryKey: ["store_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, store_groups(name), brands(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredStores = useMemo(() => {
    if (!stores) return [];
    
    switch (filterMode) {
      case "brand":
        if (selectedBrandIds.length === 0) return [];
        return stores.filter(store => 
          store.brand_id && selectedBrandIds.includes(store.brand_id)
        );
      case "group":
        if (selectedGroupIds.length === 0) return [];
        return stores.filter(store => 
          store.group_id && selectedGroupIds.includes(store.group_id)
        );
      case "custom":
        return stores.filter(store => selectedStoreIds.includes(store.id));
      default:
        return [];
    }
  }, [stores, filterMode, selectedBrandIds, selectedGroupIds, selectedStoreIds]);

  const storeIds = useMemo(() => {
    if (filteredStores.length > 0) {
      return filteredStores.map(s => s.id);
    }
    // If no stores filtered, use all stores
    return stores?.map(s => s.id) || [];
  }, [filteredStores, stores]);

  // Fetch departments for selected stores
  const { data: departments } = useQuery({
    queryKey: ["departments", storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .in("store_id", storeIds);
      if (error) throw error;
      return data;
    },
    enabled: storeIds.length > 0,
  });

  // Get unique department names
  const uniqueDepartmentNames = useMemo(() => {
    if (!departments) return [];
    const names = Array.from(new Set(departments.map(d => d.name)));
    // Add virtual "Fixed Combined" option
    const sorted = names.sort();
    // Only add Fixed Combined if both Parts and Service exist
    const hasParts = sorted.some(n => n.toLowerCase().includes('parts'));
    const hasService = sorted.some(n => n.toLowerCase().includes('service'));
    if (hasParts && hasService) {
      return ['Fixed Combined', ...sorted];
    }
    return sorted;
  }, [departments]);

  const departmentIds = useMemo(() => {
    if (!departments) return [];
    if (selectedDepartmentNames.length === 0) return departments.map(d => d.id);
    
    // Handle "Fixed Combined" - include both Parts and Service
    const expandedNames = selectedDepartmentNames.flatMap(name => {
      if (name === 'Fixed Combined') {
        return departments
          .filter(d => d.name.toLowerCase().includes('parts') || d.name.toLowerCase().includes('service'))
          .map(d => d.name);
      }
      return [name];
    });
    
    return departments.filter(d => expandedNames.includes(d.name)).map(d => d.id);
  }, [departments, selectedDepartmentNames]);

  // Fetch KPI definitions
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["kpi_definitions", departmentIds, metricType],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*, departments(name, store_id, stores(name))")
        .in("department_id", departmentIds);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType !== "financial",
  });

  // Fetch scorecard entries
  const { data: scorecardEntries } = useQuery({
    queryKey: ["scorecard_entries", kpiDefinitions, metricType],
    queryFn: async () => {
      if (!kpiDefinitions || kpiDefinitions.length === 0) return [];
      const kpiIds = kpiDefinitions.map(k => k.id);
      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", metricType === "weekly" ? "weekly" : "monthly")
        .order("week_start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: kpiDefinitions && kpiDefinitions.length > 0 && metricType !== "financial",
  });

  // Fetch financial entries
  const { data: financialEntries, isLoading: isLoadingFinancialEntries } = useQuery({
    queryKey: ["financial_entries", departmentIds, selectedMonth, datePeriodType, selectedYear, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      
      let query = supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name))")
        .in("department_id", departmentIds);
      
      if (datePeriodType === "month") {
        const monthString = format(selectedMonth, "yyyy-MM");
        query = query.eq("month", monthString);
        console.log("Fetching financial entries for month:", monthString);
      } else if (datePeriodType === "full_year") {
        // For full year, fetch all months for that year
        const yearString = selectedYear.toString();
        query = query
          .gte("month", `${yearString}-01`)
          .lte("month", `${yearString}-12`);
        console.log("Fetching financial entries for full year:", yearString);
      } else if (datePeriodType === "custom_range") {
        // For custom range, fetch between start and end months
        const startMonthString = format(startMonth, "yyyy-MM");
        const endMonthString = format(endMonth, "yyyy-MM");
        query = query
          .gte("month", startMonthString)
          .lte("month", endMonthString);
        console.log("Fetching financial entries for range:", startMonthString, "to", endMonthString);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial",
  });

  // Get available metrics based on metric type
  const availableMetrics = useMemo(() => {
    if (metricType === "financial") {
      const firstStore = filteredStores[0];
      const brand = firstStore?.brand || firstStore?.brands?.name || null;
      console.log("Getting metrics for brand:", brand, "First store:", firstStore?.name);
      const metrics = getMetricsForBrand(brand);
      console.log("Available metrics for brand:", brand, metrics.length, metrics.map(m => m.name));
      return metrics;
    } else if (kpiDefinitions) {
      return Array.from(new Set(kpiDefinitions.map(k => ({ name: k.name, key: k.name }))));
    }
    return [];
  }, [metricType, kpiDefinitions, filteredStores]);

  // Auto-select Service Department by default
  useEffect(() => {
    if (uniqueDepartmentNames.length > 0 && selectedDepartmentNames.length === 0) {
      const serviceDept = uniqueDepartmentNames.find(name => 
        name.toLowerCase().includes('service')
      );
      if (serviceDept) {
        setSelectedDepartmentNames([serviceDept]);
      }
    }
  }, [uniqueDepartmentNames]);

  // Auto-select all metrics when switching to financial type (only if none are selected)
  useEffect(() => {
    if (metricType === "financial" && availableMetrics.length > 0 && selectedMetrics.length === 0) {
      const metricNames = availableMetrics.map((m: any) => m.name);
      setSelectedMetrics(metricNames);
    }
  }, [metricType, availableMetrics]);

  // Create a map of metric names to keys for financial metrics
  const metricKeyMap = useMemo(() => {
    if (metricType === "financial") {
      const map = new Map<string, string>();
      availableMetrics.forEach((m: any) => map.set(m.name, m.key));
      return map;
    }
    return new Map<string, string>();
  }, [metricType, availableMetrics]);

  // Prepare comparison data
  const comparisonData = useMemo(() => {
    console.log("Preparing comparison data:", {
      metricType,
      selectedMetrics,
      financialEntriesCount: financialEntries?.length,
      kpiDefinitionsCount: kpiDefinitions?.length,
      scorecardEntriesCount: scorecardEntries?.length,
      departmentsCount: departments?.length,
      filteredStoresCount: filteredStores.length,
    });

    let dataWithValues: any[] = [];
    const isFixedCombined = selectedDepartmentNames.includes('Fixed Combined');

    if (metricType === "financial") {
      // Don't process if data structures aren't ready yet
      if (!financialEntries || !departments) {
        console.log("Financial data structures not ready yet, returning empty array");
        return [];
      }
      
      // For full year, aggregate whatever data exists - don't require all months
      if (financialEntries.length === 0 && datePeriodType !== "full_year") {
        console.log("No financial data available for selected period");
        return [];
      }
      // Load metrics from all brands to support multi-brand comparison (matching DealerComparison)
      const allBrandMetrics = [
        ...getMetricsForBrand('GMC'),
        ...getMetricsForBrand('Ford'),
        ...getMetricsForBrand('Nissan'),
        ...getMetricsForBrand('Mazda'),
      ];
      
      // Deduplicate by key, preferring metrics that have calculations (more complete definitions)
      const uniqueMetrics = new Map<string, any>();
      allBrandMetrics.forEach((m: any) => {
        const existing = uniqueMetrics.get(m.key);
        if (!existing || (!existing.calculation && m.calculation)) {
          uniqueMetrics.set(m.key, m);
        }
      });
      
      const brandMetrics = Array.from(uniqueMetrics.values());
      
      // Get all keys for metrics that are stored in the database (no calculation property OR dollar type with calculation)
      // We need base dollar values to calculate percentages
      const storedMetricKeys = brandMetrics
        .filter((m: any) => !m.calculation || m.type === 'dollar')
        .map((m: any) => m.key);
      
      console.log("Financial comparison - Selected metrics:", selectedMetrics);
      console.log("Financial comparison - Stored metric keys:", storedMetricKeys);
      console.log("Financial comparison - All entries count:", financialEntries.length);
      
      // Filter to get all base metrics we need for calculations
      const filtered = financialEntries.filter(entry => storedMetricKeys.includes(entry.metric_name));
      console.log("Financial entries filtered:", filtered.length);
      console.log("Filtered metric names:", Array.from(new Set(filtered.map(e => e.metric_name))));
      console.log("Sample filtered entries:", filtered.slice(0, 3));
      
      // Group by store + department + metric
      const groupedByKey = filtered.reduce((acc, entry) => {
        const metricDisplayName = Array.from(metricKeyMap.entries()).find(([_, key]) => key === entry.metric_name)?.[0] || entry.metric_name;
        const departmentId = (entry as any)?.departments?.id;
        const storeId = (entry as any)?.departments?.store_id;
        const departmentName = (entry as any)?.departments?.name;
        const key = `${storeId}-${departmentId}-${entry.metric_name}`;
        
        if (datePeriodType === "month") {
          // For monthly view, only keep the most recent entry
          if (!acc[key]) {
            acc[key] = {
              storeId: storeId || "",
              storeName: (entry as any)?.departments?.stores?.name || "",
              departmentId: departmentId,
              departmentName: departmentName,
              metricName: metricDisplayName,
              metricKey: entry.metric_name,
              value: entry.value ? Number(entry.value) : null,
              target: null,
              variance: null,
            };
          }
        } else {
          // For full year view, collect all raw values to sum/recalculate later
          const storeKey = `${storeId}-${departmentId}`;
          if (!acc[storeKey]) {
            acc[storeKey] = {
              storeId: storeId || "",
              storeName: (entry as any)?.departments?.stores?.name || "",
              departmentId: departmentId,
              departmentName: departmentName,
              rawValues: {},
            };
          }
          
          // Sum dollar values
          if (!acc[storeKey].rawValues[entry.metric_name]) {
            acc[storeKey].rawValues[entry.metric_name] = {
              metricKey: entry.metric_name,
              metricDisplayName: metricDisplayName,
              value: entry.value ? Number(entry.value) : 0,
            };
          } else {
            acc[storeKey].rawValues[entry.metric_name].value += entry.value ? Number(entry.value) : 0;
          }
        }
        return acc;
      }, {} as Record<string, any>);
      
      let processedData: any[] = [];
      
      // Helper function to calculate a metric value
      const calculateMetricValue = (metricConfig: any, allMetrics: Map<string, number>, calculatedValues: Map<string, number>): number | null => {
        if (!metricConfig.calculation) {
          return allMetrics.get(metricConfig.key) ?? null;
        }
        
        const calc = metricConfig.calculation;
        
        // Percentage calculation
        if ('numerator' in calc && 'denominator' in calc) {
          const num = calculatedValues.get(calc.numerator) ?? allMetrics.get(calc.numerator) ?? 0;
          const denom = calculatedValues.get(calc.denominator) ?? allMetrics.get(calc.denominator) ?? 0;
          return denom !== 0 ? (num / denom) * 100 : 0;
        }
        
        // Subtraction calculation
        if (calc.type === 'subtract') {
          const baseValue = calculatedValues.get(calc.base) ?? allMetrics.get(calc.base) ?? 0;
          const deductions = calc.deductions.reduce((sum: number, key: string) => {
            return sum + (calculatedValues.get(key) ?? allMetrics.get(key) ?? 0);
          }, 0);
          return baseValue - deductions;
        }
        
        // Complex calculation (base - deductions + additions)
        if (calc.type === 'complex') {
          const baseValue = calculatedValues.get(calc.base) ?? allMetrics.get(calc.base) ?? 0;
          const deductions = calc.deductions?.reduce((sum: number, key: string) => {
            return sum + (calculatedValues.get(key) ?? allMetrics.get(key) ?? 0);
          }, 0) || 0;
          const additions = calc.additions?.reduce((sum: number, key: string) => {
            return sum + (calculatedValues.get(key) ?? allMetrics.get(key) ?? 0);
          }, 0) || 0;
          return baseValue - deductions + additions;
        }
        
        return null;
      };
      
      if (datePeriodType === "month") {
        // For monthly view, process each store's data
        const storeGroups = new Map<string, any>();
        
        Object.values(groupedByKey).forEach((entry: any) => {
          const storeKey = `${entry.storeId}-${entry.departmentId}`;
          if (!storeGroups.has(storeKey)) {
            storeGroups.set(storeKey, {
              storeId: entry.storeId,
              storeName: entry.storeName,
              departmentId: entry.departmentId,
              departmentName: entry.departmentName,
              rawValues: new Map<string, number>(),
            });
          }
          storeGroups.get(storeKey).rawValues.set(entry.metricKey, entry.value);
        });
        
        // Calculate all selected metrics for each store/department
        storeGroups.forEach((storeData) => {
          const calculatedValues = new Map<string, number>();
          
          // Process metrics in order (dependencies first)
          brandMetrics.forEach((metric: any) => {
            const value = calculateMetricValue(metric, storeData.rawValues, calculatedValues);
            if (value !== null) {
              calculatedValues.set(metric.key, value);
            }
          });
          
          // Create output entries for selected metrics
          selectedMetrics.forEach((metricName) => {
            const metricConfig = brandMetrics.find((m: any) => m.name === metricName);
            if (metricConfig) {
              const value = calculatedValues.get(metricConfig.key);
              if (value !== undefined) {
                processedData.push({
                  storeId: storeData.storeId,
                  storeName: storeData.storeName,
                  departmentId: storeData.departmentId,
                  departmentName: storeData.departmentName,
                  metricName: metricName,
                  value: value,
                  target: null,
                  variance: null,
                });
              }
            }
          });
        });
      } else if (datePeriodType === "full_year" || datePeriodType === "custom_range") {
        // For full year, recalculate from summed values
        Object.values(groupedByKey).forEach((storeData: any) => {
          const allMetrics = new Map<string, number>();
          const calculatedValues = new Map<string, number>();
          
          // First pass: collect all raw dollar values
          Object.values(storeData.rawValues).forEach((metric: any) => {
            allMetrics.set(metric.metricKey, metric.value);
          });
          
          // Process metrics in order (dependencies first)
          brandMetrics.forEach((metric: any) => {
            const value = calculateMetricValue(metric, allMetrics, calculatedValues);
            if (value !== null) {
              calculatedValues.set(metric.key, value);
            }
          });
          
          // Create output entries for selected metrics
          selectedMetrics.forEach((metricName) => {
            const metricConfig = brandMetrics.find((m: any) => m.name === metricName);
            if (metricConfig) {
              const value = calculatedValues.get(metricConfig.key);
              if (value !== undefined) {
                processedData.push({
                  storeId: storeData.storeId,
                  storeName: storeData.storeName,
                  departmentId: storeData.departmentId,
                  departmentName: storeData.departmentName,
                  metricName: metricName,
                  value: value,
                  target: null,
                  variance: null,
                });
              }
            }
          });
        });
      }
      
      // If Fixed Combined is selected, aggregate Parts and Service data
      if (isFixedCombined) {
        const combinedByStore = new Map<string, Map<string, number>>();
        
        // Collect all raw dollar values from Parts and Service departments
        processedData.forEach(entry => {
          const isParts = entry.departmentName?.toLowerCase().includes('parts');
          const isService = entry.departmentName?.toLowerCase().includes('service');
          
          if (isParts || isService) {
            if (!combinedByStore.has(entry.storeId)) {
              combinedByStore.set(entry.storeId, new Map());
            }
            const storeMetrics = combinedByStore.get(entry.storeId)!;
            const metricConfig = brandMetrics.find((m: any) => m.name === entry.metricName);
            const metricKey = metricConfig?.key || entry.metricName;
            
            // Sum values for this metric
            storeMetrics.set(metricKey, (storeMetrics.get(metricKey) || 0) + (entry.value || 0));
          }
        });
        
        // Calculate final values for all selected metrics
        const combinedData: any[] = [];
        const firstProcessedEntry = processedData.find(e => 
          e.departmentName?.toLowerCase().includes('parts') || 
          e.departmentName?.toLowerCase().includes('service')
        );
        
        combinedByStore.forEach((rawMetrics, storeId) => {
          const calculatedValues = new Map<string, number>();
          const storeName = processedData.find(e => e.storeId === storeId)?.storeName || '';
          
          // Calculate all metrics in order
          brandMetrics.forEach((metric: any) => {
            const value = calculateMetricValue(metric, rawMetrics, calculatedValues);
            if (value !== null) {
              calculatedValues.set(metric.key, value);
            }
          });
          
          // Create output entries for selected metrics
          selectedMetrics.forEach((metricName) => {
            const metricConfig = brandMetrics.find((m: any) => m.name === metricName);
            if (metricConfig) {
              const value = calculatedValues.get(metricConfig.key);
              if (value !== undefined) {
                combinedData.push({
                  storeId: storeId,
                  storeName: storeName,
                  departmentId: undefined,
                  departmentName: 'Fixed Combined',
                  metricName: metricName,
                  value: value,
                  target: null,
                  variance: null,
                });
              }
            }
          });
        });
        
        dataWithValues = combinedData;
      } else {
        dataWithValues = processedData;
      }
    } else if (kpiDefinitions && scorecardEntries) {
      console.log("Processing KPI data");
      dataWithValues = scorecardEntries
        .map(entry => {
          const kpi = kpiDefinitions.find(k => k.id === entry.kpi_id);
          if (!kpi || !selectedMetrics.includes(kpi.name)) return null;
          
          return {
            storeId: (kpi as any)?.departments?.store_id || "",
            storeName: (kpi as any)?.departments?.stores?.name || "",
            departmentId: kpi.department_id,
            departmentName: (kpi as any)?.departments?.name,
            metricName: kpi.name,
            value: entry.actual_value ? Number(entry.actual_value) : null,
            target: kpi.target_value ? Number(kpi.target_value) : null,
            variance: entry.variance ? Number(entry.variance) : null,
          };
        })
        .filter(Boolean) as any[];
      console.log("KPI entries mapped:", dataWithValues.length);
    }

    // Ensure all filtered stores appear in the output, even without data
    if (filteredStores.length > 0 && selectedMetrics.length > 0) {
      const storesWithData = new Set(dataWithValues.map(d => d.storeId));
      const storesWithoutData = filteredStores.filter(store => !storesWithData.has(store.id));
      
      console.log("Stores with data:", storesWithData.size, "Stores without data:", storesWithoutData.length);
      
      // Add placeholder entries for stores without data
      storesWithoutData.forEach(store => {
        const storeDepartments = departments?.filter(d => d.store_id === store.id) || [];
        const relevantDepartments = selectedDepartmentNames.length > 0
          ? storeDepartments.filter(d => selectedDepartmentNames.includes(d.name))
          : storeDepartments;
        
        // If store has no departments, add one entry per metric
        if (relevantDepartments.length === 0) {
          selectedMetrics.forEach(metricName => {
            dataWithValues.push({
              storeId: store.id,
              storeName: store.name,
              departmentId: undefined,
              departmentName: undefined,
              metricName: metricName,
              value: null,
              target: null,
              variance: null,
            });
          });
        } else {
          // Add entries for each department + metric combination
          relevantDepartments.forEach(dept => {
            selectedMetrics.forEach(metricName => {
              dataWithValues.push({
                storeId: store.id,
                storeName: store.name,
                departmentId: dept.id,
                departmentName: dept.name,
                metricName: metricName,
                value: null,
                target: null,
                variance: null,
              });
            });
          });
        }
      });
    }

    console.log("Final comparison data length:", dataWithValues.length);
    return dataWithValues;
  }, [metricType, financialEntries, departments, kpiDefinitions, scorecardEntries, selectedMetrics, metricKeyMap, filteredStores, selectedDepartmentNames, datePeriodType, selectedYear]);

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrandIds(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
    );
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleDepartmentSelection = (departmentName: string) => {
    setSelectedDepartmentNames(prev =>
      prev.includes(departmentName)
        ? prev.filter(name => name !== departmentName)
        : [...prev, departmentName]
    );
  };

  const toggleMetricSelection = (metric: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">Enterprise View</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Filter
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Save Current Filter</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Filter name..."
                    value={saveFilterName}
                    onChange={(e) => setSaveFilterName(e.target.value)}
                  />
                  <Button 
                    className="w-full"
                    onClick={() => saveFilterMutation.mutate(saveFilterName)}
                    disabled={!saveFilterName.trim() || saveFilterMutation.isPending}
                  >
                    {saveFilterMutation.isPending ? "Saving..." : "Save Filter"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Saved Filters */}
        {savedFilters && savedFilters.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Bookmark className="h-4 w-4" />
                Saved Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-2">
                {savedFilters.map((filter) => (
                  <div key={filter.id} className="flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => loadFilter(filter)}
                    >
                      {filter.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => updateFilterMutation.mutate(filter.id)}
                      title="Update with current settings"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteFilterMutation.mutate(filter.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Filter Stores</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs
                value={filterMode}
                onValueChange={(v) => setFilterMode(v as FilterMode)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="brand">Brand</TabsTrigger>
                  <TabsTrigger value="group">Group</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

                <TabsContent value="brand" className="mt-4">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {brands?.map((brand) => (
                        <div key={brand.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`brand-${brand.id}`}
                            checked={selectedBrandIds.includes(brand.id)}
                            onCheckedChange={() => toggleBrandSelection(brand.id)}
                          />
                          <label
                            htmlFor={`brand-${brand.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {brand.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="group" className="mt-4">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {storeGroups?.map((group) => (
                        <div key={group.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={selectedGroupIds.includes(group.id)}
                            onCheckedChange={() => toggleGroupSelection(group.id)}
                          />
                          <label
                            htmlFor={`group-${group.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {group.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="custom" className="mt-4">
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-3">
                      {stores?.map((store) => (
                        <div key={store.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`store-${store.id}`}
                            checked={selectedStoreIds.includes(store.id)}
                            onCheckedChange={() => toggleStoreSelection(store.id)}
                          />
                          <label
                            htmlFor={`store-${store.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {store.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>
                Select Departments
                {selectedDepartmentNames.length === 0 && uniqueDepartmentNames.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">(All selected)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {uniqueDepartmentNames.map((deptName) => (
                    <div key={deptName} className="flex items-center space-x-2">
                      <Checkbox
                        id={`dept-${deptName}`}
                        checked={selectedDepartmentNames.length === 0 || selectedDepartmentNames.includes(deptName)}
                        onCheckedChange={() => toggleDepartmentSelection(deptName)}
                      />
                      <label
                        htmlFor={`dept-${deptName}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {deptName}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Metric Type</label>
                <Select value={metricType} onValueChange={(v) => setMetricType(v as MetricType)}>
                  <SelectTrigger className="bg-background z-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="weekly">Weekly KPIs</SelectItem>
                    <SelectItem value="monthly">Monthly KPIs</SelectItem>
                    <SelectItem value="financial">Financial Metrics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {metricType === "financial" && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Compare Against</label>
                  <Select value={comparisonMode} onValueChange={(v) => setComparisonMode(v as ComparisonMode)}>
                    <SelectTrigger className="bg-background z-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="none">No Comparison</SelectItem>
                      <SelectItem value="targets">Store Targets</SelectItem>
                      <SelectItem value="current_year_avg">Current Year Average</SelectItem>
                      <SelectItem value="previous_year">Same Month Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {metricType === "financial" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date Period</label>
                    <Select value={datePeriodType} onValueChange={(v) => setDatePeriodType(v as DatePeriodType)}>
                      <SelectTrigger className="bg-background z-50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="month">Single Month</SelectItem>
                        <SelectItem value="full_year">Full Year</SelectItem>
                        <SelectItem value="custom_range">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {datePeriodType === "month" ? (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Month</label>
                      <Select 
                        value={format(selectedMonth, "yyyy-MM")} 
                        onValueChange={(value) => {
                          const [year, month] = value.split('-');
                          setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                        }}
                      >
                        <SelectTrigger className="bg-background z-50">
                          <SelectValue>
                            {format(selectedMonth, "MMMM yyyy")}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50 max-h-[300px]">
                          {Array.from({ length: 24 }, (_, i) => {
                            const date = new Date();
                            date.setMonth(date.getMonth() - i);
                            const value = format(date, "yyyy-MM");
                            return (
                              <SelectItem key={value} value={value}>
                                {format(date, "MMMM yyyy")}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : datePeriodType === "full_year" ? (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Year</label>
                      <Select 
                        value={selectedYear.toString()} 
                        onValueChange={(value) => setSelectedYear(parseInt(value))}
                      >
                        <SelectTrigger className="bg-background z-50">
                          <SelectValue>
                            {selectedYear}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value={new Date().getFullYear().toString()}>
                            Current Year ({new Date().getFullYear()})
                          </SelectItem>
                          <SelectItem value={(new Date().getFullYear() - 1).toString()}>
                            Prior Year ({new Date().getFullYear() - 1})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Start Month</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-background z-50"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(startMonth, "MMM yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={startMonth}
                              onSelect={(date) => date && setStartMonth(date)}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">End Month</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal bg-background z-50"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(endMonth, "MMM yyyy")}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 z-[100]" align="start">
                            <Calendar
                              mode="single"
                              selected={endMonth}
                              onSelect={(date) => date && setEndMonth(date)}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Metrics ({selectedMetrics.length} selected)
                </label>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {availableMetrics.map((metric: any) => {
                      const metricName = typeof metric === 'string' ? metric : metric.name;
                      return (
                        <div key={metricName} className="flex items-center space-x-2">
                          <Checkbox
                            id={`metric-${metricName}`}
                            checked={selectedMetrics.includes(metricName)}
                            onCheckedChange={() => toggleMetricSelection(metricName)}
                          />
                          <label
                            htmlFor={`metric-${metricName}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {metricName}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Dealer Comparison
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredStores.length} stores, {selectedMetrics.length} metrics)
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Sort by:</span>
                      <Select 
                        value={sortByMetric || "__none__"} 
                        onValueChange={(val) => setSortByMetric(val === "__none__" ? "" : val)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="No sorting" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No sorting</SelectItem>
                          {selectedMetrics.map((metric) => (
                            <SelectItem key={metric} value={metric}>
                              {metric}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => {
                        // Prepare date parameters based on period type
                        const dateParams: any = {
                          datePeriodType,
                        };
                        
                        if (datePeriodType === "month") {
                          dateParams.selectedMonth = format(selectedMonth, "yyyy-MM");
                        } else if (datePeriodType === "full_year") {
                          dateParams.selectedYear = selectedYear;
                        } else if (datePeriodType === "custom_range") {
                          dateParams.startMonth = format(startMonth, "yyyy-MM");
                          dateParams.endMonth = format(endMonth, "yyyy-MM");
                        }
                        
                        navigate("/dealer-comparison", {
                          state: {
                            data: comparisonData,
                            metricType,
                            selectedMetrics,
                            ...dateParams,
                            comparisonMode,
                            departmentIds,
                            isFixedCombined: selectedDepartmentNames.includes('Fixed Combined'),
                            selectedDepartmentNames,
                            sortByMetric,
                          }
                        });
                      }}
                      disabled={filteredStores.length === 0 || selectedMetrics.length === 0}
                    >
                      View Dashboard
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <MetricComparisonTable
                  data={comparisonData}
                  metricType={metricType}
                  selectedMetrics={selectedMetrics}
                  isLoading={metricType === "financial" && isLoadingFinancialEntries}
                  sortByMetric={sortByMetric}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
