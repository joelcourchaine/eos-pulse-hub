import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, Target, CheckSquare, Calendar, Printer } from "lucide-react";
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

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [kpis, setKpis] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printMode, setPrintMode] = useState<"weekly" | "monthly">("monthly");

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
        fetchDepartments();
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchKPIs();
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

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order("name");

      if (error) throw error;
      setDepartments(data || []);
      if (data && data.length > 0) {
        setSelectedDepartment(data[0].id);
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
    setPrintDialogOpen(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  if (loading || !user || !profile) {
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">EOS Scorecard</h1>
                <p className="text-sm text-muted-foreground">Performance Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {departments.length > 0 && (
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Printer className="h-4 w-4 mr-2" />
                    Print PDF
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto no-print" aria-describedby="print-description">
                  <DialogTitle className="sr-only">Print Report</DialogTitle>
                  <div id="print-description" className="sr-only">
                    Preview of all department scorecards and financial data for printing
                  </div>
                  <div className="no-print mb-4 p-4 border rounded-lg bg-muted/30">
                    <Label className="text-sm font-semibold mb-3 block">Print Format</Label>
                    <RadioGroup value={printMode} onValueChange={(value: "weekly" | "monthly") => setPrintMode(value)}>
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
                    </RadioGroup>
                  </div>
                  <div className="print-preview-area">
                    <PrintView year={selectedYear} quarter={selectedQuarter} mode={printMode} departmentId={selectedDepartment} />
                  </div>
                  <div className="flex justify-end gap-2 mt-4 no-print">
                    <Button variant="outline" onClick={() => setPrintDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <UserManagementDialog />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Week 46</div>
              <p className="text-xs text-muted-foreground">Nov 11 - Nov 17</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">KPIs On Track</CardTitle>
              <BarChart3 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">8/12</div>
              <p className="text-xs text-muted-foreground">67% hitting targets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Rocks</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3</div>
              <p className="text-xs text-muted-foreground">Q4 2025 priorities</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open To-Dos</CardTitle>
              <CheckSquare className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">2 due this week</p>
            </CardContent>
          </Card>
        </div>

        {/* Scorecard Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Weekly Scorecard</CardTitle>
                <CardDescription>
                  Track your department's key performance indicators
                </CardDescription>
              </div>
              {selectedDepartment && (
                <KPIManagementDialog 
                  departmentId={selectedDepartment} 
                  kpis={kpis}
                  onKPIsChange={fetchKPIs}
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedDepartment ? (
              <ScorecardGrid 
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
            departmentId={selectedDepartment}
            year={selectedYear}
            quarter={selectedQuarter}
          />
        )}

        {/* Rocks Section */}
        <RocksPanel />

        {/* Meeting Framework */}
        <MeetingFramework />

        {/* Celebrations */}
        <Celebrations />
      </main>
    </div>
  );
};

export default Dashboard;
