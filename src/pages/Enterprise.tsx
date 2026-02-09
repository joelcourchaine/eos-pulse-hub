import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, ArrowLeft, CalendarIcon, Save, Bookmark, Trash2, TrendingUp, ShieldAlert } from "lucide-react";
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
import { CombinedTrendView } from "@/components/enterprise/CombinedTrendView";
import { PayplanScenariosPanel } from "@/components/enterprise/PayplanScenariosPanel";
import { useUserRole } from "@/hooks/use-user-role";

type FilterMode = "brand" | "group" | "custom";
type MetricType = "weekly" | "monthly" | "financial" | "dept_info" | "monthly_combined";
type ComparisonMode = "none" | "targets" | "year_over_year" | "previous_year";
type DatePeriodType = "month" | "full_year" | "custom_range" | "monthly_trend";
type ViewMode = "filters" | "trend" | "kpi_trend" | "combined_trend";

// Helper to get initial state from sessionStorage
const getStoredState = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = sessionStorage.getItem(`enterprise_${key}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle Date objects
      if (key === 'selectedMonth' || key === 'startMonth' || key === 'endMonth') {
        return new Date(parsed) as T;
      }
      return parsed;
    }
  } catch (e) {
    console.error(`Failed to parse stored ${key}:`, e);
  }
  return defaultValue;
};

export default function Enterprise() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterMode, setFilterMode] = useState<FilterMode>(() => getStoredState('filterMode', 'brand'));
  const [metricType, setMetricType] = useState<MetricType>(() => getStoredState('metricType', 'weekly'));
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => getStoredState('selectedStoreIds', []));
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(() => getStoredState('selectedBrandIds', []));
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() => getStoredState('selectedGroupIds', []));
  const [selectedDepartmentNames, setSelectedDepartmentNames] = useState<string[]>(() => getStoredState('selectedDepartmentNames', []));
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => getStoredState('selectedMetrics', []));
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => getStoredState('selectedMonth', new Date()));
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>(() => getStoredState('comparisonMode', 'none'));
  const [datePeriodType, setDatePeriodType] = useState<DatePeriodType>(() => getStoredState('datePeriodType', 'month'));
  const [selectedYear, setSelectedYear] = useState<number>(() => getStoredState('selectedYear', new Date().getFullYear()));
  const [startMonth, setStartMonth] = useState<Date>(() => getStoredState('startMonth', new Date(new Date().getFullYear(), 0, 1)));
  const [endMonth, setEndMonth] = useState<Date>(() => getStoredState('endMonth', new Date()));
  const [saveFilterName, setSaveFilterName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [sortByMetric, setSortByMetric] = useState<string>(() => getStoredState('sortByMetric', ''));
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
  const [combinedTrendParams, setCombinedTrendParams] = useState<{
    storeIds: string[];
    selectedDepartmentNames: string[];
    selectedKpiMetrics: string[];
    selectedFinancialMetrics: string[];
    startMonth: string;
    endMonth: string;
    brandDisplayName: string;
    filterName: string;
  } | null>(null);
  
  // Separate state for combined metric selection
  const [selectedKpiMetrics, setSelectedKpiMetrics] = useState<string[]>(() => getStoredState('selectedKpiMetrics', []));
  const [selectedFinancialMetrics, setSelectedFinancialMetrics] = useState<string[]>(() => getStoredState('selectedFinancialMetrics', []));
  
  // Filter for showing only department manager owned KPIs
  const [showDeptManagerOnly, setShowDeptManagerOnly] = useState<boolean>(() => getStoredState('showDeptManagerOnly', false));

  // Save state to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('enterprise_filterMode', JSON.stringify(filterMode));
    sessionStorage.setItem('enterprise_metricType', JSON.stringify(metricType));
    sessionStorage.setItem('enterprise_selectedStoreIds', JSON.stringify(selectedStoreIds));
    sessionStorage.setItem('enterprise_selectedBrandIds', JSON.stringify(selectedBrandIds));
    sessionStorage.setItem('enterprise_selectedGroupIds', JSON.stringify(selectedGroupIds));
    sessionStorage.setItem('enterprise_selectedDepartmentNames', JSON.stringify(selectedDepartmentNames));
    sessionStorage.setItem('enterprise_selectedMetrics', JSON.stringify(selectedMetrics));
    sessionStorage.setItem('enterprise_selectedMonth', JSON.stringify(selectedMonth));
    sessionStorage.setItem('enterprise_comparisonMode', JSON.stringify(comparisonMode));
    sessionStorage.setItem('enterprise_datePeriodType', JSON.stringify(datePeriodType));
    sessionStorage.setItem('enterprise_selectedYear', JSON.stringify(selectedYear));
    sessionStorage.setItem('enterprise_startMonth', JSON.stringify(startMonth));
    sessionStorage.setItem('enterprise_endMonth', JSON.stringify(endMonth));
    sessionStorage.setItem('enterprise_sortByMetric', JSON.stringify(sortByMetric));
    sessionStorage.setItem('enterprise_selectedKpiMetrics', JSON.stringify(selectedKpiMetrics));
    sessionStorage.setItem('enterprise_selectedFinancialMetrics', JSON.stringify(selectedFinancialMetrics));
    sessionStorage.setItem('enterprise_showDeptManagerOnly', JSON.stringify(showDeptManagerOnly));
  }, [filterMode, metricType, selectedStoreIds, selectedBrandIds, selectedGroupIds, selectedDepartmentNames, selectedMetrics, selectedMonth, comparisonMode, datePeriodType, selectedYear, startMonth, endMonth, sortByMetric, selectedKpiMetrics, selectedFinancialMetrics, showDeptManagerOnly]);

  // Set default 12-month range when switching to monthly_trend mode
  useEffect(() => {
    if (datePeriodType === 'monthly_trend') {
      const today = new Date();
      const defaultStart = new Date(today.getFullYear(), today.getMonth() - 11, 1);
      setStartMonth(defaultStart);
      setEndMonth(today);
    }
  }, [datePeriodType]);


  const [userId, setUserId] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUserId(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Check user roles
  const { isSuperAdmin, isStoreGM, isDepartmentManager, loading: rolesLoading, roles } = useUserRole(userId);
  
  // Determine if user has access to Enterprise page
  const hasEnterpriseAccess = isSuperAdmin || isStoreGM || isDepartmentManager;
  
  // Redirect unauthorized users - only after roles have been fetched
  useEffect(() => {
    // Wait until we have a userId and roles have been loaded
    if (!userId || rolesLoading) return;
    
    // Only redirect if roles were fetched and user doesn't have access
    if (roles.length > 0 && !hasEnterpriseAccess) {
      toast.error("You don't have access to the Enterprise page");
      navigate("/dashboard");
    }
  }, [rolesLoading, userId, hasEnterpriseAccess, navigate, roles.length]);

  // Fetch user's store group info for non-super-admins
  const { data: userStoreGroupInfo } = useQuery({
    queryKey: ["user_store_group_info", userId],
    queryFn: async () => {
      // Get user's profile with store group info
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("store_group_id, store_id")
        .eq("id", userId!)
        .single();
      
      if (profileError) throw profileError;
      
      let groupId = profile?.store_group_id;
      let groupName = "";
      
      // If no direct store_group_id, get it from the user's store
      if (!groupId && profile?.store_id) {
        const { data: store } = await supabase
          .from("stores")
          .select("group_id, store_groups(name)")
          .eq("id", profile.store_id)
          .single();
        
        groupId = store?.group_id;
        groupName = (store?.store_groups as any)?.name || "";
      } else if (groupId) {
        const { data: group } = await supabase
          .from("store_groups")
          .select("name")
          .eq("id", groupId)
          .single();
        groupName = group?.name || "";
      }
      
      return { groupId, groupName };
    },
    enabled: !isSuperAdmin && !!userId,
  });

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

  // Filter brands to only those with stores in user's group (for non-super-admins)
  const availableBrands = useMemo(() => {
    if (!brands || !stores) return [];
    if (isSuperAdmin) return brands;
    
    // Get brand IDs that have stores the user can see (RLS already filters stores to user's group)
    const brandIdsInUserGroup = new Set(stores.map(s => s.brand_id).filter(Boolean));
    return brands.filter(b => brandIdsInUserGroup.has(b.id));
  }, [brands, stores, isSuperAdmin]);

  // Cascading filter: Available brands filtered by selected groups
  const availableBrandsForFilter = useMemo(() => {
    if (!availableBrands || !stores) return availableBrands || [];
    if (selectedGroupIds.length === 0) return availableBrands;
    
    // Only show brands that have stores in the selected groups
    const brandIdsInSelectedGroups = new Set(
      stores
        .filter(s => s.group_id && selectedGroupIds.includes(s.group_id))
        .map(s => s.brand_id)
        .filter(Boolean)
    );
    return availableBrands.filter(b => brandIdsInSelectedGroups.has(b.id));
  }, [availableBrands, stores, selectedGroupIds]);

  // Cascading filter: Available stores filtered by selected groups AND brands
  const availableStoresForFilter = useMemo(() => {
    if (!stores) return [];
    
    let filtered = [...stores];
    
    // Filter by selected groups (if any)
    if (selectedGroupIds.length > 0) {
      filtered = filtered.filter(s => s.group_id && selectedGroupIds.includes(s.group_id));
    }
    
    // Filter by selected brands (if any)
    if (selectedBrandIds.length > 0) {
      filtered = filtered.filter(s => s.brand_id && selectedBrandIds.includes(s.brand_id));
    }
    
    return filtered;
  }, [stores, selectedGroupIds, selectedBrandIds]);

  // For non-super-admins, stores are already filtered by RLS to their group
  const availableStores = useMemo(() => {
    if (!stores) return [];
    return stores; // RLS already filters to user's group
  }, [stores]);

  const filteredStores = useMemo(() => {
    if (!stores) return [];
    
    let baseStores = [...stores];
    
    // Always apply group filter if groups are selected (cascading down)
    if (selectedGroupIds.length > 0) {
      baseStores = baseStores.filter(s => s.group_id && selectedGroupIds.includes(s.group_id));
    }
    
    switch (filterMode) {
      case "group":
        // Return all stores in selected groups
        return selectedGroupIds.length > 0 ? baseStores : [];
        
      case "brand":
        if (selectedBrandIds.length === 0) return [];
        return baseStores.filter(store => 
          store.brand_id && selectedBrandIds.includes(store.brand_id)
        );
        
      case "custom": // "Stores" tab
        return baseStores.filter(store => selectedStoreIds.includes(store.id));
        
      default:
        return [];
    }
  }, [stores, filterMode, selectedGroupIds, selectedBrandIds, selectedStoreIds]);

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

  // Fetch KPI definitions for weekly/monthly/combined types - only those with scorecard entries
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["enterprise_kpi_definitions", departmentIds, metricType],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      
      // For combined type, we need monthly KPIs
      const entryType = metricType === "monthly_combined" ? "monthly" : metricType;
      
      // First get KPIs with scorecard entries of the matching type - include assigned_to and department manager info
      const { data: entriesWithKpis, error: entriesError } = await supabase
        .from("scorecard_entries")
        .select("kpi_id, kpi_definitions!inner(id, name, metric_type, department_id, display_order, assigned_to, departments(id, manager_id))")
        .eq("entry_type", entryType)
        .in("kpi_definitions.department_id", departmentIds);
      
      if (entriesError) throw entriesError;
      
      // Extract unique KPIs that have entries
      const kpiMap = new Map<string, any>();
      entriesWithKpis?.forEach((entry: any) => {
        const kpi = entry.kpi_definitions;
        if (kpi && !kpiMap.has(kpi.id)) {
          kpiMap.set(kpi.id, {
            ...kpi,
            isDeptManagerOwned: kpi.departments?.manager_id && kpi.assigned_to === kpi.departments.manager_id,
          });
        }
      });
      
      // Sort by display_order
      return Array.from(kpiMap.values()).sort((a, b) => a.display_order - b.display_order);
    },
    enabled: departmentIds.length > 0 && (metricType === "weekly" || metricType === "monthly" || metricType === "monthly_combined"),
  });

  // Fetch sub-metrics from financial_entries for selected departments
  const { data: subMetrics } = useQuery({
    queryKey: ["enterprise_sub_metrics", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return new Map<string, Set<string>>();
      
      // Fetch distinct sub-metric names from financial_entries
      const { data, error } = await supabase
        .from("financial_entries")
        .select("metric_name")
        .in("department_id", departmentIds)
        .like("metric_name", "sub:%");
      
      if (error) throw error;
      
      // Parse sub-metric names and group by parent
      const subMetricMap = new Map<string, Set<string>>();
      
      data?.forEach(entry => {
        const parts = entry.metric_name.split(':');
        if (parts.length >= 4) {
          // Format: sub:parent_key:order:name
          const parentKey = parts[1];
          const name = parts.slice(3).join(':'); // Handle names with colons
          
          if (!subMetricMap.has(parentKey)) {
            subMetricMap.set(parentKey, new Set());
          }
          subMetricMap.get(parentKey)!.add(name);
        }
      });
      
      return subMetricMap;
    },
    enabled: departmentIds.length > 0 && (metricType === "financial" || metricType === "monthly_combined"),
  });

  // Get available metrics based on metric type (including sub-metrics for financial)
  const availableMetrics = useMemo(() => {
    if (metricType === "financial") {
      const firstStore = filteredStores[0];
      const brand = firstStore?.brand || (firstStore?.brands as any)?.name || null;
      const baseMetrics = getMetricsForBrand(brand);
      
      // Include sub-metrics if available
      const subMetricData = subMetrics instanceof Map ? subMetrics : new Map<string, Set<string>>();
      const result: any[] = [];
      
       baseMetrics.forEach((metric: any) => {
         result.push(metric);

         // Check if this metric has sub-metrics.
         // NOTE: percentage metrics with calculations store sub-metrics under their NUMERATOR key
         // (e.g., Sales Expense % uses sub-metrics stored under sales_expense).
         const subMetricSourceKey =
           metric.type === 'percentage' && metric.hasSubMetrics && metric.calculation && 'numerator' in metric.calculation
             ? metric.calculation.numerator
             : metric.key;

         if (subMetricData.has(subMetricSourceKey)) {
           const subNames = Array.from(subMetricData.get(subMetricSourceKey)!).sort();
           subNames.forEach((subName) => {
             result.push({
               name: `↳ ${subName}`,
               // Keep the parent selection keyed to the *visible* metric (metric.key),
               // but we'll read values from subMetricSourceKey when computing.
               key: `sub:${metric.key}:${subName}`,
               type: metric.type,
               isSubMetric: true,
               parentKey: metric.key,
               parentName: metric.name,
             });
           });
         }
       });
      
      return result;
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
      // Filter by department manager ownership if toggle is on
      const filteredKpis = showDeptManagerOnly
        ? kpiDefinitions.filter((k: any) => k.isDeptManagerOwned)
        : kpiDefinitions;
      
      const uniqueNames = [...new Set(filteredKpis.map((k: any) => k.name))];
      return uniqueNames.map(name => ({
        id: name,
        name: name,
      }));
    }
    return [];
  }, [metricType, filteredStores, questionnaireQuestions, kpiDefinitions, subMetrics, showDeptManagerOnly]);

  // Get available KPI metrics for combined view
  const availableKpiMetricsForCombined = useMemo(() => {
    if (metricType !== "monthly_combined" || !kpiDefinitions) return [];
    
    // Filter by department manager ownership if toggle is on
    const filteredKpis = showDeptManagerOnly
      ? kpiDefinitions.filter((k: any) => k.isDeptManagerOwned)
      : kpiDefinitions;
    
    const uniqueNames = [...new Set(filteredKpis.map((k: any) => k.name))];
    return uniqueNames.map(name => ({
      id: name,
      name: name,
    }));
  }, [metricType, kpiDefinitions, showDeptManagerOnly]);

  // Get available financial metrics for combined view (including sub-metrics)
  const availableFinancialMetricsForCombined = useMemo(() => {
    if (metricType !== "monthly_combined") return [];
    const firstStore = filteredStores[0];
    const brand = firstStore?.brand || (firstStore?.brands as any)?.name || null;
    const baseMetrics = getMetricsForBrand(brand);
    
    // Build list with sub-metrics inserted after their parents
    const result: any[] = [];
    const subMetricData = subMetrics instanceof Map ? subMetrics : new Map<string, Set<string>>();
    
     baseMetrics.forEach((metric: any) => {
       result.push(metric);

       const subMetricSourceKey =
         metric.type === 'percentage' && metric.hasSubMetrics && metric.calculation && 'numerator' in metric.calculation
           ? metric.calculation.numerator
           : metric.key;

       // Check if this metric has sub-metrics
       if (subMetricData.has(subMetricSourceKey)) {
         const subNames = Array.from(subMetricData.get(subMetricSourceKey)!).sort();
         subNames.forEach((subName) => {
           result.push({
             name: `↳ ${subName}`,
             key: `sub:${metric.key}:${subName}`,
             type: metric.type,
             isSubMetric: true,
             parentKey: metric.key,
             parentName: metric.name,
           });
         });
       }
     });
    
    return result;
  }, [metricType, filteredStores, subMetrics]);

  // Reset filter mode to "brand" if non-super-admin has "group" selected
  useEffect(() => {
    if (!isSuperAdmin && filterMode === "group") {
      setFilterMode("brand");
    }
  }, [isSuperAdmin, filterMode]);

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

  // Clear selected metrics only when metric type ACTUALLY changes (not on mount/restore)
  const prevMetricTypeRef = useRef(metricType);
  useEffect(() => {
    if (prevMetricTypeRef.current === metricType) {
      // Same value (initial mount or restored from session) — don't clear
      return;
    }
    prevMetricTypeRef.current = metricType;
    setSelectedMetrics([]);
    setSelectedKpiMetrics([]);
    setSelectedFinancialMetrics([]);
  }, [metricType]);

  // Auto-select all metrics when switching types (only if none are selected)
  useEffect(() => {
    if (metricType === "monthly_combined") {
      // For combined, auto-select Total Hours (mandatory for Service) and a few key metrics
      if (selectedKpiMetrics.length === 0 && availableKpiMetricsForCombined.length > 0) {
        const metricNames = availableKpiMetricsForCombined.map((m: any) => m.name);
        // Ensure Total Hours is always included
        if (!metricNames.includes('Total Hours')) {
          setSelectedKpiMetrics(metricNames);
        } else {
          setSelectedKpiMetrics(metricNames);
        }
      }
      if (selectedFinancialMetrics.length === 0 && availableFinancialMetricsForCombined.length > 0) {
        // Only auto-select parent metrics, not sub-metrics
        const parentMetricNames = availableFinancialMetricsForCombined
          .filter((m: any) => !m.isSubMetric)
          .map((m: any) => m.name);
        setSelectedFinancialMetrics(parentMetricNames);
      }
    } else if (availableMetrics.length > 0 && selectedMetrics.length === 0) {
      // Only auto-select parent metrics, not sub-metrics
      const parentMetricIds = availableMetrics
        .filter((m: any) => !m.isSubMetric)
        .map((m: any) => m.name);
      setSelectedMetrics(parentMetricIds);
    }
  }, [metricType, availableMetrics, availableKpiMetricsForCombined, availableFinancialMetricsForCombined]);

  // Check if Service department is selected (for mandatory Total Hours validation)
  const hasServiceDepartment = useMemo(() => {
    return selectedDepartmentNames.some(name => 
      name.toLowerCase().includes('service') || name === 'Fixed Combined'
    );
  }, [selectedDepartmentNames]);

  // Validate Total Hours is selected when Service department is included
  const isTotalHoursRequired = hasServiceDepartment && metricType === "monthly_combined";
  const hasTotalHours = selectedKpiMetrics.includes('Total Hours');
  const isValidCombinedSelection = !isTotalHoursRequired || hasTotalHours;

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

  const toggleKpiMetricSelection = (metric: string) => {
    // Don't allow deselecting Total Hours if Service department is selected
    if (metric === 'Total Hours' && isTotalHoursRequired && selectedKpiMetrics.includes(metric)) {
      return; // Prevent deselection
    }
    setSelectedKpiMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const toggleFinancialMetricSelection = (metric: string) => {
    setSelectedFinancialMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const toggleMetricSelection = (metric: string) => {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  // Show combined trend report view
  if (viewMode === "combined_trend" && combinedTrendParams) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[2000px] mx-auto">
          <CombinedTrendView
            storeIds={combinedTrendParams.storeIds}
            selectedDepartmentNames={combinedTrendParams.selectedDepartmentNames}
            selectedKpiMetrics={combinedTrendParams.selectedKpiMetrics}
            selectedFinancialMetrics={combinedTrendParams.selectedFinancialMetrics}
            startMonth={combinedTrendParams.startMonth}
            endMonth={combinedTrendParams.endMonth}
            brandDisplayName={combinedTrendParams.brandDisplayName}
            filterName={combinedTrendParams.filterName}
            onBack={() => setViewMode("filters")}
          />
        </div>
      </div>
    );
  }

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
            selectedDepartmentNames={selectedDepartmentNames}
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

        {/* Store Group Banner for non-super-admins */}
        {!isSuperAdmin && userStoreGroupInfo?.groupName && (
          <div className="bg-muted/50 border border-border px-4 py-3 rounded-lg flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Viewing reports for: </span>
            <span className="text-sm font-semibold">{userStoreGroupInfo.groupName}</span>
          </div>
        )}

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
                <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {isSuperAdmin && <TabsTrigger value="group">Group</TabsTrigger>}
                  <TabsTrigger value="brand">Brand</TabsTrigger>
                  <TabsTrigger value="custom">Stores</TabsTrigger>
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
                  {selectedGroupIds.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Showing brands with stores in selected group(s)
                    </p>
                  )}
                  <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-3">
                      {availableBrandsForFilter?.map((brand) => (
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
                  {(selectedGroupIds.length > 0 || selectedBrandIds.length > 0) && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Filtered by {selectedGroupIds.length > 0 ? 'group' : ''}{selectedGroupIds.length > 0 && selectedBrandIds.length > 0 ? ' & ' : ''}{selectedBrandIds.length > 0 ? 'brand' : ''} selection
                    </p>
                  )}
                  <ScrollArea className="h-[280px] pr-4">
                    <div className="space-y-3">
                      {availableStoresForFilter?.map((store) => (
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
                            {store.brands && (
                              <span className="text-muted-foreground ml-1">
                                ({(store.brands as any).name})
                              </span>
                            )}
                            {store.store_groups && (
                              <span className="text-muted-foreground ml-1">
                                • {(store.store_groups as any).name}
                              </span>
                            )}
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
                    <SelectItem value="monthly_combined">Monthly Combined (KPI + Financial)</SelectItem>
                    <SelectItem value="dept_info">Service Dept Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {metricType === "monthly_combined" && (
                <div className="p-3 bg-muted rounded-md text-sm">
                  <p className="font-medium mb-1">Combined Report</p>
                  <p className="text-muted-foreground text-xs">
                    Combines monthly KPI scorecard and financial metrics with quarterly weighting.
                    {isTotalHoursRequired && " Total Hours is required for Service department."}
                  </p>
                </div>
              )}

              {(metricType === "monthly" || metricType === "monthly_combined") && (
                <div className="flex items-center space-x-2 pt-1">
                  <Checkbox
                    id="dept-manager-only"
                    checked={showDeptManagerOnly}
                    onCheckedChange={(checked) => setShowDeptManagerOnly(!!checked)}
                  />
                  <label
                    htmlFor="dept-manager-only"
                    className="text-sm cursor-pointer leading-none"
                  >
                    Show only Department Manager owned KPIs
                  </label>
                </div>
              )}

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
                        <SelectItem value="monthly_trend">12 Month Trend</SelectItem>
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
                  ) : datePeriodType === "custom_range" ? (
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
                  ) : datePeriodType === "monthly_trend" ? (
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
                  ) : null}

                  {/* Payplan Scenarios Panel - show for financial metrics with trend view */}
                  {datePeriodType === 'monthly_trend' && (
                    <div className="border-t pt-3">
                      <PayplanScenariosPanel />
                    </div>
                  )}
                </>
              )}

              {metricType === "monthly_combined" ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">
                        KPI Metrics ({selectedKpiMetrics.length} selected)
                        {isTotalHoursRequired && <span className="text-destructive ml-1">*</span>}
                      </label>
                      {selectedKpiMetrics.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setSelectedKpiMetrics(isTotalHoursRequired ? ['Total Hours'] : [])}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-[150px] pr-4 border rounded-md p-2">
                      <div className="space-y-2">
                        {availableKpiMetricsForCombined.map((metric: any) => {
                          const metricName = metric.name;
                          const isRequired = metricName === 'Total Hours' && isTotalHoursRequired;
                          return (
                            <div key={metricName} className="flex items-center space-x-2">
                              <Checkbox
                                id={`kpi-${metricName}`}
                                checked={selectedKpiMetrics.includes(metricName)}
                                onCheckedChange={() => toggleKpiMetricSelection(metricName)}
                                disabled={isRequired}
                              />
                              <label htmlFor={`kpi-${metricName}`} className="text-sm cursor-pointer">
                                {metricName} {isRequired && "(required)"}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">
                        Financial Metrics ({selectedFinancialMetrics.length} selected)
                      </label>
                      {selectedFinancialMetrics.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => setSelectedFinancialMetrics([])}
                        >
                          Clear All
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-[150px] pr-4 border rounded-md p-2">
                      <div className="space-y-1">
                        {availableFinancialMetricsForCombined
                          .filter((metric: any) => !metric.isSubMetric)
                          .map((metric: any) => {
                            const metricName = metric.name;
                            const metricKey = metric.key ?? metricName;
                            const selectionId = metricName;

                            // Get sub-metrics for this parent
                            const subMetricsForParent = availableFinancialMetricsForCombined.filter(
                              (m: any) => m.isSubMetric && m.parentKey === metric.key
                            );
                            const hasSubMetrics = subMetricsForParent.length > 0;
                            
                            const subMetricIds = subMetricsForParent.map((m: any) => m.key);
                            const allSubsSelected = hasSubMetrics && subMetricIds.every((id: string) => selectedFinancialMetrics.includes(id));

                            return (
                              <div key={metricKey} className="space-y-1">
                                {/* Parent metric row */}
                                <div className="flex items-center space-x-2 py-0.5">
                                  <Checkbox
                                    id={`fin-${metricKey}`}
                                    checked={selectedFinancialMetrics.includes(selectionId)}
                                    onCheckedChange={() => toggleFinancialMetricSelection(selectionId)}
                                  />
                                  <label htmlFor={`fin-${metricKey}`} className="text-sm cursor-pointer font-medium flex-1">
                                    {metricName}
                                  </label>
                                  {hasSubMetrics && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (allSubsSelected) {
                                          setSelectedFinancialMetrics(prev => prev.filter(id => !subMetricIds.includes(id)));
                                        } else {
                                          setSelectedFinancialMetrics(prev => [...new Set([...prev, ...subMetricIds])]);
                                        }
                                      }}
                                      className={`text-xs px-2 py-0.5 rounded ${
                                        allSubsSelected 
                                          ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                      }`}
                                    >
                                      {allSubsSelected ? 'Deselect subs' : `Select all (${subMetricsForParent.length})`}
                                    </button>
                                  )}
                                </div>
                                
                                {/* Sub-metrics nested under parent */}
                                {hasSubMetrics && (
                                  <div className="ml-6 pl-2 border-l-2 border-muted space-y-0.5">
                                    {subMetricsForParent.map((subMetric: any) => {
                                      const subMetricName = subMetric.name;
                                      const subMetricKey = subMetric.key;
                                      const subSelectionId = subMetricKey;
                                      
                                      return (
                                        <div key={subMetricKey} className="flex items-center space-x-2 py-0.5">
                                          <Checkbox
                                            id={`fin-${subMetricKey}`}
                                            checked={selectedFinancialMetrics.includes(subSelectionId)}
                                            onCheckedChange={() => toggleFinancialMetricSelection(subSelectionId)}
                                          />
                                          <label
                                            htmlFor={`fin-${subMetricKey}`}
                                            className="text-sm cursor-pointer text-muted-foreground"
                                          >
                                            {subMetricName.replace('↳ ', '')}
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </ScrollArea>
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">
                      Metrics ({selectedMetrics.length} selected)
                    </label>
                    {selectedMetrics.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => setSelectedMetrics([])}
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-1">
                      {availableMetrics
                        .filter((metric: any) => !metric.isSubMetric)
                        .map((metric: any) => {
                          const metricName = typeof metric === "string" ? metric : metric.name;
                          const metricKey = typeof metric === "string" ? metricName : (metric.key ?? metricName);
                          const checkboxId = `metric-${metricKey}`;
                          const selectionId = metricName;

                          // Get sub-metrics for this parent
                          const subMetricsForParent = availableMetrics.filter(
                            (m: any) => m.isSubMetric && m.parentKey === metric.key
                          );
                          const hasSubMetrics = subMetricsForParent.length > 0;
                          
                          // Get all sub-metric selection IDs for this parent
                          const subMetricIds = subMetricsForParent.map((m: any) => m.key);
                          const allSubsSelected = hasSubMetrics && subMetricIds.every((id: string) => selectedMetrics.includes(id));
                          const selectedSubCount = subMetricIds.filter((id: string) => selectedMetrics.includes(id)).length;

                          return (
                            <div key={metricKey} className="space-y-1">
                              {/* Parent metric row */}
                              <div className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={checkboxId}
                                  checked={selectedMetrics.includes(selectionId)}
                                  onCheckedChange={() => toggleMetricSelection(selectionId)}
                                />
                                <label
                                  htmlFor={checkboxId}
                                  className="text-sm leading-none cursor-pointer font-medium flex-1"
                                >
                                  {metricName}
                                </label>
                                {hasSubMetrics && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (allSubsSelected) {
                                        setSelectedMetrics(prev => prev.filter(id => !subMetricIds.includes(id)));
                                      } else {
                                        setSelectedMetrics(prev => [...new Set([...prev, ...subMetricIds])]);
                                      }
                                    }}
                                    className={`text-xs px-2 py-0.5 rounded ${
                                      allSubsSelected 
                                        ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                  >
                                    {allSubsSelected ? 'Deselect subs' : `Select all (${subMetricsForParent.length})`}
                                  </button>
                                )}
                              </div>
                              
                              {/* Sub-metrics nested under parent */}
                              {hasSubMetrics && (
                                <div className="ml-6 pl-2 border-l-2 border-muted space-y-1">
                                  {subMetricsForParent.map((subMetric: any) => {
                                    const subMetricName = subMetric.name;
                                    const subMetricKey = subMetric.key;
                                    const subCheckboxId = `metric-${subMetricKey}`;
                                    const subSelectionId = subMetricKey;
                                    
                                    return (
                                      <div key={subMetricKey} className="flex items-center space-x-2 py-0.5">
                                        <Checkbox
                                          id={subCheckboxId}
                                          checked={selectedMetrics.includes(subSelectionId)}
                                          onCheckedChange={() => toggleMetricSelection(subSelectionId)}
                                        />
                                        <label
                                          htmlFor={subCheckboxId}
                                          className="text-sm leading-none cursor-pointer text-muted-foreground"
                                        >
                                          {subMetricName.replace('↳ ', '')}
                                        </label>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    {metricType === "monthly_combined" ? "Combined Report" : "Dealer Comparison"}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({filteredStores.length} stores{metricType === "monthly_combined" 
                        ? `, ${selectedKpiMetrics.length} KPIs, ${selectedFinancialMetrics.length} financial` 
                        : `, ${selectedMetrics.length} metrics`})
                    </span>
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  {metricType === "monthly_combined" ? "Ready to Generate Report" : "Ready to Compare"}
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {metricType === "monthly_combined" ? (
                    filteredStores.length === 0 
                      ? "Select stores from the filter options to begin."
                      : (selectedKpiMetrics.length === 0 && selectedFinancialMetrics.length === 0)
                      ? "Select KPI and/or financial metrics for the report."
                      : !isValidCombinedSelection
                      ? "Total Hours is required when Service department is selected."
                      : `Generate quarterly report with ${selectedKpiMetrics.length} KPIs and ${selectedFinancialMetrics.length} financial metrics across ${filteredStores.length} stores.`
                  ) : (
                    filteredStores.length === 0 
                      ? "Select stores from the filter options to begin comparison."
                      : selectedMetrics.length === 0
                      ? "Select metrics to compare across your selected stores."
                      : `Compare ${selectedMetrics.length} metrics across ${filteredStores.length} stores.`
                  )}
                </p>
                
                {metricType === "monthly_combined" ? (
                  <div className="flex flex-col items-center gap-4">
                    {/* Date Range for Combined Report */}
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block text-left">Start Month</label>
                        <Select 
                          value={format(startMonth, "yyyy-MM")} 
                          onValueChange={(value) => {
                            const [year, month] = value.split('-');
                            setStartMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                          }}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>{format(startMonth, "MMM yyyy")}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
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
                        <label className="text-sm font-medium mb-1 block text-left">End Month</label>
                        <Select 
                          value={format(endMonth, "yyyy-MM")} 
                          onValueChange={(value) => {
                            const [year, month] = value.split('-');
                            setEndMonth(new Date(parseInt(year), parseInt(month) - 1, 1));
                          }}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue>{format(endMonth, "MMM yyyy")}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
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
                    
                    <Button
                      onClick={() => {
                        let brandDisplayName = "All Brands";
                        if (selectedBrandIds.length > 0) {
                          const selectedBrandNames = brands
                            ?.filter(b => selectedBrandIds.includes(b.id))
                            .map(b => b.name) || [];
                          brandDisplayName = selectedBrandNames.length === 1 
                            ? selectedBrandNames[0] 
                            : selectedBrandNames.join(", ");
                        } else if (filteredStores.length > 0) {
                          // Derive brand names from filtered stores
                          const storeBrandIds = new Set(filteredStores.map(s => s.brand_id).filter(Boolean));
                          const storeBrandNames = brands?.filter(b => storeBrandIds.has(b.id)).map(b => b.name) || [];
                          if (storeBrandNames.length === 1) {
                            brandDisplayName = storeBrandNames[0];
                          } else if (storeBrandNames.length > 1) {
                            brandDisplayName = storeBrandNames.join(", ");
                          }
                        }
                        
                        setCombinedTrendParams({
                          storeIds: filteredStores.map(s => s.id),
                          selectedDepartmentNames,
                          selectedKpiMetrics,
                          selectedFinancialMetrics,
                          startMonth: format(startMonth, 'yyyy-MM'),
                          endMonth: format(endMonth, 'yyyy-MM'),
                          brandDisplayName,
                          filterName: loadedFilterName,
                        });
                        setViewMode("combined_trend");
                      }}
                      disabled={
                        filteredStores.length === 0 || 
                        (selectedKpiMetrics.length === 0 && selectedFinancialMetrics.length === 0) ||
                        !isValidCombinedSelection
                      }
                      size="lg"
                      className="gap-2"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Generate Combined Trend Report
                    </Button>
                  </div>
                ) : (
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
                          {selectedMetrics.map((selectionId) => {
                            // Convert selection ID to display name for sub-metrics
                            let displayName = selectionId;
                            if (selectionId.startsWith('sub:')) {
                              const parts = selectionId.split(':');
                              if (parts.length >= 3) {
                                displayName = `↳ ${parts.slice(2).join(':')}`;
                              }
                            }
                            return (
                              <SelectItem key={selectionId} value={selectionId}>
                                {displayName}
                              </SelectItem>
                            );
                          })}
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
                        if (selectedBrandIds.length > 0) {
                          const selectedBrandNames = brands
                            ?.filter(b => selectedBrandIds.includes(b.id))
                            .map(b => b.name) || [];
                          brandDisplayName = selectedBrandNames.length === 1 
                            ? selectedBrandNames[0] 
                            : selectedBrandNames.join(", ");
                        } else if (filteredStores.length > 0) {
                          // Derive brand names from filtered stores
                          const storeBrandIds = new Set(filteredStores.map(s => s.brand_id).filter(Boolean));
                          const storeBrandNames = brands?.filter(b => storeBrandIds.has(b.id)).map(b => b.name) || [];
                          if (storeBrandNames.length === 1) {
                            brandDisplayName = storeBrandNames[0];
                          } else if (storeBrandNames.length > 1) {
                            brandDisplayName = storeBrandNames.join(", ");
                          }
                        }
                        
                        // Pass full selection IDs including parent key for sub-metrics
                        // DealerComparison will handle the display name conversion and type detection
                        navigate("/dealer-comparison", {
                          state: {
                            metricType,
                            selectedMetrics, // Keep full IDs like "sub:sales_expense_percent:Comp Managers"
                            ...dateParams,
                            comparisonMode,
                            departmentIds,
                            isFixedCombined: selectedDepartmentNames.includes('Fixed Combined'),
                            selectedDepartmentNames,
                            sortByMetric, // Keep full ID
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
                    {metricType === 'financial' && datePeriodType === 'monthly_trend' && (
                      <Button
                        onClick={() => {
                          // Use the user-selected start/end months from the monthly_trend period
                          const start = format(startMonth, 'yyyy-MM');
                          const end = format(endMonth, 'yyyy-MM');
                          
                          let brandDisplayName = "All Brands";
                          if (selectedBrandIds.length > 0) {
                            const selectedBrandNames = brands
                              ?.filter(b => selectedBrandIds.includes(b.id))
                              .map(b => b.name) || [];
                            brandDisplayName = selectedBrandNames.length === 1 
                              ? selectedBrandNames[0] 
                              : selectedBrandNames.join(", ");
                          } else if (filteredStores.length > 0) {
                            const storeBrandIds = new Set(filteredStores.map(s => s.brand_id).filter(Boolean));
                            const storeBrandNames = brands?.filter(b => storeBrandIds.has(b.id)).map(b => b.name) || [];
                            if (storeBrandNames.length === 1) {
                              brandDisplayName = storeBrandNames[0];
                            } else if (storeBrandNames.length > 1) {
                              brandDisplayName = storeBrandNames.join(", ");
                            }
                          }
                          
                          // For reports, keep selection IDs (especially sub:*), so we can:
                          // - avoid collisions (same sub-name under different parents)
                          // - compute percentage-based sub-metrics correctly
                          setTrendReportParams({
                            storeIds: filteredStores.map(s => s.id),
                            selectedMetrics: selectedMetrics,
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
                        View Trend Report
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
                          if (selectedBrandIds.length > 0) {
                            const selectedBrandNames = brands
                              ?.filter(b => selectedBrandIds.includes(b.id))
                              .map(b => b.name) || [];
                            brandDisplayName = selectedBrandNames.length === 1 
                              ? selectedBrandNames[0] 
                              : selectedBrandNames.join(", ");
                          } else if (filteredStores.length > 0) {
                            const storeBrandIds = new Set(filteredStores.map(s => s.brand_id).filter(Boolean));
                            const storeBrandNames = brands?.filter(b => storeBrandIds.has(b.id)).map(b => b.name) || [];
                            if (storeBrandNames.length === 1) {
                              brandDisplayName = storeBrandNames[0];
                            } else if (storeBrandNames.length > 1) {
                              brandDisplayName = storeBrandNames.join(", ");
                            }
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
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
