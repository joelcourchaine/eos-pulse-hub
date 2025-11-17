import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MetricComparisonTable from "@/components/enterprise/MetricComparisonTable";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterMode = "group" | "brand" | "custom";
type MetricType = "weekly" | "monthly" | "financial";

export default function Enterprise() {
  const navigate = useNavigate();
  const [filterMode, setFilterMode] = useState<FilterMode>("group");
  const [metricType, setMetricType] = useState<MetricType>("weekly");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

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
      case "group":
        if (selectedGroupIds.length === 0) return [];
        return stores.filter(store => 
          store.group_id && selectedGroupIds.includes(store.group_id)
        );
      case "brand":
        if (selectedBrandIds.length === 0) return [];
        return stores.filter(store => 
          store.brand_id && selectedBrandIds.includes(store.brand_id)
        );
      case "custom":
        return stores.filter(store => selectedStoreIds.includes(store.id));
      default:
        return [];
    }
  }, [stores, filterMode, selectedGroupIds, selectedBrandIds, selectedStoreIds]);

  const storeIds = filteredStores.map(s => s.id);

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

  const departmentIds = departments?.map(d => d.id) || [];

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
  const { data: financialEntries } = useQuery({
    queryKey: ["financial_entries", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(name, store_id, stores(name))")
        .in("department_id", departmentIds)
        .order("month", { ascending: false });
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
      return getMetricsForBrand(brand).map(m => m.name);
    } else if (kpiDefinitions) {
      return Array.from(new Set(kpiDefinitions.map(k => k.name)));
    }
    return [];
  }, [metricType, kpiDefinitions, filteredStores]);

  // Prepare comparison data
  const comparisonData = useMemo(() => {
    if (metricType === "financial" && financialEntries && departments) {
      return financialEntries
        .filter(entry => selectedMetrics.includes(entry.metric_name))
        .map(entry => {
          const dept = departments.find(d => d.id === entry.department_id);
          return {
            storeId: dept?.store_id || "",
            storeName: (dept as any)?.stores?.name || "",
            departmentId: dept?.id,
            departmentName: dept?.name,
            metricName: entry.metric_name,
            value: entry.value ? Number(entry.value) : null,
            target: null,
            variance: null,
          };
        });
    } else if (kpiDefinitions && scorecardEntries) {
      return scorecardEntries
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
    }
    return [];
  }, [metricType, financialEntries, departments, kpiDefinitions, scorecardEntries, selectedMetrics]);

  const toggleStoreSelection = (storeId: string) => {
    setSelectedStoreIds(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleBrandSelection = (brandId: string) => {
    setSelectedBrandIds(prev =>
      prev.includes(brandId)
        ? prev.filter(id => id !== brandId)
        : [...prev, brandId]
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
                  <TabsTrigger value="group">Group</TabsTrigger>
                  <TabsTrigger value="brand">Brand</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>

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

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Metrics ({selectedMetrics.length} selected)
                </label>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-3">
                    {availableMetrics.map((metric) => (
                      <div key={metric} className="flex items-center space-x-2">
                        <Checkbox
                          id={`metric-${metric}`}
                          checked={selectedMetrics.includes(metric)}
                          onCheckedChange={() => toggleMetricSelection(metric)}
                        />
                        <label
                          htmlFor={`metric-${metric}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {metric}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  Dealer Comparison
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({filteredStores.length} stores, {selectedMetrics.length} metrics)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MetricComparisonTable
                  data={comparisonData}
                  metricType={metricType}
                  selectedMetrics={selectedMetrics}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
