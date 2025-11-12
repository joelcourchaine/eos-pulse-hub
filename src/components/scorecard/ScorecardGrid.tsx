import { useState, useEffect, useRef } from "react";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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
  year: number;
  quarter: number;
  onYearChange: (year: number) => void;
  onQuarterChange: (quarter: number) => void;
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

const getWeekDates = (selectedQuarter: { year: number; quarter: number }) => {
  const weeks = [];
  const yearStart = YEAR_STARTS[selectedQuarter.year] || new Date(selectedQuarter.year, 0, 1);
  const quarterStartWeek = (selectedQuarter.quarter - 1) * 13;
  
  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(yearStart);
    weekStart.setDate(yearStart.getDate() + ((quarterStartWeek + i) * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Format as "M/D-M/D" (e.g., "12/30-1/5")
    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endLabel = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    weeks.push({
      start: weekStart,
      label: `${startLabel}-${endLabel}`,
      type: 'week' as const,
    });
  }
  
  return weeks;
};

const getMonthsForQuarter = (selectedQuarter: { year: number; quarter: number }) => {
  const months = [];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Q1: Jan, Feb, Mar (months 0, 1, 2)
  // Q2: Apr, May, Jun (months 3, 4, 5)
  // Q3: Jul, Aug, Sep (months 6, 7, 8)
  // Q4: Oct, Nov, Dec (months 9, 10, 11)
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (selectedQuarter.quarter - 1) * 3 + i;
    
    months.push({
      label: monthNames[monthIndex],
      identifier: `${selectedQuarter.year}-${String(monthIndex + 1).padStart(2, '0')}`,
      type: 'month' as const,
    });
  }
  
  return months;
};

