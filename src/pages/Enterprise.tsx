import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft, CalendarIcon, Save, Bookmark, Trash2, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FixedCombinedTrendView } from "@/components/enterprise/FixedCombinedTrendView";
import { KPITrendView } from "@/components/enterprise/KPITrendView";

type FilterMode = "brand" | "group" | "custom";
type MetricType = "weekly" | "monthly" | "financial" | "dept_info";
type ComparisonMode = "none" | "targets" | "year_over_year" | "previous_year";
type DatePeriodType = "month" | "full_year" | "custom_range";
type ViewMode = "filters" | "trend" | "kpi_trend";

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
  const [viewMode, setViewMode] = useState<ViewMode>("filters");
  const [trendReportParams, setTrendReportParams] = useState<{
    storeIds: string[];
    selectedMetrics: string[];
    startMonth: string;
    endMonth: string;
    brandDisplayName: string;
    filterName: string;
  } | null>(null);
  const [kpiTrendParams, setKpiTrendParams] = useState<{
    storeIds: string[];
    selectedDepartmentNames: string[];
    selectedMetrics: string[];
    startMonth: string;
    endMonth: string;
    brandDisplayName: string;
    filterName: string;
  } | null>(null);

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

  // Track currently loaded filter name
  const [loadedFilterName, setLoadedFilterName] = useState<string>("");

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
    setLoadedFilterName(filter.name);
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

  // Fetch questionnaire questions for dept_info type
  const { data: questionnaireQuestions } = useQuery({
    queryKey: ["questionnaire_questions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_questions")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: metricType === "dept_info",
  });

  // Fetch KPI definitions for weekly/monthly types
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["enterprise_kpi_definitions", departmentIds, metricType],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("id, name, metric_type, department_id")
        .in("department_id", departmentIds)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: departmentIds.length > 0 && (metricType === "weekly" || metricType === "monthly"),
  });

  // Get available metrics based on metric type
  const availableMetrics = useMemo(() => {
    if (metricType === "financial") {
      const firstStore = filteredStores[0];
      const brand = firstStore?.brand || (firstStore?.brands as any)?.name || null;
      const metrics = getMetricsForBrand(brand);
      return metrics;
    }
    if (metricType === "dept_info" && questionnaireQuestions) {
      // Return questions as metrics
      return questionnaireQuestions.map(q => ({
        id: q.id,
        name: q.question_text,
        category: q.question_category,
        answerType: q.answer_type,
      }));
    }
    // For weekly/monthly KPIs, get unique KPI names from definitions
    if ((metricType === "weekly" || metricType === "monthly") && kpiDefinitions) {
      const uniqueNames = [...new Set(kpiDefinitions.map(k => k.name))];
      return uniqueNames.map(name => ({
        id: name,
        name: name,
      }));
    }
    return [];
  }, [metricType, filteredStores, questionnaireQuestions, kpiDefinitions]);

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

  // Auto-select all metrics when switching types (only if none are selected)
  useEffect(() => {
    if (availableMetrics.length > 0 && selectedMetrics.length === 0) {
      const metricNames = availableMetrics.map((m: any) => m.name);
      setSelectedMetrics(metricNames);
    }
  }, [metricType, availableMetrics]);

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

  // Show KPI trend report view
  if (viewMode === "kpi_trend" && kpiTrendParams) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[2000px] mx-auto">
          <KPITrendView
            storeIds={kpiTrendParams.storeIds}
            selectedDepartmentNames={kpiTrendParams.selectedDepartmentNames}
            selectedMetrics={kpiTrendParams.selectedMetrics}
            startMonth={kpiTrendParams.startMonth}
            endMonth={kpiTrendParams.endMonth}
            brandDisplayName={kpiTrendParams.brandDisplayName}
            filterName={kpiTrendParams.filterName}
            onBack={() => setViewMode("filters")}
          />
        </div>
      </div>
    );
  }

  // Show financial trend report view
  if (viewMode === "trend" && trendReportParams) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[2000px] mx-auto">
          <FixedCombinedTrendView
            storeIds={trendReportParams.storeIds}
            selectedMetrics={trendReportParams.selectedMetrics}
            startMonth={trendReportParams.startMonth}
            endMonth={trendReportParams.endMonth}
            brandDisplayName={trendReportParams.brandDisplayName}
            filterName={trendReportParams.filterName}
            onBack={() => setViewMode("filters")}
          />
        </div>
      </div>
    );
  }

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                    <SelectItem value="dept_info">Service Dept Info</SelectItem>
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
                      <SelectItem value="year_over_year">Year over Year</SelectItem>
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
                        <Select 
                          value={format(startMonth, "yyyy-MM")} 
                          onValueChange={(value) => {
                            const [year, month] = value.split('-');
                            setStartMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue>
                              {format(startMonth, "MMM yyyy")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background max-h-[300px]">
                            {Array.from({ length: 36 }, (_, i) => {
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
                      <div>
                        <label className="text-sm font-medium mb-2 block">End Month</label>
                        <Select 
                          value={format(endMonth, "yyyy-MM")} 
                          onValueChange={(value) => {
                            const [year, month] = value.split('-');
                            setEndMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                          }}
                        >
                          <SelectTrigger className="bg-background">
                            <SelectValue>
                              {format(endMonth, "MMM yyyy")}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="bg-background max-h-[300px]">
                            {Array.from({ length: 36 }, (_, i) => {
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

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Dealer Comparison
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredStores.length} stores, {selectedMetrics.length} metrics)
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Ready to Compare</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {filteredStores.length === 0 
                    ? "Select stores from the filter options to begin comparison."
                    : selectedMetrics.length === 0
                    ? "Select metrics to compare across your selected stores."
                    : `Compare ${selectedMetrics.length} metrics across ${filteredStores.length} stores.`
                  }
                </p>
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
                      
                      // Determine brand display name
                      let brandDisplayName = "All Brands";
                      if (filterMode === "brand" && selectedBrandIds.length > 0) {
                        const selectedBrandNames = brands
                          ?.filter(b => selectedBrandIds.includes(b.id))
                          .map(b => b.name) || [];
                        brandDisplayName = selectedBrandNames.length === 1 
                          ? selectedBrandNames[0] 
                          : selectedBrandNames.join(", ");
                      }
                      
                      navigate("/dealer-comparison", {
                        state: {
                          metricType,
                          selectedMetrics,
                          ...dateParams,
                          comparisonMode,
                          departmentIds,
                          isFixedCombined: selectedDepartmentNames.includes('Fixed Combined'),
                          selectedDepartmentNames,
                          sortByMetric,
                          storeIds: filteredStores.map(s => s.id),
                          brandDisplayName,
                          filterName: loadedFilterName,
                        }
                      });
                    }}
                    disabled={filteredStores.length === 0 || selectedMetrics.length === 0}
                    size="lg"
                  >
                    View Dashboard
                  </Button>
                  {selectedDepartmentNames.includes('Fixed Combined') && metricType === 'financial' && (
                    <Button
                      onClick={() => {
                        // Default to last 12 months if not custom range
                        const today = new Date();
                        const start = datePeriodType === 'custom_range' 
                          ? format(startMonth, 'yyyy-MM')
                          : format(new Date(today.getFullYear(), today.getMonth() - 11, 1), 'yyyy-MM');
                        const end = datePeriodType === 'custom_range'
                          ? format(endMonth, 'yyyy-MM')
                          : format(today, 'yyyy-MM');
                        
                        let brandDisplayName = "All Brands";
                        if (filterMode === "brand" && selectedBrandIds.length > 0) {
                          const selectedBrandNames = brands
                            ?.filter(b => selectedBrandIds.includes(b.id))
                            .map(b => b.name) || [];
                          brandDisplayName = selectedBrandNames.length === 1 
                            ? selectedBrandNames[0] 
                            : selectedBrandNames.join(", ");
                        }
                        
                        setTrendReportParams({
                          storeIds: filteredStores.map(s => s.id),
                          selectedMetrics,
                          startMonth: start,
                          endMonth: end,
                          brandDisplayName,
                          filterName: loadedFilterName,
                        });
                        setViewMode("trend");
                      }}
                      disabled={filteredStores.length === 0 || selectedMetrics.length === 0}
                      size="lg"
                      variant="outline"
                      className="gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Monthly Trend Report
                    </Button>
                  )}
                  {metricType === 'monthly' && (
                    <Button
                      onClick={() => {
                        // Default to last 12 months
                        const today = new Date();
                        const start = format(new Date(today.getFullYear(), today.getMonth() - 11, 1), 'yyyy-MM');
                        const end = format(today, 'yyyy-MM');
                        
                        let brandDisplayName = "All Brands";
                        if (filterMode === "brand" && selectedBrandIds.length > 0) {
                          const selectedBrandNames = brands
                            ?.filter(b => selectedBrandIds.includes(b.id))
                            .map(b => b.name) || [];
                          brandDisplayName = selectedBrandNames.length === 1 
                            ? selectedBrandNames[0] 
                            : selectedBrandNames.join(", ");
                        }
                        
                        setKpiTrendParams({
                          storeIds: filteredStores.map(s => s.id),
                          selectedDepartmentNames,
                          selectedMetrics,
                          startMonth: start,
                          endMonth: end,
                          brandDisplayName,
                          filterName: loadedFilterName,
                        });
                        setViewMode("kpi_trend");
                      }}
                      disabled={filteredStores.length === 0 || selectedMetrics.length === 0}
                      size="lg"
                      variant="outline"
                      className="gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      KPI Monthly Trend
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
