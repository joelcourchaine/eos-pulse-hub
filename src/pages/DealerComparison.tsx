import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Mail } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmailComparisonDialog } from "@/components/enterprise/EmailComparisonDialog";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { format } from "date-fns";

interface ComparisonData {
  storeId: string;
  storeName: string;
  departmentId?: string;
  departmentName?: string;
  metricName: string;
  value: number | null;
  target: number | null;
  variance: number | null;
}

export default function DealerComparison() {
  const location = useLocation();
  const navigate = useNavigate();
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Check if state exists, redirect if not
  useEffect(() => {
    if (!location.state) {
      navigate("/enterprise", { replace: true });
    }
  }, [location.state, navigate]);

  // Return null while redirecting
  if (!location.state) {
    return null;
  }

  const { data: initialData, metricType, selectedMetrics, selectedMonth, comparisonMode = "targets", departmentIds: initialDepartmentIds, isFixedCombined = false, selectedDepartmentNames = [], datePeriodType = "month", selectedYear, startMonth, endMonth, sortByMetric = "" } = location.state as {
    data: ComparisonData[];
    metricType: string;
    selectedMetrics: string[];
    selectedMonth?: string;
    comparisonMode?: string;
    departmentIds?: string[];
    isFixedCombined?: boolean;
    selectedDepartmentNames?: string[];
    datePeriodType?: string;
    selectedYear?: number;
    startMonth?: string;
    endMonth?: string;
    sortByMetric?: string;
  };

  // Initialize with passed data
  useEffect(() => {
    setComparisonData(initialData);
  }, [initialData]);

  // Extract department IDs from the data
  const departmentIds = useMemo(() => {
    if (initialDepartmentIds && initialDepartmentIds.length > 0) {
      return initialDepartmentIds;
    }
    return Array.from(new Set(comparisonData.map(d => d.departmentId).filter(Boolean))) as string[];
  }, [comparisonData, initialDepartmentIds]);

  // Create metric key map for financial metrics
  const metricKeyMap = useMemo(() => {
    if (metricType === "financial" && comparisonData.length > 0) {
      const map = new Map<string, string>();
      // Get metrics for all brands to build the map (we'll filter by brand in the main processing)
      const metrics = getMetricsForBrand(null);
      metrics.forEach((m: any) => map.set(m.name, m.key));
      return map;
    }
    return new Map<string, string>();
  }, [metricType, comparisonData]);

  // Fetch ALL financial entries for these departments (not filtered by month initially to get full context)
  const { data: financialEntries, refetch: refetchFinancial } = useQuery({
    queryKey: ["dealer_comparison_financial", departmentIds, selectedMonth, datePeriodType, selectedYear, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      
      console.log("Fetching financial data for dealer comparison:", {
        datePeriodType,
        selectedMonth,
        selectedYear,
        startMonth,
        endMonth,
        departmentIds
      });
      
      let query = supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name, brand, brand_id, brands(name)))")
        .in("department_id", departmentIds);
      
      // Apply date filtering based on period type
      if (datePeriodType === "month") {
        const monthString = selectedMonth || format(new Date(), "yyyy-MM");
        query = query.eq("month", monthString);
        console.log("Filtering by single month:", monthString);
      } else if (datePeriodType === "full_year") {
        const year = selectedYear || new Date().getFullYear();
        query = query
          .gte("month", `${year}-01`)
          .lte("month", `${year}-12`);
        console.log("Filtering by full year:", year);
      } else if (datePeriodType === "custom_range" && startMonth && endMonth) {
        query = query
          .gte("month", startMonth)
          .lte("month", endMonth);
        console.log("Filtering by custom range:", startMonth, "to", endMonth);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching financial entries:", error);
        throw error;
      }
      
      console.log("Fetched financial entries:", data?.length || 0, "records");
      return data || [];
    },
    enabled: departmentIds.length > 0 && metricType === "financial",
    refetchInterval: 60000,
  });

  // Fetch financial targets
  const { data: financialTargets } = useQuery({
    queryKey: ["dealer_comparison_targets", departmentIds, selectedMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const monthDate = selectedMonth ? new Date(selectedMonth + '-15') : new Date();
      const quarter = Math.ceil((monthDate.getMonth() + 1) / 3);
      const year = monthDate.getFullYear();
      
      const { data, error } = await supabase
        .from("financial_targets")
        .select("*")
        .in("department_id", departmentIds)
        .eq("quarter", quarter)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && comparisonMode === "targets",
  });

  // Fetch current year average data
  const { data: currentYearData } = useQuery({
    queryKey: ["dealer_comparison_year_avg", departmentIds, selectedMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const year = selectedMonth ? new Date(selectedMonth + '-15').getFullYear() : new Date().getFullYear();
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name, brands(name)))")
        .in("department_id", departmentIds)
        .gte("month", `${year}-01`)
        .lte("month", `${year}-12`);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && comparisonMode === "current_year_avg",
  });

  // Fetch previous year same month data
  const { data: previousYearData } = useQuery({
    queryKey: ["dealer_comparison_prev_year", departmentIds, selectedMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const currentDate = selectedMonth ? new Date(selectedMonth + '-15') : new Date();
      const prevYear = currentDate.getFullYear() - 1;
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const prevYearMonth = `${prevYear}-${month}`;
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name, brands(name)))")
        .in("department_id", departmentIds)
        .eq("month", prevYearMonth);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial" && comparisonMode === "previous_year",
  });

  // Fetch KPI data for polling
  const { data: kpiDefinitions, refetch: refetchKPIs } = useQuery({
    queryKey: ["dealer_comparison_kpis", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*, departments(id, name, store_id, stores(name))")
        .in("department_id", departmentIds);
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType !== "financial",
    refetchInterval: 60000,
  });

  const { data: scorecardEntries, refetch: refetchScorecard } = useQuery({
    queryKey: ["dealer_comparison_scorecard", kpiDefinitions],
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
    refetchInterval: 60000,
  });

  // Update comparison data when fresh data arrives
  useEffect(() => {
    if (metricType === "financial" && financialEntries && selectedMetrics.length > 0) {
      console.log("Processing financial entries:", financialEntries.length);
      
      // Detect brand from first entry to get correct metrics
      const firstEntry = financialEntries[0];
      const brand = (firstEntry as any)?.departments?.stores?.brands?.name || 
                    (firstEntry as any)?.departments?.stores?.brand || null;
      console.log("Detected brand for comparison:", brand, "from entry:", firstEntry);
      
      // Create metric maps - use all possible metrics for multi-brand comparison
      const nameToKey = new Map<string, string>();
      const keyToName = new Map<string, string>();
      const keyToDef = new Map<string, any>();
      
      // Load metrics from all brands to support multi-brand comparison
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
      
      uniqueMetrics.forEach((m) => {
        nameToKey.set(m.name, m.key);
        keyToName.set(m.key, m.name);
        keyToDef.set(m.key, m);
      });
      
      // Also use the default metrics config for ordering
      const metrics = Array.from(uniqueMetrics.values());
      
      console.log("DealerComparison - Using combined metrics from all brands");
      console.log("DealerComparison - Total unique metrics:", metrics.length);
      console.log("DealerComparison - Has semi_fixed_expense:", keyToDef.has('semi_fixed_expense'));
      
      // Build comparison baseline map (targets, averages, or previous year)
      const comparisonMap = new Map<string, { value: number; direction?: string }>();
      
      if (comparisonMode === "targets" && financialTargets) {
        financialTargets.forEach(target => {
          const key = `${target.department_id}-${target.metric_name}`;
          comparisonMap.set(key, {
            value: Number(target.target_value),
            direction: target.target_direction
          });
        });
      } else if (comparisonMode === "current_year_avg" && currentYearData) {
        // Calculate averages for each department + metric
        const sums = new Map<string, { total: number; count: number }>();
        currentYearData.forEach(entry => {
          const deptId = (entry as any)?.departments?.id;
          const key = `${deptId}-${entry.metric_name}`;
          const current = sums.get(key) || { total: 0, count: 0 };
          if (entry.value !== null) {
            current.total += Number(entry.value);
            current.count += 1;
          }
          sums.set(key, current);
        });
        sums.forEach((sum, key) => {
          if (sum.count > 0) {
            comparisonMap.set(key, { value: sum.total / sum.count });
          }
        });
      } else if (comparisonMode === "previous_year" && previousYearData) {
        previousYearData.forEach(entry => {
          const deptId = (entry as any)?.departments?.id;
          const key = `${deptId}-${entry.metric_name}`;
          if (entry.value !== null) {
            comparisonMap.set(key, { value: Number(entry.value) });
          }
        });
      }
      
      // Build a map of all data by store+dept+metric key
      const dataMap: Record<string, ComparisonData> = {};
      
      // For full_year and custom_range, we need to aggregate data first
      if (datePeriodType === "full_year" || datePeriodType === "custom_range") {
        console.log("Aggregating data for multi-month period");
        
        // Group entries by store+dept and collect raw values
        const aggregatedByStoreDept = new Map<string, Map<string, number>>();
        
        financialEntries.forEach(entry => {
          const storeId = (entry as any)?.departments?.store_id || "";
          const deptId = (entry as any)?.departments?.id;
          const key = `${storeId}-${deptId}`;
          
          if (!aggregatedByStoreDept.has(key)) {
            aggregatedByStoreDept.set(key, new Map());
          }
          
          const storeMetrics = aggregatedByStoreDept.get(key)!;
          const currentValue = storeMetrics.get(entry.metric_name) || 0;
          storeMetrics.set(entry.metric_name, currentValue + (entry.value ? Number(entry.value) : 0));
        });
        
        // Now create entries with recalculated percentages
        aggregatedByStoreDept.forEach((storeMetrics, storeDeptKey) => {
          // Find the first entry for this store/dept to get metadata
          const sampleEntry = financialEntries.find(e => 
            `${(e as any)?.departments?.store_id}-${(e as any)?.departments?.id}` === storeDeptKey
          );
          
          if (!sampleEntry) return;
          
          const storeId = (sampleEntry as any)?.departments?.store_id || "";
          const storeName = (sampleEntry as any)?.departments?.stores?.name || "";
          const deptId = (sampleEntry as any)?.departments?.id;
          const deptName = (sampleEntry as any)?.departments?.name;
          
          // Process each metric
          storeMetrics.forEach((aggregatedValue, metricKey) => {
            const metricDef = keyToDef.get(metricKey);
            let finalValue = aggregatedValue;
            
            // Recalculate percentages from aggregated dollar values
            if (metricDef?.type === 'percentage' && metricDef?.calculation) {
              const calc = metricDef.calculation;
              if ('numerator' in calc && 'denominator' in calc) {
                const num = storeMetrics.get(calc.numerator) || 0;
                const denom = storeMetrics.get(calc.denominator) || 0;
                finalValue = denom !== 0 ? (num / denom) * 100 : 0;
              }
            }
            
            const metricName = keyToName.get(metricKey) || metricKey;
            const entryKey = `${storeId}-${deptId}-${metricKey}`;
            
            // Get comparison baseline for this metric
            const comparisonKey = `${deptId}-${metricKey}`;
            const comparisonInfo = comparisonMap.get(comparisonKey);
            
            dataMap[entryKey] = {
              storeId,
              storeName,
              departmentId: deptId,
              departmentName: deptName,
              metricName,
              value: finalValue,
              target: comparisonInfo?.value || null,
              variance: null,
            };
            
            // Calculate variance
            if (finalValue !== null && comparisonInfo?.value) {
              const baseline = comparisonInfo.value;
              if (baseline !== 0) {
                const variance = ((finalValue - baseline) / Math.abs(baseline)) * 100;
                const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === 'below';
                dataMap[entryKey].variance = shouldReverse ? -variance : variance;
              }
            }
          });
          
          // Calculate derived dollar metrics (like department_profit) from aggregated base values
          metrics.forEach((metricDef: any) => {
            if (metricDef.type === 'dollar' && metricDef.calculation) {
              const calc = metricDef.calculation;
              let calculatedValue: number | null = null;
              
              if (calc.type === 'subtract') {
                const base = storeMetrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = storeMetrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                }
              } else if (calc.type === 'complex') {
                const base = storeMetrics.get(calc.base);
                if (base !== undefined) {
                  calculatedValue = base;
                  (calc.deductions || []).forEach((d: string) => {
                    const val = storeMetrics.get(d);
                    if (val !== undefined) calculatedValue! -= val;
                  });
                  (calc.additions || []).forEach((a: string) => {
                    const val = storeMetrics.get(a);
                    if (val !== undefined) calculatedValue! += val;
                  });
                }
              }
              
              if (calculatedValue !== null) {
                // Store calculated value for use in percentage calculations
                storeMetrics.set(metricDef.key, calculatedValue);
                
                const metricName = metricDef.name;
                const entryKey = `${storeId}-${deptId}-${metricDef.key}`;
                const comparisonKey = `${deptId}-${metricDef.key}`;
                const comparisonInfo = comparisonMap.get(comparisonKey);
                
                dataMap[entryKey] = {
                  storeId,
                  storeName,
                  departmentId: deptId,
                  departmentName: deptName,
                  metricName,
                  value: calculatedValue,
                  target: comparisonInfo?.value || null,
                  variance: null,
                };
                
                // Calculate variance
                if (comparisonInfo?.value && comparisonInfo.value !== 0) {
                  const variance = ((calculatedValue - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
                  const shouldReverse = comparisonMode === "targets" && metricDef.targetDirection === 'below';
                  dataMap[entryKey].variance = shouldReverse ? -variance : variance;
                }
              }
            }
          });
          
          // Recalculate percentages again after derived dollar metrics are computed
          // This handles metrics like Return on Gross % that depend on department_profit
          metrics.forEach((metricDef: any) => {
            if (metricDef.type === 'percentage' && metricDef.calculation) {
              const calc = metricDef.calculation;
              if ('numerator' in calc && 'denominator' in calc) {
                const num = storeMetrics.get(calc.numerator);
                const denom = storeMetrics.get(calc.denominator);
                
                if (num !== undefined && denom !== undefined && denom !== 0) {
                  const finalValue = (num / denom) * 100;
                  const metricName = metricDef.name;
                  const entryKey = `${storeId}-${deptId}-${metricDef.key}`;
                  const comparisonKey = `${deptId}-${metricDef.key}`;
                  const comparisonInfo = comparisonMap.get(comparisonKey);
                  
                  dataMap[entryKey] = {
                    storeId,
                    storeName,
                    departmentId: deptId,
                    departmentName: deptName,
                    metricName,
                    value: finalValue,
                    target: comparisonInfo?.value || null,
                    variance: null,
                  };
                  
                  // Calculate variance
                  if (comparisonInfo?.value && comparisonInfo.value !== 0) {
                    const variance = ((finalValue - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
                    const shouldReverse = comparisonMode === "targets" && metricDef.targetDirection === 'below';
                    dataMap[entryKey].variance = shouldReverse ? -variance : variance;
                  }
                }
              }
            }
          });
        });
      } else {
        // Single month - process entries directly
        financialEntries.forEach(entry => {
          const metricName = keyToName.get(entry.metric_name) || entry.metric_name;
          if (entry.metric_name === 'total_direct_expenses') {
            console.log("Found total_direct_expenses entry:", {
              metric_name: entry.metric_name,
              mapped_name: metricName,
              value: entry.value,
              store: (entry as any)?.departments?.stores?.name,
              dept: (entry as any)?.departments?.name
            });
          }
          const storeId = (entry as any)?.departments?.store_id || "";
          const storeName = (entry as any)?.departments?.stores?.name || "";
          const deptId = (entry as any)?.departments?.id;
          const deptName = (entry as any)?.departments?.name;
          const key = `${storeId}-${deptId}-${entry.metric_name}`;
          
          // Get comparison baseline for this metric
          const comparisonKey = `${deptId}-${entry.metric_name}`;
          const comparisonInfo = comparisonMap.get(comparisonKey);
          
          dataMap[key] = {
            storeId,
            storeName,
            departmentId: deptId,
            departmentName: deptName,
            metricName,
            value: entry.value ? Number(entry.value) : null,
            target: comparisonInfo?.value || null,
            variance: null,
          };
          
          // Calculate variance if both value and comparison baseline exist
          if (dataMap[key].value !== null && dataMap[key].target !== null) {
            const value = dataMap[key].value!;
            const baseline = dataMap[key].target!;
            const metricDef = keyToDef.get(entry.metric_name);
            
            if (baseline !== 0) {
              const variance = ((value - baseline) / Math.abs(baseline)) * 100;
              // Reverse sign if target direction is "below" (lower is better)
              const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === 'below';
              dataMap[key].variance = shouldReverse ? -variance : variance;
            }
          }
        });
      }
      
      // If Fixed Combined, aggregate Parts and Service data
      if (isFixedCombined) {
        const combinedByStore = new Map<string, Map<string, number>>();
        
        // First pass: aggregate base dollar values from Parts and Service (only metrics without calculations)
        Object.values(dataMap).forEach(entry => {
          const isParts = entry.departmentName?.toLowerCase().includes('parts');
          const isService = entry.departmentName?.toLowerCase().includes('service');
          
          if (isParts || isService) {
            const metricKey = nameToKey.get(entry.metricName);
            const metricDef = metricKey ? keyToDef.get(metricKey) : null;
            
            // Only aggregate base dollar metrics (those without calculation formulas)
            if (metricKey && metricDef?.type === 'dollar' && !metricDef.calculation) {
              if (!combinedByStore.has(entry.storeId)) {
                combinedByStore.set(entry.storeId, new Map());
              }
              const storeMetrics = combinedByStore.get(entry.storeId)!;
              const currentValue = storeMetrics.get(metricKey) || 0;
              storeMetrics.set(metricKey, currentValue + (entry.value || 0));
            }
          }
        });
        
        // Helper function to calculate derived metrics
        const calculateDerivedMetric = (storeMetrics: Map<string, number>, metricDef: any): number => {
          if (!metricDef.calculation) return 0;
          
          const calc = metricDef.calculation;
          
          if ('numerator' in calc && 'denominator' in calc) {
            // Simple ratio calculation (typically for percentages but could be dollar amounts)
            const num = storeMetrics.get(calc.numerator) || 0;
            const denom = storeMetrics.get(calc.denominator) || 0;
            return denom !== 0 ? (num / denom) * 100 : 0;
          } else if (calc.type === 'subtract') {
            // Subtraction calculation
            const base = storeMetrics.get(calc.base) || 0;
            const deductions = (calc.deductions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            return base - deductions;
          } else if (calc.type === 'complex') {
            // Complex calculation with additions and deductions
            const base = storeMetrics.get(calc.base) || 0;
            const deductions = (calc.deductions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            const additions = (calc.additions || []).reduce((sum: number, key: string) => {
              return sum + (storeMetrics.get(key) || 0);
            }, 0);
            return base - deductions + additions;
          }
          
          return 0;
        };
        
        // Second pass: calculate derived dollar metrics (those with calculation formulas)
        combinedByStore.forEach((storeMetrics, storeId) => {
          metrics.forEach((metricDef: any) => {
            if (metricDef.type === 'dollar' && metricDef.calculation) {
              const calculatedValue = calculateDerivedMetric(storeMetrics, metricDef);
              storeMetrics.set(metricDef.key, calculatedValue);
            }
          });
        });
        
        // Third pass: create final data with both dollar and percentage metrics
        const newDataMap: Record<string, ComparisonData> = {};
        
        combinedByStore.forEach((storeMetrics, storeId) => {
          const storeName = Object.values(dataMap).find(d => d.storeId === storeId)?.storeName || '';
          
          // Process all selected metrics
          selectedMetrics.forEach(metricName => {
            const metricKey = nameToKey.get(metricName);
            if (!metricKey) return;
            
            const metricDef = keyToDef.get(metricKey);
            if (!metricDef) return;
            
            let finalValue: number;
            
            if (metricDef.type === 'dollar') {
              // Use aggregated or calculated dollar value
              finalValue = storeMetrics.get(metricKey) || 0;
            } else if (metricDef.type === 'percentage') {
              // Calculate percentage from dollar values
              finalValue = calculateDerivedMetric(storeMetrics, metricDef);
            } else {
              finalValue = 0;
            }
            
            const key = `${storeId}-fixed-combined-${metricKey}`;
            newDataMap[key] = {
              storeId,
              storeName,
              departmentId: undefined,
              departmentName: 'Fixed Combined',
              metricName,
              value: finalValue,
              target: null,
              variance: null,
            };
          });
        });
        
        // Replace dataMap with combined data
        Object.keys(dataMap).forEach(key => delete dataMap[key]);
        Object.assign(dataMap, newDataMap);
      }
      
      // Group by store+department for calculations
      const storeDeptPairs = new Set<string>();
      Object.values(dataMap).forEach(item => {
        storeDeptPairs.add(`${item.storeId}|${item.departmentId}`);
      });
      
      // Calculate derived metrics for each store+dept (do this in 2 passes to handle dependencies)
      for (let pass = 0; pass < 2; pass++) {
        storeDeptPairs.forEach(pair => {
          const [storeId, deptId] = pair.split('|');
          
          // Get all values (including previously calculated ones) for this store+dept
          const allValues = new Map<string, number>();
          Object.entries(dataMap).forEach(([key, data]) => {
            if (data.storeId === storeId && data.departmentId === deptId && data.value !== null) {
              const metricKey = nameToKey.get(data.metricName);
              if (metricKey) {
                allValues.set(metricKey, data.value);
              }
            }
          });
          
          // Get sample entry for store/dept info
          const sampleEntry = Object.values(dataMap).find(
            d => d.storeId === storeId && d.departmentId === deptId
          );
          if (!sampleEntry) return;
          
          // Calculate each selected metric that has a calculation formula
          selectedMetrics.forEach(metricName => {
            const metricKey = nameToKey.get(metricName);
            if (!metricKey) return;
            
            const key = `${storeId}-${deptId}-${metricKey}`;
            if (dataMap[key]) return; // Already exists
            
            const metricDef = keyToDef.get(metricKey);
            if (!metricDef?.calculation) return;
            
            let value: number | null = null;
            const calc = metricDef.calculation;
            
            if ('numerator' in calc && 'denominator' in calc) {
              const num = allValues.get(calc.numerator);
              const denom = allValues.get(calc.denominator);
              if (num !== undefined && denom !== undefined && denom !== 0) {
                value = (num / denom) * 100;
              }
            } else if (calc.type === 'subtract') {
              const base = allValues.get(calc.base);
              if (base !== undefined) {
                value = base;
                calc.deductions.forEach((d: string) => {
                  const val = allValues.get(d);
                  if (val !== undefined) value! -= val;
                });
              }
            } else if (calc.type === 'complex') {
              const base = allValues.get(calc.base);
              if (base !== undefined) {
                value = base;
                calc.deductions.forEach((d: string) => {
                  const val = allValues.get(d);
                  if (val !== undefined) value! -= val;
                });
                calc.additions.forEach((a: string) => {
                  const val = allValues.get(a);
                  if (val !== undefined) value! += val;
                });
              }
            }
            
            if (value !== null) {
              // Get comparison baseline for calculated metric
              const comparisonKey = `${deptId}-${metricKey}`;
              const comparisonInfo = comparisonMap.get(comparisonKey);
              
              dataMap[key] = {
                storeId,
                storeName: sampleEntry.storeName,
                departmentId: deptId,
                departmentName: sampleEntry.departmentName,
                metricName,
                value,
                target: comparisonInfo?.value || null,
                variance: null,
              };
              
              // Calculate variance for calculated metrics
              if (comparisonInfo && comparisonInfo.value !== 0) {
                const variance = ((value - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
                const shouldReverse = comparisonMode === "targets" && metricDef?.targetDirection === 'below';
                dataMap[key].variance = shouldReverse ? -variance : variance;
              }
            }
          });
        });
      }
      
      // Build complete list of all store+dept combinations from initial department IDs
      const allDepts = new Map<string, { storeId: string; storeName: string; deptId: string; deptName: string }>();
      
      // First pass: collect all store+dept info from entries
      financialEntries.forEach(entry => {
        const storeId = (entry as any)?.departments?.store_id || "";
        const storeName = (entry as any)?.departments?.stores?.name || "";
        const deptId = (entry as any)?.departments?.id;
        const deptName = (entry as any)?.departments?.name;
        
        if (storeId && deptId) {
          const key = `${storeId}-${deptId}`;
          if (!allDepts.has(key)) {
            allDepts.set(key, { storeId, storeName, deptId, deptName });
          }
        }
      });
      
      // Ensure ALL metrics in dataMap are included (even if not in selectedMetrics) for proper calculations
      // But only display selectedMetrics in final output
      const allMetricKeys = Array.from(keyToName.keys());
      
      // For each store+dept, ensure placeholders exist for all base metrics needed for calculations
      allDepts.forEach(({ storeId, storeName, deptId, deptName }) => {
        allMetricKeys.forEach(metricKey => {
          const metricName = keyToName.get(metricKey);
          if (!metricName) return;
          
          const key = `${storeId}-${deptId}-${metricKey}`;
          
          // Only add placeholder if it doesn't exist
          if (!dataMap[key]) {
            // Check if this metric is in selectedMetrics - if not, only add if it's needed for calculations
            const metricDef = keyToDef.get(metricKey);
            const isSelected = selectedMetrics.includes(metricName);
            
            // Add placeholder for selected metrics or metrics needed for calculations
            if (isSelected) {
              const comparisonKey = `${deptId}-${metricKey}`;
              const comparisonInfo = comparisonMap.get(comparisonKey);
              
              dataMap[key] = {
                storeId,
                storeName,
                departmentId: deptId,
                departmentName: deptName,
                metricName,
                value: null,
                target: comparisonInfo?.value || null,
                variance: null,
              };
            }
          }
        });
      });
      
      // Filter to only selected metrics
      const result = Object.values(dataMap).filter(item => 
        selectedMetrics.includes(item.metricName)
      );
      
      console.log("DealerComparison - Final comparison data:", result.length, "entries");
      console.log("DealerComparison - Has Total Direct Expenses?", result.some(r => r.metricName === "Total Direct Expenses"));
      console.log("DealerComparison - Total Direct Expenses entries:", result.filter(r => r.metricName === "Total Direct Expenses"));
      setComparisonData(result);
      setLastRefresh(new Date());
    }
  }, [financialEntries, financialTargets, currentYearData, previousYearData, metricType, selectedMetrics, comparisonMode]);

  useEffect(() => {
    if (metricType !== "financial" && kpiDefinitions && scorecardEntries) {
      const updatedData = scorecardEntries
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
        .filter(Boolean) as ComparisonData[];
      setComparisonData(updatedData);
      setLastRefresh(new Date());
    }
  }, [kpiDefinitions, scorecardEntries, metricType, selectedMetrics]);

  const handleManualRefresh = () => {
    if (metricType === "financial") {
      refetchFinancial();
    } else {
      refetchKPIs();
      refetchScorecard();
    }
  };

  // Group data by store (use initialData to get all selected stores)
  const uniqueStoreIds = useMemo(() => {
    return Array.from(new Set(initialData.map(d => d.storeId)));
  }, [initialData]);

  const storeData = comparisonData.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        metrics: {},
      };
    }
    if (!acc[item.storeId].metrics[item.metricName]) {
      acc[item.storeId].metrics[item.metricName] = {
        value: item.value,
        target: item.target,
        variance: item.variance,
      };
    }
    return acc;
  }, {} as Record<string, { storeName: string; metrics: Record<string, { value: number | null; target: number | null; variance: number | null }> }>);

  // Sort stores by the selected metric (best/highest values first = left side)
  let stores = Object.entries(storeData);
  
  if (sortByMetric) {
    stores = stores.sort(([, aData], [, bData]) => {
      const aValue = aData.metrics[sortByMetric]?.value ?? -Infinity;
      const bValue = bData.metrics[sortByMetric]?.value ?? -Infinity;
      // Sort descending (highest/best first on the left)
      return bValue - aValue;
    });
  }

  // Calculate data completeness for each store
  const storeDataCompleteness = useMemo(() => {
    if (!financialEntries || financialEntries.length === 0) return {};
    
    // Get months in the selected period
    let expectedMonths: string[] = [];
    const currentDate = new Date();
    const currentMonth = format(currentDate, 'yyyy-MM');
    
    if (datePeriodType === "month") {
      expectedMonths = [selectedMonth || currentMonth];
    } else if (datePeriodType === "full_year") {
      const year = selectedYear || currentDate.getFullYear();
      // Only expect months up to current month if it's the current year
      const maxMonth = year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;
      for (let m = 1; m <= maxMonth; m++) {
        expectedMonths.push(`${year}-${String(m).padStart(2, '0')}`);
      }
    } else if (datePeriodType === "custom_range" && startMonth && endMonth) {
      let current = new Date(startMonth + '-01');
      const end = new Date(endMonth + '-01');
      while (current <= end) {
        const monthStr = format(current, 'yyyy-MM');
        // Don't expect future months
        if (monthStr <= currentMonth) {
          expectedMonths.push(monthStr);
        }
        current.setMonth(current.getMonth() + 1);
      }
    }
    
    // Group entries by store and track which months have data
    const completeness: Record<string, { 
      monthsWithData: Set<string>;
      expectedMonths: string[];
      lastCompleteMonth: string | null;
      isComplete: boolean;
    }> = {};
    
    financialEntries.forEach(entry => {
      const storeId = (entry as any)?.departments?.store_id;
      if (!storeId) return;
      
      if (!completeness[storeId]) {
        completeness[storeId] = {
          monthsWithData: new Set(),
          expectedMonths,
          lastCompleteMonth: null,
          isComplete: false,
        };
      }
      
      if (entry.month && entry.value !== null) {
        completeness[storeId].monthsWithData.add(entry.month);
      }
    });
    
    // Calculate last complete month for each store
    Object.values(completeness).forEach(store => {
      const sortedMonths = [...store.monthsWithData].sort();
      store.lastCompleteMonth = sortedMonths.length > 0 ? sortedMonths[sortedMonths.length - 1] : null;
      store.isComplete = expectedMonths.every(m => store.monthsWithData.has(m));
    });
    
    return completeness;
  }, [financialEntries, datePeriodType, selectedMonth, selectedYear, startMonth, endMonth]);

  const formatMonthShort = (month: string) => {
    const date = new Date(month + '-15');
    return format(date, 'MMM yyyy');
  };

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "secondary";
    // Green: 10% or more above target
    if (variance >= 10) return "default"; // Green indicator
    // Yellow: Within ±10% of target  
    if (variance >= -10) return "secondary"; // Yellow indicator
    // Red: More than 10% below target
    return "destructive"; // Red indicator
  };

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null) return "N/A";
    
    // Get metric definition to check type
    const metrics = getMetricsForBrand(null);
    const metricDef = metrics.find((m: any) => m.name === metricName);
    
    // Check if it's a percentage metric by type or name
    if (metricDef?.type === "percentage" || metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
      return `${value.toFixed(1)}%`;
    }
    
    // Format as currency for dollar metrics
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[2000px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/enterprise")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Dealer Comparison Dashboard</h1>
            <p className="text-muted-foreground">
              Comparing {uniqueStoreIds.length} stores across {selectedMetrics.length} metrics
              {selectedMonth && ` • ${selectedMonth.substring(0, 7) === selectedMonth ? 
                format(new Date(selectedMonth + '-15'), 'MMMM yyyy') : 
                format(new Date(selectedMonth), 'MMMM yyyy')}`}
              {" • "}
              {comparisonMode === "targets" && "vs Store Targets"}
              {comparisonMode === "current_year_avg" && "vs Current Year Average"}
              {comparisonMode === "previous_year" && "vs Previous Year"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()} • Auto-refreshing every 60s
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Now
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailDialogOpen(true)}
            className="gap-2"
            disabled={stores.length === 0}
          >
            <Mail className="h-4 w-4" />
            Email Report
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            {stores.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <p className="text-lg font-semibold text-muted-foreground">No data available</p>
                <p className="text-sm text-muted-foreground">
                  There are no financial entries for the selected period.
                  <br />
                  Please select a different date range or add financial data.
                </p>
                <Button onClick={() => navigate("/enterprise")} variant="outline">
                  Return to Enterprise View
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 border-b-2">
                        <div className="text-base font-bold">Metric</div>
                      </TableHead>
                      {stores.map(([storeId, store]) => {
                        const completeness = storeDataCompleteness[storeId];
                        return (
                          <TableHead key={storeId} className="text-center min-w-[200px] border-b-2">
                            <div className="text-base font-bold">{store.storeName}</div>
                            {completeness && metricType === "financial" && datePeriodType !== "month" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center justify-center gap-1 mt-1">
                                      {completeness.isComplete ? (
                                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      ) : (
                                        <AlertCircle className="h-3 w-3 text-yellow-500" />
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        {completeness.lastCompleteMonth 
                                          ? `Thru ${formatMonthShort(completeness.lastCompleteMonth)}`
                                          : 'No data'}
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="text-xs">
                                      <p className="font-medium mb-1">
                                        {completeness.isComplete 
                                          ? 'All months have data' 
                                          : `${completeness.monthsWithData.size} of ${completeness.expectedMonths.length} months have data`}
                                      </p>
                                      <p className="text-muted-foreground">
                                        Latest: {completeness.lastCompleteMonth 
                                          ? formatMonthShort(completeness.lastCompleteMonth) 
                                          : 'None'}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMetrics.map((metric) => {
                      const isSortedRow = sortByMetric && metric === sortByMetric;
                      return (
                      <TableRow key={metric} className={isSortedRow ? "bg-primary/10" : ""}>
                        <TableCell className={`font-medium sticky left-0 z-10 ${isSortedRow ? "bg-primary/10 font-semibold text-primary" : "bg-background"}`}>
                          {metric}
                        </TableCell>
                        {stores.map(([storeId, store]) => {
                          const metricData = store.metrics[metric];
                          return (
                            <TableCell key={storeId} className="text-center">
                              {metricData ? (
                                <div className="space-y-2">
                                  <div className="text-lg font-semibold">
                                    {formatValue(metricData.value, metric)}
                                  </div>
                                  {metricData.target !== null && (
                                    <div className="text-xs text-muted-foreground">
                                      Target: {formatValue(metricData.target, metric)}
                                    </div>
                                  )}
                                  {metricData.variance !== null && (
                                    <Badge variant={getVarianceColor(metricData.variance)}>
                                      {metricData.variance >= 0 ? "+" : ""}
                                      {metricData.variance.toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No data</span>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Email Dialog */}
      <EmailComparisonDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        storeIds={uniqueStoreIds}
        stores={stores.map(([storeId, store]) => {
          const completeness = storeDataCompleteness[storeId];
          return {
            storeId,
            storeName: store.storeName,
            monthsWithData: completeness ? Array.from(completeness.monthsWithData) : [],
            lastCompleteMonth: completeness?.lastCompleteMonth || null,
            isComplete: completeness?.isComplete || false,
          };
        })}
        metrics={selectedMetrics.map(metricName => ({
          metricName,
          storeValues: stores.reduce((acc, [storeId, store]) => {
            const metricData = store.metrics[metricName];
            acc[storeId] = metricData || { value: null, target: null, variance: null };
            return acc;
          }, {} as Record<string, { value: number | null; target: number | null; variance: number | null }>),
        }))}
        selectedMetrics={selectedMetrics}
        datePeriodType={datePeriodType}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        startMonth={startMonth}
        endMonth={endMonth}
        comparisonMode={comparisonMode}
      />
    </div>
  );
}
