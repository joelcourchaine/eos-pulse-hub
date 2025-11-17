import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand } from "@/config/financialMetrics";

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

  const { data: initialData, metricType, selectedMetrics } = location.state as {
    data: ComparisonData[];
    metricType: string;
    selectedMetrics: string[];
  };

  // Initialize with passed data
  useEffect(() => {
    setComparisonData(initialData);
  }, [initialData]);

  // Extract department IDs from the data
  const departmentIds = useMemo(() => {
    return Array.from(new Set(comparisonData.map(d => d.departmentId).filter(Boolean))) as string[];
  }, [comparisonData]);

  // Create metric key map for financial metrics
  const metricKeyMap = useMemo(() => {
    if (metricType === "financial" && comparisonData.length > 0) {
      const map = new Map<string, string>();
      const firstStore = comparisonData[0];
      const metrics = getMetricsForBrand(null); // Get all metrics
      metrics.forEach((m: any) => map.set(m.name, m.key));
      return map;
    }
    return new Map<string, string>();
  }, [metricType, comparisonData]);

  // Fetch financial entries for polling
  const { data: financialEntries, refetch: refetchFinancial } = useQuery({
    queryKey: ["dealer_comparison_financial", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id, stores(name))")
        .in("department_id", departmentIds)
        .order("month", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && metricType === "financial",
    refetchInterval: 60000, // Poll every 60 seconds
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
    if (metricType === "financial" && financialEntries) {
      const selectedKeys = selectedMetrics.map(name => metricKeyMap.get(name) || name);
      const filtered = financialEntries.filter(entry => selectedKeys.includes(entry.metric_name));
      
      const updatedData = filtered.map(entry => {
        const metricDisplayName = Array.from(metricKeyMap.entries()).find(([_, key]) => key === entry.metric_name)?.[0] || entry.metric_name;
        return {
          storeId: (entry as any)?.departments?.store_id || "",
          storeName: (entry as any)?.departments?.stores?.name || "",
          departmentId: (entry as any)?.departments?.id,
          departmentName: (entry as any)?.departments?.name,
          metricName: metricDisplayName,
          value: entry.value ? Number(entry.value) : null,
          target: null,
          variance: null,
        };
      });
      setComparisonData(updatedData);
      setLastRefresh(new Date());
    }
  }, [financialEntries, metricType, selectedMetrics, metricKeyMap]);

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

  // Group data by store
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

  const stores = Object.entries(storeData);

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "secondary";
    if (variance >= 0) return "default";
    return "destructive";
  };

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null) return "N/A";
    
    // Check if it's a percentage metric
    if (metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
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
              Comparing {stores.length} stores across {selectedMetrics.length} metrics
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
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 border-b-2">
                      <div className="text-base font-bold">Metric</div>
                    </TableHead>
                    {stores.map(([storeId, store]) => (
                      <TableHead key={storeId} className="text-center min-w-[200px] border-b-2">
                        <div className="text-base font-bold">{store.storeName}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMetrics.map((metric) => (
                    <TableRow key={metric}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
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
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
