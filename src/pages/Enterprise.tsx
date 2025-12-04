import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft, CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MetricComparisonTable from "@/components/enterprise/MetricComparisonTable";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

type FilterMode = "brand" | "group" | "custom";
type MetricType = "weekly" | "monthly" | "financial";
type ComparisonMode = "targets" | "current_year_avg" | "previous_year";
type DatePeriodType = "month" | "full_year" | "custom_range";

export default function Enterprise() {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<FilterMode>("brand");
  const [metricType, setMetricType] = useState<MetricType>("weekly");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedDepartmentNames, setSelectedDepartmentNames] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("targets");
  const [datePeriodType, setDatePeriodType] = useState<DatePeriodType>("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [startMonth, setStartMonth] = useState<Date>(new Date(new Date().getFullYear(), 0, 1)); // Jan 1st
  const [endMonth, setEndMonth] = useState<Date>(new Date());

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

  // Auto-select all metrics when switching to financial type
  useEffect(() => {
    if (metricType === "financial" && availableMetrics.length > 0) {
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
      // Convert selected metric names to database keys
      const selectedKeys = selectedMetrics.map(name => metricKeyMap.get(name) || name);
      console.log("Financial comparison - Selected metrics:", selectedMetrics);
      console.log("Financial comparison - Selected keys:", selectedKeys);
      console.log("Financial comparison - All entries count:", financialEntries.length);
      
      const filtered = financialEntries.filter(entry => selectedKeys.includes(entry.metric_name));
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
      
      if (datePeriodType === "month") {
        processedData = Object.values(groupedByKey);
      } else if (datePeriodType === "full_year" || datePeriodType === "custom_range") {
        // For full year, recalculate percentages from summed values
        const firstStore = filteredStores[0];
        const brand = firstStore?.brand || (firstStore?.brands as any)?.name || null;
        const brandMetrics = getMetricsForBrand(brand);
        
        Object.values(groupedByKey).forEach((storeData: any) => {
          const allMetrics = new Map<string, number>();
          
          // First pass: collect all dollar values
          Object.values(storeData.rawValues).forEach((metric: any) => {
            allMetrics.set(metric.metricKey, metric.value);
          });
          
          // Second pass: create entries with recalculated percentages
          Object.values(storeData.rawValues).forEach((metric: any) => {
            const metricConfig = brandMetrics.find((m: any) => m.name === metric.metricDisplayName);
            let finalValue = metric.value;
            
            // If it's a percentage metric, recalculate from dollar values
            if (metricConfig?.type === 'percentage' && metricConfig?.calculation) {
              const calc = metricConfig.calculation;
              if ('numerator' in calc && 'denominator' in calc) {
                const num = allMetrics.get(calc.numerator) || 0;
                const denom = allMetrics.get(calc.denominator) || 0;
                finalValue = denom !== 0 ? (num / denom) * 100 : 0;
              }
            }
            
            processedData.push({
              storeId: storeData.storeId,
              storeName: storeData.storeName,
              departmentId: storeData.departmentId,
              departmentName: storeData.departmentName,
              metricName: metric.metricDisplayName,
              value: finalValue,
              target: null,
              variance: null,
            });
          });
        });
      }
      
      // If Fixed Combined is selected, aggregate Parts and Service data
      if (isFixedCombined) {
        const combinedByStore = new Map<string, Map<string, any>>();
        
        processedData.forEach(entry => {
          const isParts = entry.departmentName?.toLowerCase().includes('parts');
          const isService = entry.departmentName?.toLowerCase().includes('service');
          
          if (isParts || isService) {
            if (!combinedByStore.has(entry.storeId)) {
              combinedByStore.set(entry.storeId, new Map());
            }
            const storeMetrics = combinedByStore.get(entry.storeId)!;
            
            if (!storeMetrics.has(entry.metricName)) {
              storeMetrics.set(entry.metricName, {
                storeId: entry.storeId,
                storeName: entry.storeName,
                departmentName: 'Fixed Combined',
                metricName: entry.metricName,
                metricKey: entry.metricKey,
                values: {},
                target: null,
                variance: null,
              });
            }
            
            const combined = storeMetrics.get(entry.metricName);
            combined.values[entry.metricKey] = (combined.values[entry.metricKey] || 0) + (entry.value || 0);
          }
        });
        
        // Calculate final values and percentages
        const combinedData: any[] = [];
        combinedByStore.forEach((storeMetrics, storeId) => {
          const allMetrics = new Map<string, number>();
          
          // First pass: collect all dollar values
          storeMetrics.forEach((metric) => {
            allMetrics.set(metric.metricKey, metric.values[metric.metricKey] || 0);
          });
          
          // Second pass: calculate percentages using the metric config
          storeMetrics.forEach((metric) => {
            const firstStore = filteredStores[0];
            const brand = firstStore?.brand || (firstStore?.brands as any)?.name || null;
            const brandMetrics = getMetricsForBrand(brand);
            const metricConfig = brandMetrics.find((m: any) => m.name === metric.metricName);
            let finalValue = metric.values[metric.metricKey] || 0;
            
            // If it's a percentage metric, recalculate
            if (metricConfig?.type === 'percentage' && metricConfig?.calculation) {
              const calc = metricConfig.calculation;
              if ('numerator' in calc && 'denominator' in calc) {
                const num = allMetrics.get(calc.numerator) || 0;
                const denom = allMetrics.get(calc.denominator) || 0;
                finalValue = denom !== 0 ? (num / denom) * 100 : 0;
              }
            }
            
            combinedData.push({
              storeId: metric.storeId,
              storeName: metric.storeName,
              departmentId: undefined,
              departmentName: 'Fixed Combined',
              metricName: metric.metricName,
              value: finalValue,
              target: null,
              variance: null,
            });
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
        </div>

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
                         }
                       });
                     }}
                     disabled={filteredStores.length === 0 || selectedMetrics.length === 0}
                   >
                     View Dashboard
                   </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MetricComparisonTable
                  data={comparisonData}
                  metricType={metricType}
                  selectedMetrics={selectedMetrics}
                  isLoading={metricType === "financial" && isLoadingFinancialEntries}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