const ScorecardGrid = ({ departmentId, kpis, onKPIsChange, year, quarter, onYearChange, onQuarterChange }: ScorecardGridProps) => {
  const [entries, setEntries] = useState<{ [key: string]: ScorecardEntry }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const currentQuarterInfo = getQuarterInfo(new Date());
  const weeks = getWeekDates({ year, quarter });
  const months = getMonthsForQuarter({ year, quarter });
  const allPeriods = [...weeks, ...months];

  useEffect(() => {
    loadScorecardData();
    fetchProfiles();
  }, [departmentId, kpis, year, quarter]);

  // Update local values when entries change
  useEffect(() => {
    const newLocalValues: { [key: string]: string } = {};
    Object.entries(entries).forEach(([key, entry]) => {
      const kpi = kpis.find(k => entry.kpi_id === k.id);
      if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
        newLocalValues[key] = formatValue(entry.actual_value, kpi.metric_type);
      }
    });
    setLocalValues(prev => {
      // Only update if we don't have pending saves for these keys
      const updated = { ...prev };
      Object.keys(newLocalValues).forEach(key => {
        if (!saveTimeoutRef.current[key]) {
          updated[key] = newLocalValues[key];
        }
      });
      return updated;
    });
  }, [entries, kpis]);

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
    const monthIds = months.map(m => m.identifier);

    const { data, error } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpiIds)
      .or(`week_start_date.in.(${weekDates.join(',')}),month.in.(${monthIds.join(',')})`);

    if (error) {
      toast({ title: "Error", description: "Failed to load scorecard data", variant: "destructive" });
      setLoading(false);
      return;
    }

    const entriesMap: { [key: string]: ScorecardEntry } = {};
    data?.forEach(entry => {
      const key = entry.entry_type === 'monthly' 
        ? `${entry.kpi_id}-month-${entry.month}`
        : `${entry.kpi_id}-${entry.week_start_date}`;
      entriesMap[key] = entry;
    });

    setEntries(entriesMap);
    setLoading(false);
  };

  const handleValueChange = (kpiId: string, periodKey: string, value: string, target: number, type: string, isMonthly: boolean, monthId?: string) => {
    const key = isMonthly ? `${kpiId}-month-${monthId}` : `${kpiId}-${periodKey}`;
    
    // Update local state immediately for responsive UI
    setLocalValues(prev => ({ ...prev, [key]: value }));

    // Clear existing timeout for this field
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current[key] = setTimeout(async () => {
      const actualValue = parseFloat(value) || null;

      if (actualValue === null) return;

      setSaving(prev => ({ ...prev, [key]: true }));

      const variance = type === "percentage" 
        ? actualValue - target 
        : ((actualValue - target) / target) * 100;

      const status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";

      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      const entryData: any = {
        kpi_id: kpiId,
        actual_value: actualValue,
        variance,
        status,
        created_by: userId,
        entry_type: isMonthly ? 'monthly' : 'weekly',
      };

      if (isMonthly) {
        entryData.month = monthId;
      } else {
        entryData.week_start_date = periodKey;
      }

      const { error } = await supabase
        .from("scorecard_entries")
        .upsert(entryData, {
          onConflict: isMonthly ? "kpi_id,month" : "kpi_id,week_start_date"
        });

      if (error) {
        toast({ title: "Error", description: "Failed to save entry", variant: "destructive" });
      } else {
        await loadScorecardData();
      }

      setSaving(prev => ({ ...prev, [key]: false }));
      delete saveTimeoutRef.current[key]; // Clear timeout ref after save completes
    }, 800); // Wait 800ms after user stops typing
  };

  const getStatus = (status: string | null) => {
    if (!status) return "default";
    if (status === "green") return "success";
    if (status === "yellow") return "warning";
    return "destructive";
  };

  const formatValue = (value: number | null, type: string) => {
    if (value === null || value === undefined) return "";
    // Don't format with commas for input fields - number inputs don't accept them
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
      {/* Quarter Controls */}
      <div className="flex items-center gap-2">
        <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2025">2025</SelectItem>
            <SelectItem value="2026">2026</SelectItem>
            <SelectItem value="2027">2027</SelectItem>
          </SelectContent>
        </Select>
        <Select value={quarter.toString()} onValueChange={(v) => onQuarterChange(parseInt(v))}>
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

      <div
        ref={scrollContainerRef}
        className="relative border rounded-lg overflow-x-auto"
      >
        <div className="min-w-[2400px]">
        <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="sticky left-0 bg-muted/50 z-20 min-w-[200px] font-bold py-2 border-r">
              KPI
            </TableHead>
            <TableHead className="sticky left-[200px] bg-muted/50 z-20 text-center font-bold min-w-[100px] py-2 border-r">Target</TableHead>
            {weeks.map((week) => (
              <TableHead key={week.label} className="text-center min-w-[110px] text-xs py-2">
                {week.label}
              </TableHead>
            ))}
            {months.map((month) => (
              <TableHead key={month.identifier} className="text-center min-w-[140px] bg-primary/10 font-bold border-l-2 py-2">
                {month.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {kpis.map((kpi, index) => {
            const showOwnerHeader = index === 0 || kpi.assigned_to !== kpis[index - 1]?.assigned_to;
            const owner = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
            const ownerName = owner?.full_name || "Unassigned";
            const ownerInitials = owner?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || "U";
            
            return (
              <React.Fragment key={kpi.id}>
                {showOwnerHeader && (
                  <TableRow key={`owner-${kpi.assigned_to || 'unassigned'}`} className="bg-muted/50">
                    <TableCell className="sticky left-0 z-10 bg-muted/50 py-1 border-r">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {ownerInitials}
                          </span>
                        </div>
                        <span className="font-semibold text-sm">{ownerName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="sticky left-[200px] z-10 bg-muted/50 py-1 border-r" />
                    <TableCell colSpan={weeks.length + months.length} className="bg-muted/50 py-1" />
                  </TableRow>
                )}
                <TableRow className="hover:bg-muted/30">
                  <TableCell className="sticky left-0 bg-background z-10 font-medium pl-8 py-2 border-r">
                    {kpi.name}
                  </TableCell>
                  <TableCell className="sticky left-[200px] bg-background z-10 text-center text-muted-foreground py-2 border-r">
                    {formatTarget(kpi.target_value, kpi.metric_type)}
                  </TableCell>
                  {weeks.map((week) => {
                    const weekDate = week.start.toISOString().split('T')[0];
                    const key = `${kpi.id}-${weekDate}`;
                    const entry = entries[key];
                    const status = getStatus(entry?.status || null);
                    const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type);
                    
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
                          value={displayValue}
                          onChange={(e) =>
                            handleValueChange(kpi.id, weekDate, e.target.value, kpi.target_value, kpi.metric_type, false)
                          }
                          className={cn(
                            "text-center border-0 bg-transparent focus-visible:ring-1 h-8",
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
                  {months.map((month) => {
                    const key = `${kpi.id}-month-${month.identifier}`;
                    const entry = entries[key];
                    const status = getStatus(entry?.status || null);
                    const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type);
                    
                    return (
                      <TableCell
                        key={month.identifier}
                        className={cn(
                          "p-1 relative border-l-2",
                          status === "success" && "bg-success/10",
                          status === "warning" && "bg-warning/10",
                          status === "destructive" && "bg-destructive/10"
                        )}
                      >
                        <Input
                          type="number"
                          step="any"
                          value={displayValue}
                          onChange={(e) =>
                            handleValueChange(kpi.id, '', e.target.value, kpi.target_value, kpi.metric_type, true, month.identifier)
                          }
                          className={cn(
                            "text-center border-0 bg-transparent focus-visible:ring-1 h-8",
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
              </React.Fragment>
            );
          })}
        </TableBody>
        </Table>
        </div>
      </div>
    </div>
  );
};

export default ScorecardGrid;
