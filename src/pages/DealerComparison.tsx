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
import { processFinancialData, FinancialEntry } from "@/utils/financialCalculations";

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
      
      // Use centralized calculation utility
      const result = processFinancialData(
        financialEntries as unknown as FinancialEntry[],
        {
          datePeriodType: (datePeriodType || "month") as "month" | "full_year" | "custom_range",
          isFixedCombined,
          selectedMetrics,
          comparisonMode,
          comparisonMap,
        }
      );
      
      console.log("DealerComparison - Final comparison data:", result.length, "entries");
      setComparisonData(result);
      setLastRefresh(new Date());
    }
  }, [financialEntries, financialTargets, currentYearData, previousYearData, metricType, selectedMetrics, comparisonMode, datePeriodType, isFixedCombined]);

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
