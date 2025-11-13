import { useState, useEffect, useRef } from "react";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CalendarDays } from "lucide-react";

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
  target_direction: "above" | "below";
}

interface KPITarget {
  kpi_id: string;
  target_value: number;
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
  const [kpiTargets, setKpiTargets] = useState<{ [key: string]: number }>({});
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const currentQuarterInfo = getQuarterInfo(new Date());
  const weeks = getWeekDates({ year, quarter });
  const months = getMonthsForQuarter({ year, quarter });
  const allPeriods = [...weeks, ...months];
  
  // Get current week's Monday to highlight it
  const today = new Date();
  const currentWeekMonday = getMondayOfWeek(today);
  const currentWeekDate = currentWeekMonday.toISOString().split('T')[0];
  
  // Get previous week's Monday (week before current)
  const previousWeekMonday = new Date(currentWeekMonday);
  previousWeekMonday.setDate(previousWeekMonday.getDate() - 7);
  const previousWeekDate = previousWeekMonday.toISOString().split('T')[0];

  useEffect(() => {
    loadScorecardData();
    fetchProfiles();
    loadKPITargets();
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

  const loadKPITargets = async () => {
    if (!kpis.length) return;

    const kpiIds = kpis.map(k => k.id);
    const { data, error } = await supabase
      .from("kpi_targets")
      .select("*")
      .in("kpi_id", kpiIds)
      .eq("quarter", quarter)
      .eq("year", year);

    if (error) {
      console.error("Error loading KPI targets:", error);
      return;
    }

    const targetsMap: { [key: string]: number } = {};
    data?.forEach(target => {
      targetsMap[target.kpi_id] = target.target_value || 0;
    });

    // For KPIs without quarterly targets, fall back to default target_value
    kpis.forEach(kpi => {
      if (!targetsMap[kpi.id]) {
        targetsMap[kpi.id] = kpi.target_value;
      }
    });

    setKpiTargets(targetsMap);
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

  const handleValueChange = (kpiId: string, periodKey: string, value: string, target: number, type: string, targetDirection: "above" | "below", isMonthly: boolean, monthId?: string) => {
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

      setSaving(prev => ({ ...prev, [key]: true }));

      // If value is empty/null, delete the entry
      if (actualValue === null || value === '') {
        const { error } = await supabase
          .from("scorecard_entries")
          .delete()
          .eq("kpi_id", kpiId)
          .eq(isMonthly ? "month" : "week_start_date", isMonthly ? monthId : periodKey);

        if (error) {
          toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
        } else {
          // Remove from local state
          setEntries(prev => {
            const newEntries = { ...prev };
            delete newEntries[key];
            return newEntries;
          });
        }

        setSaving(prev => ({ ...prev, [key]: false }));
        delete saveTimeoutRef.current[key];
        return;
      }

      const variance = type === "percentage" 
        ? actualValue - target 
        : ((actualValue - target) / target) * 100;

      // Calculate status based on target direction
      let status: string;
      if (targetDirection === "above") {
        // Higher is better
        status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
      } else {
        // Lower is better (invert the logic)
        status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
      }

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

      const { data, error } = await supabase
        .from("scorecard_entries")
        .upsert(entryData, {
          onConflict: isMonthly ? "kpi_id,month" : "kpi_id,week_start_date"
        })
        .select()
        .single();

      if (error) {
        toast({ title: "Error", description: "Failed to save entry", variant: "destructive" });
      } else if (data) {
        // Update local state directly without reloading
        setEntries(prev => ({
          ...prev,
          [key]: data as ScorecardEntry
        }));
      }

      setSaving(prev => ({ ...prev, [key]: false }));
      delete saveTimeoutRef.current[key];
    }, 800);
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

  const getMonthlyTarget = (weeklyTarget: number, targetDirection: "above" | "below", metricType: string) => {
    // If percentage, keep the same target
    if (metricType === "percentage") {
      return weeklyTarget;
    }
    
    // If below target direction (lower is better), keep the same target
    if (targetDirection === "below") {
      return weeklyTarget;
    }
    
    // If above target direction (higher is better) and not percentage, multiply by 4
    return weeklyTarget * 4;
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={(new Date().getFullYear() - 1).toString()}>
                {new Date().getFullYear() - 1}
              </SelectItem>
              <SelectItem value={new Date().getFullYear().toString()}>
                {new Date().getFullYear()}
              </SelectItem>
              <SelectItem value={(new Date().getFullYear() + 1).toString()}>
                {new Date().getFullYear() + 1}
              </SelectItem>
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
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(viewMode === "weekly" ? "monthly" : "weekly")}
          className="gap-2"
        >
          {viewMode === "weekly" ? (
            <>
              <Calendar className="h-4 w-4" />
              View Monthly
            </>
          ) : (
            <>
              <CalendarDays className="h-4 w-4" />
              View Weekly
            </>
          )}
        </Button>
      </div>

      <div className="relative">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto border rounded-lg"
        >
          <Table className="relative" style={{ tableLayout: 'fixed', width: 'max-content' }}>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead 
                  className="bg-muted z-20 min-w-[200px] font-bold py-2 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
                  style={{ position: 'sticky', left: 0 }}
                >
                  KPI
                </TableHead>
                <TableHead 
                  className="bg-muted z-20 text-center font-bold min-w-[100px] py-2 border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
                  style={{ position: 'sticky', left: '200px' }}
                >
                  Q{quarter} Target
                </TableHead>
            {viewMode === "weekly" ? weeks.map((week) => {
              const weekDate = week.start.toISOString().split('T')[0];
              const isCurrentWeek = weekDate === currentWeekDate;
              const isPreviousWeek = weekDate === previousWeekDate;
              const isCurrentOrPast = week.start <= today;
              
              // Calculate status counts for this week
              const statusCounts = { green: 0, yellow: 0, red: 0, gray: 0 };
              if (isCurrentOrPast) {
                kpis.forEach(kpi => {
                  const key = `${kpi.id}-${weekDate}`;
                  const entry = entries[key];
                  
                  if (entry?.status === 'green') statusCounts.green++;
                  else if (entry?.status === 'yellow') statusCounts.yellow++;
                  else if (entry?.status === 'red') statusCounts.red++;
                  else statusCounts.gray++;
                });
              }
              
              return (
                <TableHead 
                  key={week.label} 
                  className={cn(
                    "text-center min-w-[125px] max-w-[125px] text-xs py-2",
                    isCurrentWeek && "bg-primary/20 font-bold border-l-2 border-r-2 border-primary",
                    isPreviousWeek && "bg-accent/30 font-bold border-l-2 border-r-2 border-accent"
                  )}
                >
                  {isCurrentOrPast && (
                    <div className="flex flex-col gap-0.5 items-center mb-1 text-[10px] font-semibold">
                      <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">{statusCounts.green}</span>
                      <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">{statusCounts.yellow}</span>
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">{statusCounts.red}</span>
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">{statusCounts.gray}</span>
                    </div>
                  )}
                  <div className="text-xs font-semibold">{week.label}</div>
                  {isCurrentWeek && <div className="text-[10px] text-primary font-semibold">Current</div>}
                  {isPreviousWeek && <div className="text-[10px] text-accent-foreground font-semibold">Review</div>}
                </TableHead>
              );
            }) : months.map((month) => (
              <TableHead 
                key={month.label} 
                className="text-center min-w-[150px] max-w-[150px] text-sm py-2 font-bold"
              >
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
                    <TableCell 
                      className="z-10 bg-muted py-1 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      style={{ position: 'sticky', left: 0 }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-xs font-semibold text-primary">
                            {ownerInitials}
                          </span>
                        </div>
                        <span className="font-semibold text-sm">{ownerName}</span>
                      </div>
                    </TableCell>
                    <TableCell 
                      className="z-10 bg-muted py-1 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      style={{ position: 'sticky', left: '200px' }}
                    />
                    <TableCell colSpan={weeks.length + months.length} className="bg-muted/50 py-1" />
                  </TableRow>
                )}
                <TableRow className="hover:bg-muted/30">
                  <TableCell 
                    className="bg-background z-10 font-medium pl-8 py-2 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: 0 }}
                  >
                    {kpi.name}
                  </TableCell>
                  <TableCell 
                    className="bg-background z-10 text-center text-muted-foreground py-2 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: '200px' }}
                  >
                    {formatTarget(kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type)}
                  </TableCell>
                  {viewMode === "weekly" ? weeks.map((week) => {
                    const weekDate = week.start.toISOString().split('T')[0];
                    const key = `${kpi.id}-${weekDate}`;
                    const entry = entries[key];
                    const status = getStatus(entry?.status || null);
                    const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type);
                    const isCurrentWeek = weekDate === currentWeekDate;
                    
                    return (
                      <TableCell
                        key={week.label}
                        className={cn(
                          "p-1 relative min-w-[125px] max-w-[125px]",
                          status === "success" && "bg-success/10",
                          status === "warning" && "bg-warning/10",
                          status === "destructive" && "bg-destructive/10",
                          isCurrentWeek && "border-l-2 border-r-2 border-primary bg-primary/5"
                        )}
                      >
                        <div className="relative flex items-center justify-center gap-0">
                          {kpi.metric_type === "dollar" && (
                            <span className="text-muted-foreground text-sm">$</span>
                          )}
                           <Input
                            type="number"
                            step="any"
                            value={displayValue}
                            onChange={(e) =>
                              handleValueChange(kpi.id, weekDate, e.target.value, kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type, kpi.target_direction, false)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const currentKpiIndex = kpis.findIndex(k => k.id === kpi.id);
                                const currentPeriodIndex = weeks.findIndex(w => w.start.toISOString().split('T')[0] === weekDate);
                                
                                if (currentKpiIndex < kpis.length - 1) {
                                  const nextInput = document.querySelector(
                                    `input[data-kpi-index="${currentKpiIndex + 1}"][data-period-index="${currentPeriodIndex}"]`
                                  ) as HTMLInputElement;
                                  nextInput?.focus();
                                  nextInput?.select();
                                }
                              }
                            }}
                            data-kpi-index={index}
                            data-period-index={weeks.findIndex(w => w.start.toISOString().split('T')[0] === weekDate)}
                            className={cn(
                              "text-center border-0 bg-transparent focus-visible:ring-1 h-8 flex-1 min-w-0 max-w-[105px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              status === "success" && "text-success font-medium",
                              status === "warning" && "text-warning font-medium",
                              status === "destructive" && "text-destructive font-medium"
                            )}
                            placeholder="-"
                            disabled={saving[key]}
                          />
                          {kpi.metric_type === "percentage" && (
                            <span className="text-muted-foreground text-sm">%</span>
                          )}
                          {saving[key] && (
                            <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          )}
                        </div>
                      </TableCell>
                    );
                  }) : months.map((month) => {
                    // Aggregate weekly data for this month
                    const monthWeeks = weeks.filter(week => {
                      const weekMonth = `${week.start.getFullYear()}-${String(week.start.getMonth() + 1).padStart(2, '0')}`;
                      return weekMonth === month.identifier;
                    });
                    
                    const monthValues = monthWeeks.map(week => {
                      const weekDate = week.start.toISOString().split('T')[0];
                      const key = `${kpi.id}-${weekDate}`;
                      return entries[key]?.actual_value;
                    }).filter(v => v !== null && v !== undefined) as number[];
                    
                    let monthValue: number | null = null;
                    let status: "default" | "success" | "warning" | "destructive" = "default";
                    
                    if (monthValues.length > 0) {
                      // For dollar and unit metrics, sum the values
                      // For percentage metrics, average the values
                      if (kpi.metric_type === "percentage") {
                        monthValue = monthValues.reduce((a, b) => a + b, 0) / monthValues.length;
                      } else {
                        monthValue = monthValues.reduce((a, b) => a + b, 0);
                      }
                      
                      // Calculate status based on target
                      const target = kpiTargets[kpi.id] || kpi.target_value;
                      const variance = monthValue - target;
                      const percentVariance = target !== 0 ? (variance / target) * 100 : 0;
                      
                      if (kpi.target_direction === "above") {
                        if (percentVariance >= 0) status = "success";
                        else if (percentVariance >= -10) status = "warning";
                        else status = "destructive";
                      } else {
                        if (percentVariance <= 0) status = "success";
                        else if (percentVariance <= 10) status = "warning";
                        else status = "destructive";
                      }
                    }
                    
                    return (
                      <TableCell
                        key={month.label}
                        className={cn(
                          "p-2 text-center min-w-[150px] max-w-[150px]",
                          status === "success" && "bg-success/10 text-success font-medium",
                          status === "warning" && "bg-warning/10 text-warning font-medium",
                          status === "destructive" && "bg-destructive/10 text-destructive font-medium"
                        )}
                      >
                         {monthValue !== null ? formatValue(monthValue, kpi.metric_type) : "-"}
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
