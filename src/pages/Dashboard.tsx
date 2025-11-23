import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import goLogo from "@/assets/go-logo.png";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, Target, CheckSquare, Calendar, Mail, CircleCheck, AlertCircle, XCircle, CircleDashed, Building2, Building, Users, ClipboardList, TrendingUp } from "lucide-react";
import ScorecardGrid from "@/components/scorecard/ScorecardGrid";
import MeetingFramework from "@/components/meeting/MeetingFramework";
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
import { LogoUpload } from "@/components/stores/LogoUpload";
import { DirectorNotes } from "@/components/dashboard/DirectorNotes";
import { DepartmentQuestionnaireDialog } from "@/components/departments/DepartmentQuestionnaireDialog";
import { getWeek, startOfWeek, endOfWeek, format } from "date-fns";
import { useUserRole } from "@/hooks/use-user-role";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { isSuperAdmin, isStoreGM, loading: rolesLoading } = useUserRole(user?.id);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(() => {
    return localStorage.getItem('selectedDepartment') || "";
  });
  const [kpis, setKpis] = useState<any[]>([]);
  
  // Calculate current quarter and year
  const getCurrentQuarter = () => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    return Math.floor(month / 3) + 1; // Returns 1-4
  };
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(getCurrentQuarter());
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"weekly" | "monthly" | "yearly">("monthly");
  const [kpiStatusCounts, setKpiStatusCounts] = useState({ green: 0, yellow: 0, red: 0, missing: 0 });
  const [activeRocksCount, setActiveRocksCount] = useState(0);
  const [myOpenTodosCount, setMyOpenTodosCount] = useState(0);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showStores, setShowStores] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [showDepartmentInfo, setShowDepartmentInfo] = useState(false);
  const [stores, setStores] = useState<any[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>(() => {
    return localStorage.getItem('selectedStore') || "";
  });
  
  const currentWeek = getWeek(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDateRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;

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
      fetchDepartments();
    }
  }, [profile, isSuperAdmin, rolesLoading]);

  useEffect(() => {
    if (selectedStore && profile) {
      // Clear all data when switching stores
      setSelectedDepartment("");
      setKpis([]);
      setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
      setActiveRocksCount(0);
      setMyOpenTodosCount(0);
      
      // Persist selected store
      localStorage.setItem('selectedStore', selectedStore);
      
      // Fetch departments for the new store
      fetchDepartments();
    }
  }, [selectedStore, profile]);

  useEffect(() => {
    if (selectedDepartment) {
      // Persist selected department
      localStorage.setItem('selectedDepartment', selectedDepartment);
      
      // Ensure we fetch all data when department changes
      const fetchAllDepartmentData = async () => {
        await Promise.all([
          fetchKPIs(),
          fetchKPIStatusCounts(),
          fetchActiveRocksCount(),
          fetchMyOpenTodosCount()
        ]);
      };
      fetchAllDepartmentData();
    }
  }, [selectedDepartment]);

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
          fetchKPIStatusCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scorecardChannel);
    };
  }, [selectedDepartment]);

  // Real-time subscription for todos updates
  useEffect(() => {
    if (!selectedDepartment || !user) return;

    const todosChannel = supabase
      .channel('todos-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `department_id=eq.${selectedDepartment}`
        },
        () => {
          // Refresh todos count when any todo changes
          fetchMyOpenTodosCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(todosChannel);
    };
  }, [selectedDepartment, user]);

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

  // Update rocks count when department changes (uses current calendar quarter)
  useEffect(() => {
    if (selectedDepartment) {
      fetchActiveRocksCount();
    }
  }, [selectedDepartment]);

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
        // Only set default if no store is selected
        const savedStore = localStorage.getItem('selectedStore');
        if (savedStore && data.find(s => s.id === savedStore)) {
          setSelectedStore(savedStore);
        } else if (!selectedStore) {
          const firstStore = data[0].id;
          setSelectedStore(firstStore);
          localStorage.setItem('selectedStore', firstStore);
        }
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching stores",
        description: error.message,
      });
    }
  };

  const fetchDepartments = async () => {
    try {
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
        // Other users: filter by their profile's store
        if (profile?.store_id) {
          query = query.eq("store_id", profile.store_id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
      if (data && data.length > 0) {
        // Only set default if no department is selected
        const savedDept = localStorage.getItem('selectedDepartment');
        if (savedDept && data.find(d => d.id === savedDept)) {
          setSelectedDepartment(savedDept);
        } else if (!selectedDepartment) {
          const firstDept = data[0].id;
          setSelectedDepartment(firstDept);
          localStorage.setItem('selectedDepartment', firstDept);
        }
      } else {
        // No departments in this store - clear everything
        setSelectedDepartment("");
        localStorage.removeItem('selectedDepartment');
        setKpis([]);
        setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
      }
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

  const fetchKPIStatusCounts = async () => {
    if (!selectedDepartment) return;

    try {
      // Get all KPIs for this department
      const { data: kpiData, error: kpiError } = await supabase
        .from("kpi_definitions")
        .select("id")
        .eq("department_id", selectedDepartment);

      if (kpiError) throw kpiError;

      if (!kpiData || kpiData.length === 0) {
        setKpiStatusCounts({ green: 0, yellow: 0, red: 0, missing: 0 });
        return;
      }

      const kpiIds = kpiData.map(k => k.id);
      
      // Calculate the previous week (review week) start date
      const previousWeekStart = new Date(weekStart);
      previousWeekStart.setDate(previousWeekStart.getDate() - 7);
      const reviewWeekStart = format(previousWeekStart, 'yyyy-MM-dd');

      // Fetch the most recent entries for the review week (previous week)
      const { data: entries, error: entriesError } = await supabase
        .from("scorecard_entries")
        .select("kpi_id, status")
        .in("kpi_id", kpiIds)
        .eq("week_start_date", reviewWeekStart)
        .eq("entry_type", "weekly");

      if (entriesError) throw entriesError;

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
    if (!selectedDepartment || !user) return;

    try {
      const { count, error } = await supabase
        .from("todos")
        .select("*", { count: "exact", head: true })
        .eq("department_id", selectedDepartment)
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

    setIsEmailLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-scorecard-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            year: selectedYear,
            ...(printMode !== "yearly" && { quarter: selectedQuarter }),
            mode: printMode,
            departmentId: selectedDepartment,
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
        description: "The scorecard has been emailed to you successfully.",
      });
      setPrintDialogOpen(false);
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
      {/* Hidden Print Content - Rendered at root for proper printing */}
      <div className="print-only-content" style={{ display: 'none' }}>
        <PrintView 
          year={selectedYear} 
          quarter={selectedQuarter} 
          mode={printMode} 
          departmentId={selectedDepartment} 
        />
      </div>

      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={goLogo} alt="GO Logo" className="h-10 w-10 rounded-lg" />
              <div>
                <h1 className="text-xl font-bold text-foreground">GO Scorecard</h1>
                <p className="text-sm text-muted-foreground">Growth Operating System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isSuperAdmin && stores.length > 0 && (
                <Select value={selectedStore} onValueChange={setSelectedStore}>
                  <SelectTrigger className="w-[200px]">
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
                  <Button variant="outline" size="sm" onClick={() => setShowDepartments(true)}>
                    <Building className="mr-2 h-4 w-4" />
                    Departments
                  </Button>
                </>
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
              <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Mail className="h-4 w-4 mr-2" />
                    Email Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="no-print" aria-describedby="email-description">
                  <DialogTitle>Email Scorecard Report</DialogTitle>
                  <div id="email-description" className="sr-only">
                    Send scorecard report via email
                  </div>
                  <div className="mb-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold mb-3 block">Report Format</Label>
                    <RadioGroup value={printMode} onValueChange={(value: "weekly" | "monthly" | "yearly") => setPrintMode(value)}>
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
                  <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleEmailScorecard} disabled={isEmailLoading}>
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
              <p className="text-xs text-muted-foreground mt-2">Last week's performance</p>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">My Open To-Dos</CardTitle>
              <CheckSquare className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{myOpenTodosCount}</div>
              <p className="text-xs text-muted-foreground">Tasks assigned to me</p>
            </CardContent>
          </Card>
        </div>

        {/* Scorecard Section */}
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
              />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Select a department to view the scorecard
              </p>
            )}
          </CardContent>
        </Card>

        {/* Financial Summary Section */}
        {selectedDepartment && (
          <FinancialSummary 
            key={`financial-${selectedDepartment}-${selectedYear}-${selectedQuarter}`}
            departmentId={selectedDepartment}
            year={selectedYear}
            quarter={selectedQuarter}
          />
        )}

        {/* Rocks Section */}
        <RocksPanel 
          key={`rocks-${selectedDepartment}`}
          departmentId={selectedDepartment} 
        />

        {/* Meeting Framework */}
        <MeetingFramework 
          key={`meeting-${selectedDepartment}`}
          departmentId={selectedDepartment} 
        />

        {/* Celebrations */}
        <Celebrations currentStoreId={isSuperAdmin ? selectedStore : profile?.store_id} />

        {/* To-Dos Section */}
        <TodosPanel 
          key={`todos-${selectedDepartment}`}
          departmentId={selectedDepartment} 
          userId={user?.id} 
        />

        {/* Director Notes Section */}
        {selectedDepartment && (isSuperAdmin || isStoreGM) && (
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
