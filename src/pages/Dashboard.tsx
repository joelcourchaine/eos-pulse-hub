import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import goLogo from "@/assets/go-logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, Target, CheckSquare, Calendar, Mail, CircleCheck, AlertCircle, XCircle, CircleDashed, Building2, Building, Users, ClipboardList, TrendingUp } from "lucide-react";
import ScorecardGrid from "@/components/scorecard/ScorecardGrid";
import MeetingFramework, { MeetingViewMode } from "@/components/meeting/MeetingFramework";
import RocksPanel from "@/components/rocks/RocksPanel";
import { KPIManagementDialog } from "@/components/scorecard/KPIManagementDialog";
import { FinancialSummary } from "@/components/financial/FinancialSummary";
import { PrintView } from "@/components/print/PrintView";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Celebrations } from "@/components/celebrations/Celebrations";
import { UserManagementDialog } from "@/components/users/UserManagementDialog";
import { StoreManagementDialog } from "@/components/stores/StoreManagementDialog";
import { DepartmentSelectionDialog } from "@/components/departments/DepartmentSelectionDialog";
import { TodosPanel } from "@/components/todos/TodosPanel";
import { CollapsibleIssuesPanel } from "@/components/issues/CollapsibleIssuesPanel";
import { LogoUpload } from "@/components/stores/LogoUpload";
import { DirectorNotes } from "@/components/dashboard/DirectorNotes";
import { DepartmentQuestionnaireDialog } from "@/components/departments/DepartmentQuestionnaireDialog";
import { getWeek, startOfWeek, endOfWeek, format } from "date-fns";
import { useUserRole } from "@/hooks/use-user-role";
import { useIsMobile } from "@/hooks/use-mobile";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isSuperAdmin, isStoreGM, isDepartmentManager, loading: rolesLoading } = useUserRole(user?.id);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(""); // Don't load from localStorage until validated
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [kpis, setKpis] = useState<any[]>([]);
  
  // Mobile tasks view state - default to true on mobile, persisted in localStorage
  const [showMobileTasksView, setShowMobileTasksView] = useState(() => {
    const saved = localStorage.getItem('showMobileTasksView');
    // If never set, default to true (show tasks first on mobile)
    return saved === null ? true : saved === 'true';
  });
  
  // Calculate current quarter and year
  const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    return Math.floor(month / 3) + 1; // Returns 1-4
  };
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"weekly" | "monthly" | "yearly" | "gm-overview">("monthly");
  const [gmOverviewPeriod, setGmOverviewPeriod] = useState<"quarterly" | "yearly">("quarterly");
  const [kpiStatusCounts, setKpiStatusCounts] = useState({ green: 0, yellow: 0, red: 0, missing: 0 });
  const [activeRocksCount, setActiveRocksCount] = useState(0);
  const [myOpenTodosCount, setMyOpenTodosCount] = useState(0);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showStores, setShowStores] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showDepartmentInfo, setShowDepartmentInfo] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>(""); // Don't load from localStorage until validated
  const [storesLoaded, setStoresLoaded] = useState(false);
  const [isStoreSwitching, setIsStoreSwitching] = useState(false); // Track when store is actively switching
  const [scorecardViewMode, setScorecardViewMode] = useState<"weekly" | "monthly">("monthly");
  const [meetingViewMode, setMeetingViewMode] = useState<MeetingViewMode>("view-all");
  const [emailRecipients, setEmailRecipients] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedEmailRecipients, setSelectedEmailRecipients] = useState<string[]>([]);
  
  // Handler to toggle mobile tasks view
  const handleViewFullDashboard = () => {
    setShowMobileTasksView(false);
    localStorage.setItem('showMobileTasksView', 'false');
  };
  
  const currentWeek = getWeek(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDateRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      } else {
        fetchProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (rolesLoading) return;
    
    if (isSuperAdmin) {
      fetchStores();
    } else if (profile) {
      // Non-super-admins don't need to load stores, so mark as loaded
      setStoresLoaded(true);
      fetchDepartments();
    }
  }, [profile, isSuperAdmin, rolesLoading]);

  useEffect(() => {
    if (selectedStore && profile && storesLoaded) {
      // Mark that we're switching stores
      setIsStoreSwitching(true);
      
      // Clear all data when switching stores
      setSelectedDepartment("");
      setDepartmentsLoaded(false);
      setKpis([]);
      setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
      setActiveRocksCount(0);
      setMyOpenTodosCount(0);
      
      // Persist selected store
      localStorage.setItem('selectedStore', selectedStore);
      
      // Fetch departments for the new store
      fetchDepartments();
    }
  }, [selectedStore, profile, storesLoaded]);

  useEffect(() => {
      // Only fetch data if departments and stores have been loaded and validated
    if (selectedDepartment && departmentsLoaded && storesLoaded) {
      // CRITICAL: Verify department belongs to current store before fetching data
      const dept = departments.find(d => d.id === selectedDepartment);
      if (!dept || dept.store_id !== selectedStore) {
        console.error('Department does not belong to current store!', {
          selectedDepartment,
          selectedStore,
          deptStoreId: dept?.store_id
        });
        // Clear invalid selection
        setSelectedDepartment("");
        localStorage.removeItem('selectedDepartment');
        return;
      }
      
      // Clear all department-specific data immediately when department changes
      setKpis([]);
      setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
      setActiveRocksCount(0);
      setMyOpenTodosCount(0);
      
      // Persist selected department
      localStorage.setItem('selectedDepartment', selectedDepartment);
      
      // Fetch all data for the new department
      const fetchAllDepartmentData = async () => {
        await Promise.all([
          fetchKPIs(),
          fetchKPIStatusCounts(selectedQuarter, selectedYear),
          fetchActiveRocksCount(),
          fetchMyOpenTodosCount()
        ]);
        // Store switch is complete once all data is loaded
        setIsStoreSwitching(false);
      };
      fetchAllDepartmentData();
    }
  }, [selectedDepartment, departmentsLoaded, storesLoaded, departments, selectedStore, scorecardViewMode, selectedQuarter, selectedYear]);

  // Real-time subscription for KPI status updates
  useEffect(() => {
    if (!selectedDepartment) return;

    const scorecardChannel = supabase
      .channel('scorecard-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scorecard_entries'
        },
        () => {
          // Refresh KPI status counts when any entry changes
          fetchKPIStatusCounts(selectedQuarter, selectedYear);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scorecardChannel);
    };
  }, [selectedDepartment, scorecardViewMode, selectedQuarter, selectedYear]);

  // Real-time subscription for todos updates (across all stores for the user)
  // Fetch my todos count and setup realtime subscription
  useEffect(() => {
    if (!user) return;

    // Fetch initial count when user is available
    const fetchTodos = async () => {
      try {
        const { count, error } = await supabase
          .from("todos")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .eq("status", "pending");

        if (error) throw error;
        setMyOpenTodosCount(count || 0);
      } catch (error: any) {
        console.error("Error fetching my open todos count:", error);
      }
    };

    fetchTodos();

    const todosChannel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos'
        },
        () => {
          // Refresh todos count when any todo changes
          fetchTodos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(todosChannel);
    };
  }, [user]);

  // Real-time subscription for stores updates
  useEffect(() => {
    if (!user) return;

    const storesChannel = supabase
      .channel('stores-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stores'
        },
        () => {
          // Refresh stores list when stores change
          fetchStores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(storesChannel);
    };
  }, [user]);

  // Real-time subscription for departments updates
  useEffect(() => {
    if (!selectedStore && !profile?.store_id) return;

    const departmentsChannel = supabase
      .channel('departments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'departments'
        },
        () => {
          // Refresh departments list when departments change
          fetchDepartments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(departmentsChannel);
    };
  }, [selectedStore, profile?.store_id]);

  // Real-time subscription for rocks updates
  useEffect(() => {
    if (!selectedDepartment) return;

    // Fetch initial count
    fetchActiveRocksCount();

    const rocksChannel = supabase
      .channel('rocks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rocks'
        },
        () => {
          // Refresh rocks count when any rock changes
          fetchActiveRocksCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(rocksChannel);
    };
  }, [selectedDepartment]);

  // Redirect to my-tasks page on mobile when preference is set
  useEffect(() => {
    if (isMobile && showMobileTasksView && user && !loading) {
      navigate("/my-tasks");
    }
  }, [isMobile, showMobileTasksView, user, loading, navigate]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .order("name");

      if (error) throw error;

      if (data && data.length > 0) {
        setStores(data);
        // Validate and restore selected store from localStorage
        const savedStore = localStorage.getItem('selectedStore');
        
        if (savedStore && data.find(s => s.id === savedStore)) {
          // Saved store is valid and user has access to it
          setSelectedStore(savedStore);
        } else {
          // No saved store or invalid saved store, use first available
          const firstStore = data[0].id;
          setSelectedStore(firstStore);
          localStorage.setItem('selectedStore', firstStore);
        }
      }
      
      // Mark stores as loaded after validation
      setStoresLoaded(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching stores",
        description: error.message,
      });
      setStoresLoaded(true);
    }
  };

  const fetchDepartments = async () => {
    try {
      // For department managers, only fetch departments they have access to
      if (isDepartmentManager && !isSuperAdmin && !isStoreGM) {
        // First, get the department IDs the user has access to
        const { data: accessData, error: accessError } = await supabase
          .from("user_department_access")
          .select("department_id")
          .eq("user_id", user?.id);

        if (accessError) throw accessError;

        const accessibleDeptIds = accessData?.map(a => a.department_id) || [];

        if (accessibleDeptIds.length === 0) {
          // User has no department access
          setDepartments([]);
          setSelectedDepartment("");
          localStorage.removeItem('selectedDepartment');
          setKpis([]);
          setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
          return;
        }

        // Fetch only the accessible departments
        const { data, error } = await supabase
          .from("departments")
          .select("*, profiles(email, full_name), department_type_id")
          .in("id", accessibleDeptIds)
          .order("name");

        if (error) throw error;

        setDepartments(data || []);
        if (data && data.length > 0) {
          const savedDept = localStorage.getItem('selectedDepartment');
          // Validate saved department belongs to this store's accessible departments
          const foundDept = data.find(d => d.id === savedDept);
          if (savedDept && foundDept) {
            setSelectedDepartment(savedDept);
          } else {
            // Prioritize Service Department, otherwise use first department
            const serviceDept = data.find(d => d.name.toLowerCase().includes('service'));
            const defaultDept = serviceDept ? serviceDept.id : data[0].id;
            setSelectedDepartment(defaultDept);
            localStorage.setItem('selectedDepartment', defaultDept);
            if (savedDept) {
              console.warn('Cleared invalid department from localStorage:', savedDept);
            }
          }
        }
        setDepartmentsLoaded(true);
        return;
      }

      // For super admins, require selectedStore to be set before fetching
      if (isSuperAdmin && !selectedStore) {
        console.log('Super admin: waiting for store selection before fetching departments');
        return;
      }

      // For super admins and store GMs, show all departments in the store
      let query = supabase
        .from("departments")
        .select("*, profiles(email, full_name), department_type_id")
        .order("name");

      // Filter departments by store
      if (isSuperAdmin) {
        // Super admin: filter by selected store
        if (selectedStore) {
          query = query.eq("store_id", selectedStore);
        }
      } else {
        // Store GMs: filter by their profile's store
        if (profile?.store_id) {
          query = query.eq("store_id", profile.store_id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
      if (data && data.length > 0) {
        const savedDept = localStorage.getItem('selectedDepartment');
        // CRITICAL: Validate saved department belongs to this store's departments
        // Check both that department exists AND that it belongs to the current store
        const foundDept = data.find(d => d.id === savedDept);
        if (savedDept && foundDept && foundDept.store_id === selectedStore) {
          setSelectedDepartment(savedDept);
        } else {
          // Prioritize Service Department, otherwise use first department
          const serviceDept = data.find(d => d.name.toLowerCase().includes('service'));
          const defaultDept = serviceDept ? serviceDept.id : data[0].id;
          setSelectedDepartment(defaultDept);
          localStorage.setItem('selectedDepartment', defaultDept);
          if (savedDept) {
            console.warn('Cleared invalid department from localStorage - did not belong to current store:', savedDept, 'store:', selectedStore);
          }
        }
      } else {
        // No departments in this store - clear everything
        setSelectedDepartment("");
        localStorage.removeItem('selectedDepartment');
        setKpis([]);
        setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
      }
      setDepartmentsLoaded(true);
    } catch (error: any) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchKPIs = async () => {
    if (!selectedDepartment) return;

    try {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*")
        .eq("department_id", selectedDepartment)
        .order("display_order");

      if (error) throw error;
      setKpis(data || []);
    } catch (error: any) {
      console.error("Error fetching KPIs:", error);
    }
  };

  const fetchKPIStatusCounts = async (quarter?: number, year?: number) => {
    if (!selectedDepartment) return;

    const targetQuarter = quarter ?? selectedQuarter;
    const targetYear = year ?? selectedYear;

    try {
      // Get all KPIs for this department with their properties
      const { data: kpiData, error: kpiError } = await supabase
        .from("kpi_definitions")
        .select("id, target_value, metric_type, target_direction")
        .eq("department_id", selectedDepartment);

      if (kpiError) throw kpiError;

      if (!kpiData || kpiData.length === 0) {
        setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
        return;
      }

      const kpiIds = kpiData.map(k => k.id);
      
      let entries;
      
      if (scorecardViewMode === "weekly") {
        // For weekly view, find the most recent week in the selected quarter that has data
        // Calculate weeks for the quarter using same logic as ScorecardGrid
        const YEAR_STARTS: { [key: number]: Date } = {
          2025: new Date(2024, 11, 30), // Dec 30, 2024
          2026: new Date(2025, 11, 29), // Dec 29, 2025
          2027: new Date(2026, 11, 28), // Dec 28, 2026
        };
        
        const yearStart = YEAR_STARTS[targetYear] || new Date(targetYear, 0, 1);
        const quarterStartWeek = (targetQuarter - 1) * 13;
        
        // Build array of week start dates for this quarter (in reverse order to check most recent first)
        const weekDates: string[] = [];
        for (let i = 12; i >= 0; i--) {
          const weekStartDate = new Date(yearStart);
          weekStartDate.setDate(yearStart.getDate() + ((quarterStartWeek + i) * 7));
          weekDates.push(format(weekStartDate, 'yyyy-MM-dd'));
        }
        
        // Try to find data for the most recent week in the quarter
        for (const weekDate of weekDates) {
          const { data, error: entriesError } = await supabase
            .from("scorecard_entries")
            .select("kpi_id, status")
            .in("kpi_id", kpiIds)
            .eq("week_start_date", weekDate)
            .eq("entry_type", "weekly");

          if (entriesError) throw entriesError;
          
          if (data && data.length > 0) {
            entries = data;
            break;
          }
        }
      } else {
        // For monthly view, get the most recent status for each KPI
        // All quarters now show only their 3 months (in reverse order to find most recent)
        const monthsInQuarter: string[] = [];
        
        for (let i = 2; i >= 0; i--) {
          const monthIndex = (targetQuarter - 1) * 3 + i;
          monthsInQuarter.push(`${targetYear}-${String(monthIndex + 1).padStart(2, '0')}`);
        }
        
        // Fetch ALL entries for these months to find the most recent entry per KPI
        const { data: allMonthlyData, error: entriesError } = await supabase
          .from("scorecard_entries")
          .select("kpi_id, actual_value, month")
          .in("kpi_id", kpiIds)
          .in("month", monthsInQuarter)
          .eq("entry_type", "monthly")
          .order("month", { ascending: false });

        if (entriesError) throw entriesError;
        
        // Fetch targets for all KPIs in this quarter
        const { data: targetsData } = await supabase
          .from("kpi_targets")
          .select("kpi_id, target_value")
          .in("kpi_id", kpiIds)
          .eq("quarter", targetQuarter)
          .eq("year", targetYear)
          .eq("entry_type", "monthly");
        
        const targetsByKpi = new Map(targetsData?.map(t => [t.kpi_id, t.target_value]) || []);
        
        // For each KPI, find the most recent entry and recalculate its status
        const kpiMostRecentEntry = new Map<string, any>();
        allMonthlyData?.forEach((entry) => {
          if (entry.actual_value !== null && !kpiMostRecentEntry.has(entry.kpi_id)) {
            // Find the KPI definition to get target_direction and metric_type
            const kpiDef = kpiData.find(k => k.id === entry.kpi_id);
            const target = targetsByKpi.get(entry.kpi_id) || kpiDef?.target_value || 0;
            
            if (kpiDef && target > 0) {
              // Recalculate status based on current target (matching scorecard logic)
              const variance = kpiDef.metric_type === "percentage" 
                ? entry.actual_value - target 
                : ((entry.actual_value - target) / target) * 100;
              
              let status: string;
              if (kpiDef.target_direction === "above") {
                status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
              } else {
                status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
              }
              
              kpiMostRecentEntry.set(entry.kpi_id, { ...entry, status });
            }
          }
        });
        
        // Convert to array for compatibility with existing code
        entries = Array.from(kpiMostRecentEntry.values());
      }

      // Create a map of kpi_id to status
      const entryMap = new Map<string, string>();
      entries?.forEach(entry => {
        if (entry.status) {
          entryMap.set(entry.kpi_id, entry.status);
        }
      });

      // Count by status for ALL KPIs (track missing entries separately)
      const counts = { green: 0, yellow: 0, red: 0, missing: 0 };
      
      kpiData.forEach(kpi => {
        const status = entryMap.get(kpi.id);
        if (status === "green") counts.green++;
        else if (status === "yellow") counts.yellow++;
        else if (status === "red") counts.red++;
        else counts.missing++; // No entry = missing
      });

      setKpiStatusCounts(counts);
    } catch (error: any) {
      console.error("Error fetching KPI status counts:", error);
    }
  };

  const fetchActiveRocksCount = async () => {
    if (!selectedDepartment) return;

    try {
      // Use current calendar quarter (same as RocksPanel)
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentQuarter = Math.ceil((currentDate.getMonth() + 1) / 3);
      
      const { count, error } = await supabase
        .from("rocks")
        .select("*", { count: "exact", head: true })
        .eq("department_id", selectedDepartment)
        .eq("year", currentYear)
        .eq("quarter", currentQuarter);

      if (error) throw error;
      setActiveRocksCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching active rocks count:", error);
    }
  };

  const fetchMyOpenTodosCount = async () => {
    if (!user) return;

    try {
      // Fetch count of ALL pending todos assigned to user across all stores/departments
      const { count, error } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", user.id)
        .eq("status", "pending");

      if (error) throw error;
      setMyOpenTodosCount(count || 0);
    } catch (error: any) {
      console.error("Error fetching my open todos count:", error);
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } else {
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/auth");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmailScorecard = async () => {
    if (!selectedDepartment) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a department first",
      });
      return;
    }

    if (selectedEmailRecipients.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select at least one recipient",
      });
      return;
    }

    setIsEmailLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use different endpoint for GM Overview
      const endpoint = printMode === "gm-overview" 
        ? "send-gm-overview-email" 
        : "send-scorecard-email";

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            year: selectedYear,
            quarter: selectedQuarter,
            mode: printMode === "gm-overview" ? "monthly" : printMode,
            departmentId: selectedDepartment,
            recipientEmails: selectedEmailRecipients,
            gmOverviewPeriod: printMode === "gm-overview" ? gmOverviewPeriod : undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      console.log("Email sent:", result);

      toast({
        title: "Email Sent",
        description: `The ${printMode === "gm-overview" ? "GM Overview" : "scorecard"} report has been emailed to ${selectedEmailRecipients.length} recipient(s) successfully.`,
      });
      setPrintDialogOpen(false);
      setSelectedEmailRecipients([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast({
        variant: "destructive",
        title: "Email Error",
        description: error.message || "Failed to send email. Please check your Resend API key and domain verification.",
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  if (loading || rolesLoading || !user || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }


  return (
    <>
      {/* Hidden Print Content - Only mount when print dialog is open and not GM Overview */}
      {printDialogOpen && printMode !== "gm-overview" && (
        <div className="print-only-content" style={{ display: 'none' }}>
          <PrintView 
            year={selectedYear} 
            quarter={selectedQuarter} 
            mode={printMode} 
            departmentId={selectedDepartment} 
          />
        </div>
      )}

      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 flex-shrink-0">
              <img src={goLogo} alt="GO Logo" className="h-10 w-10 rounded-lg" />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground whitespace-nowrap">GO Scorecard</h1>
                <p className="text-xs text-muted-foreground whitespace-nowrap">Growth Operating System</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {isSuperAdmin && stores.length > 0 && (
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Store" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores.filter(store => store.id && store.id.trim() !== "").map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {departments.length > 0 && (
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter(dept => dept.id && dept.id.trim() !== "").map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isSuperAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => navigate("/enterprise")}>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Enterprise
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowStores(true)}>
                    <Building2 className="mr-2 h-4 w-4" />
                    Stores
                  </Button>
                </>
              )}
              {(isSuperAdmin || isStoreGM) && (
                <Button variant="outline" size="sm" onClick={() => setShowDepartments(true)}>
                  <Building className="mr-2 h-4 w-4" />
                  Departments
                </Button>
              )}
              {(isSuperAdmin || isStoreGM) && (
                <Button variant="outline" size="sm" onClick={() => setShowUsers(true)}>
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
              )}
              {selectedDepartment && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowDepartmentInfo(true)}
                >
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Department Info
                </Button>
              )}
              <Dialog open={printDialogOpen} onOpenChange={(open) => {
                setPrintDialogOpen(open);
                if (open) {
                  // Load recipients when dialog opens
                  const loadRecipients = async () => {
                    // Get super admin user IDs first
                    const { data: superAdminRoles } = await supabase
                      .from("user_roles")
                      .select("user_id")
                      .eq("role", "super_admin");
                    
                    const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];
                    
                    // Fetch users in the same store group
                    let groupProfiles: any[] = [];
                    if (profile?.store_group_id) {
                      const { data } = await supabase
                        .from("profiles")
                        .select("id, full_name, email")
                        .eq("store_group_id", profile.store_group_id)
                        .eq("is_system_user", false)
                        .order("full_name");
                      groupProfiles = data || [];
                    }
                    
                    // Fetch super admins separately (they may not have store_group_id)
                    const { data: superAdminProfiles } = await supabase
                      .from("profiles")
                      .select("id, full_name, email")
                      .in("id", superAdminIds)
                      .eq("is_system_user", false);
                    
                    // Merge and dedupe
                    const allProfiles = [...groupProfiles];
                    superAdminProfiles?.forEach(sa => {
                      if (!allProfiles.find(p => p.id === sa.id)) {
                        allProfiles.push(sa);
                      }
                    });
                    
                    // Sort by name
                    allProfiles.sort((a, b) => a.full_name.localeCompare(b.full_name));
                    
                    setEmailRecipients(allProfiles);
                  };
                  loadRecipients();
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="no-print max-w-xl" aria-describedby="email-description">
                  <DialogTitle>Email Scorecard Report</DialogTitle>
                  <div id="email-description" className="sr-only">
                    Send scorecard report via email
                  </div>
                  <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold mb-3 block">Report Format</Label>
                    <RadioGroup value={printMode} onValueChange={(value: "weekly" | "monthly" | "yearly" | "gm-overview") => setPrintMode(value)}>
                      <div className="p-2 rounded-lg border border-primary/20 bg-primary/5">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gm-overview" id="gm-overview" />
                          <Label htmlFor="gm-overview" className="cursor-pointer font-normal">
                            <span className="font-semibold">GM Overview</span> - Issues, To-Dos, Scorecard, Financial, Rocks & Celebrations
                          </Label>
                        </div>
                        {printMode === "gm-overview" && (
                          <div className="mt-3 ml-6 p-3 bg-background/50 rounded-md border">
                            <Label className="text-xs font-medium text-muted-foreground mb-2 block">Time Period</Label>
                            <RadioGroup value={gmOverviewPeriod} onValueChange={(value: "quarterly" | "yearly") => setGmOverviewPeriod(value)} className="flex gap-4">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="quarterly" id="gm-quarterly" />
                                <Label htmlFor="gm-quarterly" className="cursor-pointer font-normal text-sm">
                                  Quarterly (Q{selectedQuarter})
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="yearly" id="gm-yearly" />
                                <Label htmlFor="gm-yearly" className="cursor-pointer font-normal text-sm">
                                  Monthly Trend (All 12 months)
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="weekly" id="weekly" />
                        <Label htmlFor="weekly" className="cursor-pointer font-normal">
                          Weekly Scores (13 weeks per quarter)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="monthly" />
                        <Label htmlFor="monthly" className="cursor-pointer font-normal">
                          Monthly Scores (3 months per quarter)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yearly" id="yearly" />
                        <Label htmlFor="yearly" className="cursor-pointer font-normal">
                          Yearly Report (All 12 months with KPIs & Financial Summary)
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold mb-3 block">Recipients</Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {emailRecipients.map((recipient) => (
                        <div key={recipient.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`recipient-${recipient.id}`}
                            checked={selectedEmailRecipients.includes(recipient.email)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedEmailRecipients([...selectedEmailRecipients, recipient.email]);
                              } else {
                                setSelectedEmailRecipients(selectedEmailRecipients.filter(email => email !== recipient.email));
                              }
                            }}
                          />
                          <Label htmlFor={`recipient-${recipient.id}`} className="cursor-pointer font-normal text-sm flex-1">
                            {recipient.full_name} ({recipient.email})
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEmailScorecard} disabled={isEmailLoading || selectedEmailRecipients.length === 0}>
                      <Mail className="h-4 w-4 mr-2" />
                      {isEmailLoading ? "Sending..." : "Send Email"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {profile.role.replace("_", " ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Dealership Logo */}
          <LogoUpload storeId={selectedStore || profile?.store_id || null} userRole={isSuperAdmin ? 'super_admin' : profile?.role} />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Week {currentWeek}</div>
              <p className="text-xs text-muted-foreground">{weekDateRange}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KPI Status</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <CircleCheck className="h-5 w-5 text-success" />
                  <span className="text-2xl font-bold text-success">{kpiStatusCounts.green}</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <span className="text-2xl font-bold text-warning">{kpiStatusCounts.yellow}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">{kpiStatusCounts.red}</span>
                </div>
                <div className="flex items-center gap-1">
                  <CircleDashed className="h-5 w-5 text-muted-foreground" />
                  <span className="text-2xl font-bold text-muted-foreground">{kpiStatusCounts.missing}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Q{selectedQuarter} {selectedYear} - {scorecardViewMode === "monthly" ? "Last month's performance" : "Last week's performance"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rocks</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRocksCount}</div>
              <p className="text-xs text-muted-foreground">Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()} priorities</p>
            </CardContent>
          </Card>
          <Card 
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => navigate("/my-tasks")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Open To-Dos</CardTitle>
              <CheckSquare className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myOpenTodosCount}</div>
              <p className="text-xs text-muted-foreground">Tasks across all stores</p>
            </CardContent>
          </Card>
        </div>

        {/* Loading state when switching stores */}
        {isStoreSwitching && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="animate-pulse flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground">Loading store data...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meeting Framework */}
        {!isStoreSwitching && (
          <MeetingFramework 
            key={`meeting-${selectedDepartment}`}
            departmentId={selectedDepartment}
            onViewModeChange={setMeetingViewMode}
          />
        )}

        {/* Issues & To-Dos Section - show for view-all above scorecard */}
        {!isStoreSwitching && meetingViewMode === "view-all" && selectedDepartment && (
          <CollapsibleIssuesPanel departmentId={selectedDepartment} userId={user?.id} />
        )}

        {/* Scorecard Section - show for view-all or scorecard tab */}
        {!isStoreSwitching && (meetingViewMode === "view-all" || meetingViewMode === "scorecard") && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl">GO Scorecard</CardTitle>
                  <CardDescription>
                    Track your department's key performance indicators
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedDepartment && (
                    <KPIManagementDialog 
                      departmentId={selectedDepartment} 
                      kpis={kpis}
                      onKPIsChange={fetchKPIs}
                      year={selectedYear}
                      quarter={selectedQuarter}
                    />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedDepartment ? (
                <ScorecardGrid 
                  key={`scorecard-${selectedDepartment}-${selectedYear}-${selectedQuarter}`}
                  departmentId={selectedDepartment}
                  kpis={kpis}
                  onKPIsChange={fetchKPIs}
                  year={selectedYear}
                  quarter={selectedQuarter}
                  onYearChange={setSelectedYear}
                  onQuarterChange={setSelectedQuarter}
                  onViewModeChange={(mode) => {
                    setScorecardViewMode(mode);
                    fetchKPIStatusCounts(selectedQuarter, selectedYear);
                  }}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Select a department to view the scorecard
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Financial Summary Section - show for view-all or scorecard tab */}
        {!isStoreSwitching && selectedDepartment && (meetingViewMode === "view-all" || meetingViewMode === "scorecard") && (
          <FinancialSummary 
            key={`financial-${selectedDepartment}-${selectedYear}-${selectedQuarter}`}
            departmentId={selectedDepartment}
            year={selectedYear}
            quarter={selectedQuarter}
          />
        )}

        {/* Rocks Section - show for view-all or rocks tab */}
        {!isStoreSwitching && (meetingViewMode === "view-all" || meetingViewMode === "rocks") && (
          <RocksPanel 
            key={`rocks-${selectedDepartment}`}
            departmentId={selectedDepartment} 
          />
        )}

        {/* Celebrations - show for view-all or headlines tab */}
        {!isStoreSwitching && (meetingViewMode === "view-all" || meetingViewMode === "headlines") && (
          <Celebrations currentStoreId={isSuperAdmin ? selectedStore : profile?.store_id} />
        )}

        {/* To-Dos Section - show for view-all only (issues-todos has its own panel in meeting framework) */}
        {!isStoreSwitching && meetingViewMode === "view-all" && (
          <TodosPanel 
            key={`todos-${selectedDepartment}`}
            departmentId={selectedDepartment} 
            userId={user?.id} 
          />
        )}

        {/* Director Notes Section */}
        {!isStoreSwitching && selectedDepartment && (isSuperAdmin || isStoreGM) && (
          <DirectorNotes
            departmentId={selectedDepartment}
            userRole={isSuperAdmin ? 'super_admin' : isStoreGM ? 'store_gm' : profile?.role || ""}
          />
        )}
      </main>
    </div>

    {/* Management Dialogs */}
    <UserManagementDialog
      open={showUsers}
      onOpenChange={setShowUsers}
      currentStoreId={isSuperAdmin ? selectedStore : profile?.store_id}
    />
    <StoreManagementDialog
      open={showStores}
      onOpenChange={setShowStores}
    />
    <DepartmentSelectionDialog
      open={showDepartments}
      onOpenChange={setShowDepartments}
      storeId={isSuperAdmin ? selectedStore : profile?.store_id || ""}
    />
    {selectedDepartment && (
      <DepartmentQuestionnaireDialog
        open={showDepartmentInfo}
        onOpenChange={setShowDepartmentInfo}
        departmentId={selectedDepartment}
        departmentName={departments.find(d => d.id === selectedDepartment)?.name || "Department"}
        departmentTypeId={departments.find(d => d.id === selectedDepartment)?.department_type_id}
        managerEmail={departments.find(d => d.id === selectedDepartment)?.profiles?.email}
        isSuperAdmin={isSuperAdmin}
      />
    )}
    </>
  );
};

export default Dashboard;
