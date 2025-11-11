import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
}

interface Profile {
  id: string;
  full_name: string;
}

interface ScorecardEntry {
  id: string;
  kpi_id: string;
  week_start_date: string;
  actual_value: number | null;
  variance: number | null;
  status: string | null;
}

interface ScorecardGridProps {
  departmentId: string;
  kpis: KPI[];
  onKPIsChange: () => void;
}

// Custom year starts: 2025 starts on Dec 30, 2024 (Monday)
const YEAR_STARTS: { [key: number]: Date } = {
  2025: new Date(2024, 11, 30), // Dec 30, 2024
  2026: new Date(2025, 11, 29), // Dec 29, 2025 (Monday)
  2027: new Date(2026, 11, 28), // Dec 28, 2026 (Monday)
};

const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // If Sunday (0), go back 6 days, else go to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getQuarterInfo = (date: Date): { year: number; quarter: number; weekInQuarter: number } => {
  const monday = getMondayOfWeek(date);
  
  // Determine which fiscal year this date belongs to
  let fiscalYear = monday.getFullYear();
  if (monday.getMonth() === 11 && monday.getDate() >= 28) {
    fiscalYear = monday.getFullYear() + 1;
  }
  
  const yearStart = YEAR_STARTS[fiscalYear] || new Date(fiscalYear, 0, 1);
  const daysSinceYearStart = Math.floor((monday.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
  const weeksSinceYearStart = Math.floor(daysSinceYearStart / 7);
  
  const quarter = Math.floor(weeksSinceYearStart / 13) + 1;
  const weekInQuarter = (weeksSinceYearStart % 13) + 1;
  
  return { year: fiscalYear, quarter: Math.min(quarter, 4), weekInQuarter };
};

const getWeekDates = (viewType: "weekly" | "quarterly", selectedQuarter?: { year: number; quarter: number }) => {
  const weeks = [];
  const today = new Date();
  
  if (viewType === "weekly") {
    const currentMonday = getMondayOfWeek(today);
    
    for (let i = -3; i <= 3; i++) {
      const weekStart = new Date(currentMonday);
      weekStart.setDate(currentMonday.getDate() + (i * 7));
      weeks.push({
        start: weekStart,
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
      });
    }
  } else if (viewType === "quarterly" && selectedQuarter) {
    const yearStart = YEAR_STARTS[selectedQuarter.year] || new Date(selectedQuarter.year, 0, 1);
    const quarterStartWeek = (selectedQuarter.quarter - 1) * 13;
    
    for (let i = 0; i < 13; i++) {
      const weekStart = new Date(yearStart);
      weekStart.setDate(yearStart.getDate() + ((quarterStartWeek + i) * 7));
      const weekInfo = getQuarterInfo(weekStart);
      weeks.push({
        start: weekStart,
        label: `W${weekInfo.weekInQuarter}`,
      });
    }
  }
  
  return weeks;
};

const ScorecardGrid = ({ departmentId, kpis, onKPIsChange }: ScorecardGridProps) => {
  const [entries, setEntries] = useState<{ [key: string]: ScorecardEntry }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [viewType, setViewType] = useState<"weekly" | "quarterly">("weekly");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedQuarter, setSelectedQuarter] = useState(1);
  const { toast } = useToast();
  
  const currentQuarterInfo = getQuarterInfo(new Date());
  const weeks = getWeekDates(
    viewType, 
    viewType === "quarterly" ? { year: selectedYear, quarter: selectedQuarter } : undefined
  );

  useEffect(() => {
    loadScorecardData();
    fetchProfiles();
  }, [departmentId, kpis, viewType, selectedYear, selectedQuarter]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    const profilesMap: { [key: string]: Profile } = {};
    data?.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
    setProfiles(profilesMap);
  };

  const loadScorecardData = async () => {
    if (!departmentId || kpis.length === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const kpiIds = kpis.map(k => k.id);
    const weekDates = weeks.map(w => w.start.toISOString().split('T')[0]);

    const { data, error } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpiIds)
      .in("week_start_date", weekDates);

    if (error) {
      toast({ title: "Error", description: "Failed to load scorecard data", variant: "destructive" });
      setLoading(false);
      return;
    }

    const entriesMap: { [key: string]: ScorecardEntry } = {};
    data?.forEach(entry => {
      const key = `${entry.kpi_id}-${entry.week_start_date}`;
      entriesMap[key] = entry;
    });

    setEntries(entriesMap);
    setLoading(false);
  };

  const handleValueChange = async (kpiId: string, weekDate: string, value: string, target: number, type: string) => {
    const key = `${kpiId}-${weekDate}`;
    const actualValue = parseFloat(value) || null;

    if (actualValue === null) return;

    setSaving(prev => ({ ...prev, [key]: true }));

    const variance = type === "percentage" 
      ? actualValue - target 
      : ((actualValue - target) / target) * 100;

    const status = variance >= 0 ? "on_track" : variance >= -10 ? "at_risk" : "off_track";

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;

    const { error } = await supabase
      .from("scorecard_entries")
      .upsert({
        kpi_id: kpiId,
        week_start_date: weekDate,
        actual_value: actualValue,
        variance,
        status,
        created_by: userId,
      }, {
        onConflict: "kpi_id,week_start_date"
      });

    if (error) {
      toast({ title: "Error", description: "Failed to save entry", variant: "destructive" });
    } else {
      await loadScorecardData();
    }

    setSaving(prev => ({ ...prev, [key]: false }));
  };

  const getStatus = (status: string | null) => {
    if (!status) return "default";
    if (status === "on_track") return "success";
    if (status === "at_risk") return "warning";
    return "destructive";
  };

  const formatValue = (value: number | null, type: string) => {
    if (value === null || value === undefined) return "";
    if (type === "dollar") return `${value.toLocaleString()}`;
    if (type === "percentage") return `${value}`;
    return value.toString();
  };

  const formatTarget = (value: number, type: string) => {
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${value}%`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (kpis.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-muted-foreground mb-4">No KPIs defined for this department yet.</p>
        <p className="text-sm text-muted-foreground">Click "Manage KPIs" to add your first metric.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant={viewType === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("weekly")}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Weekly View
          </Button>
          <Button
            variant={viewType === "quarterly" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setViewType("quarterly");
              setSelectedYear(currentQuarterInfo.year);
              setSelectedQuarter(currentQuarterInfo.quarter);
            }}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Quarterly View
          </Button>
        </div>
        
        {viewType === "quarterly" && (
          <div className="flex items-center gap-2">
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedQuarter.toString()} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px] font-bold">
              KPI
            </TableHead>
            <TableHead className="text-center font-bold min-w-[100px]">Target</TableHead>
            {weeks.map((week) => (
              <TableHead key={week.label} className="text-center min-w-[120px]">
                Week {week.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {kpis.map((kpi, index) => {
            const showOwnerHeader = index === 0 || kpi.assigned_to !== kpis[index - 1]?.assigned_to;
            const owner = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
            
            return (
              <>
                {showOwnerHeader && kpi.assigned_to && (
                  <TableRow key={`owner-${kpi.assigned_to}`} className="bg-muted/50">
                    <TableCell colSpan={2} className="sticky left-0 z-10 bg-muted/50">
                      <div className="flex items-center gap-2 py-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {owner?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-sm">{owner?.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell colSpan={weeks.length} className="bg-muted/50" />
                  </TableRow>
                )}
                <TableRow key={kpi.id} className="hover:bg-muted/30">
                  <TableCell className="sticky left-0 bg-background z-10 font-medium pl-8">
                    {kpi.name}
                  </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {formatTarget(kpi.target_value, kpi.metric_type)}
              </TableCell>
              {weeks.map((week) => {
                const weekDate = week.start.toISOString().split('T')[0];
                const key = `${kpi.id}-${weekDate}`;
                const entry = entries[key];
                const status = getStatus(entry?.status || null);
                
                return (
                  <TableCell
                    key={week.label}
                    className={cn(
                      "p-1 relative",
                      status === "success" && "bg-success/10",
                      status === "warning" && "bg-warning/10",
                      status === "destructive" && "bg-destructive/10"
                    )}
                  >
                    <Input
                      type="number"
                      step="any"
                      value={formatValue(entry?.actual_value || null, kpi.metric_type)}
                      onChange={(e) =>
                        handleValueChange(kpi.id, weekDate, e.target.value, kpi.target_value, kpi.metric_type)
                      }
                      className={cn(
                        "text-center border-0 bg-transparent focus-visible:ring-1",
                        status === "success" && "text-success font-medium",
                        status === "warning" && "text-warning font-medium",
                        status === "destructive" && "text-destructive font-medium"
                      )}
                      placeholder="-"
                      disabled={saving[key]}
                    />
                    {saving[key] && (
                      <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}
                  </TableCell>
                );
              })}
                </TableRow>
              </>
            );
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  );
};

export default ScorecardGrid;
