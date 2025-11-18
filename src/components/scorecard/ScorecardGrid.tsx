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
import { SetKPITargetsDialog } from "./SetKPITargetsDialog";

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

const getLast13Months = () => {
  const months = [];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  
  // Generate 13 months ending with current month
  for (let i = 12; i >= 0; i--) {
    const monthDate = new Date(currentYear, currentMonth - i, 1);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    months.push({
      label: monthNames[month],
      identifier: `${year}-${String(month + 1).padStart(2, '0')}`,
      year: year,
      month: month + 1,
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
  const months = getLast13Months();
  const allPeriods = viewMode === "weekly" ? weeks : months;
  
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
  }, [departmentId, kpis, year, quarter, viewMode]);

  // Update local values when entries change
  useEffect(() => {
    const newLocalValues: { [key: string]: string } = {};
    Object.entries(entries).forEach(([key, entry]) => {
      const kpi = kpis.find(k => entry.kpi_id === k.id);
      if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
        newLocalValues[key] = formatValue(entry.actual_value, kpi.metric_type, kpi.name);
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
    // Clear existing data to prevent stale data from showing
    setEntries({});
    setLocalValues({});
    
    const kpiIds = kpis.map((k) => k.id);
    
    if (viewMode === "weekly") {
      // For weeks: fetch weekly entries for this quarter
      const weekDates = weeks.map(w => w.start.toISOString().split('T')[0]);
      
      const { data: weeklyData, error: weeklyError } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "weekly")
        .in("week_start_date", weekDates);

      if (weeklyError) {
        console.error("Error loading weekly data:", weeklyError);
        toast({
          title: "Error",
          description: "Failed to load weekly scorecard data",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const newEntries: { [key: string]: ScorecardEntry } = {};
      weeklyData?.forEach((entry) => {
        const key = `${entry.kpi_id}-${entry.week_start_date}`;
        newEntries[key] = entry;
      });
      setEntries(newEntries);
    } else {
      // For months: fetch monthly entries for last 13 months
      const monthIdentifiers = months.map(m => m.identifier);
      const { data: monthlyData, error: monthlyError } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "monthly")
        .in("month", monthIdentifiers);

      if (monthlyError) {
        console.error("Error loading monthly data:", monthlyError);
        toast({
          title: "Error",
          description: "Failed to load monthly scorecard data",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const newEntries: { [key: string]: ScorecardEntry } = {};
      monthlyData?.forEach((entry) => {
        const key = `${entry.kpi_id}-month-${entry.month}`;
        newEntries[key] = entry;
      });
      setEntries(newEntries);
    }

    setLoading(false);
  };

  const calculateDependentKPIs = async (changedKpiId: string, periodKey: string, isMonthly: boolean, monthId?: string, updatedEntries?: { [key: string]: ScorecardEntry }) => {
    const changedKpi = kpis.find(k => k.id === changedKpiId);
    if (!changedKpi) return;

    // Use the updated entries if provided, otherwise use state
    const currentEntries = updatedEntries || entries;

    // Define calculation rules
    const calculationRules: { [key: string]: { numerator: string, denominator: string } } = {
      "CP Labour Sales Per RO": { numerator: "CP Labour Sales", denominator: "CP RO's" },
      "CP Hours Per RO": { numerator: "CP Hours", denominator: "CP RO's" },
      "CP ELR": { numerator: "CP Labour Sales", denominator: "CP Hours" },
    };

    // Find KPIs that need to be calculated based on the changed KPI
    for (const kpi of kpis) {
      const rule = calculationRules[kpi.name];
      if (!rule) continue;

      // Check if the changed KPI is part of this calculation
      if (rule.numerator !== changedKpi.name && rule.denominator !== changedKpi.name) continue;

      // CRITICAL: Find the numerator and denominator KPIs that belong to the SAME OWNER as the calculated KPI
      const numeratorKpi = kpis.find(k => k.name === rule.numerator && k.assigned_to === kpi.assigned_to);
      const denominatorKpi = kpis.find(k => k.name === rule.denominator && k.assigned_to === kpi.assigned_to);

      if (!numeratorKpi || !denominatorKpi) continue;

      // Get the values for this period
      const numeratorKey = isMonthly ? `${numeratorKpi.id}-month-${monthId}` : `${numeratorKpi.id}-${periodKey}`;
      const denominatorKey = isMonthly ? `${denominatorKpi.id}-month-${monthId}` : `${denominatorKpi.id}-${periodKey}`;

      const numeratorEntry = currentEntries[numeratorKey];
      const denominatorEntry = currentEntries[denominatorKey];

      const numeratorValue = numeratorEntry?.actual_value;
      const denominatorValue = denominatorEntry?.actual_value;

      console.log('📈 Values:', { numeratorValue, denominatorValue });

      // Only calculate if both values exist and denominator is not zero
      if (numeratorValue && denominatorValue && denominatorValue !== 0) {
        console.log('✅ Calculating:', kpi.name, '=', numeratorValue, '/', denominatorValue);
        let calculatedValue = numeratorValue / denominatorValue;
        
        // Round CP Hours Per RO to 1 decimal place
        if (kpi.name === "CP Hours Per RO") {
          calculatedValue = Math.round(calculatedValue * 10) / 10;
        }
        
        const target = kpiTargets[kpi.id] || kpi.target_value;
        
        const variance = kpi.metric_type === "percentage" 
          ? calculatedValue - target 
          : ((calculatedValue - target) / target) * 100;

        let status: string;
        if (kpi.target_direction === "above") {
          status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
        } else {
          status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
        }

        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;

        const entryData: any = {
          kpi_id: kpi.id,
          actual_value: calculatedValue,
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

        if (!error && data) {
          const calculatedKey = isMonthly ? `${kpi.id}-month-${monthId}` : `${kpi.id}-${periodKey}`;
          console.log('💾 Saved calculated value:', kpi.name, '=', calculatedValue);
          
          // Update entries using functional form
          setEntries(prev => ({
            ...prev,
            [calculatedKey]: data as ScorecardEntry
          }));
          
          // Clear local value so display shows the saved value from entries
          setLocalValues(prev => {
            const newLocalValues = { ...prev };
            delete newLocalValues[calculatedKey];
            return newLocalValues;
          });
        } else if (error) {
          console.error('❌ Failed to save calculated value:', error);
        }
      } else {
        console.log('⚠️ Skipping calculation - missing values');
      }
    }
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
        // Update entries state using functional form to get the latest state
        let latestEntries: Record<string, ScorecardEntry> = {};
        setEntries(prev => {
          latestEntries = {
            ...prev,
            [key]: data as ScorecardEntry
          };
          return latestEntries;
        });
        
        // Clear local value so input shows the saved value from entries
        setLocalValues(prev => {
          const newLocalValues = { ...prev };
          delete newLocalValues[key];
          return newLocalValues;
        });

        // Auto-calculate dependent KPIs with the updated entries
        await calculateDependentKPIs(kpiId, periodKey, isMonthly, monthId, latestEntries);
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

  const formatValue = (value: number | null, type: string, kpiName?: string) => {
    if (value === null || value === undefined) return "";
    // CP Hours per RO should always show 1 decimal place
    if (kpiName === "CP Hours per RO") {
      return Number(value).toFixed(1);
    }
    // Don't format with commas for input fields - number inputs don't accept them
    return value.toString();
  };

  const formatTarget = (value: number, type: string, kpiName?: string) => {
    // CP Hours per RO should always show 1 decimal place
    if (kpiName === "CP Hours per RO") {
      return Number(value).toFixed(1);
    }
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

  // Check if a KPI is automatically calculated
  const isCalculatedKPI = (kpiName: string): boolean => {
    const calculatedKPIs = [
      "CP Labour Sales Per RO",
      "CP Hours Per RO", 
      "CP ELR"
    ];
    return calculatedKPIs.includes(kpiName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quarter Controls - Always visible */}
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
        
        <div className="flex items-center gap-2">
          {kpis.length > 0 && (
            <>
              <SetKPITargetsDialog
                departmentId={departmentId}
                kpis={kpis}
                currentYear={year}
                currentQuarter={quarter}
                onTargetsChange={() => {
                  loadKPITargets();
                  loadScorecardData();
                }}
              />
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
            </>
          )}
        </div>
      </div>

      {kpis.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">No KPIs defined for this department yet.</p>
          <p className="text-sm text-muted-foreground">Click "Manage KPIs" to add your first metric.</p>
        </div>
      ) : (
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto border rounded-lg"
        >
          <Table className="relative" style={{ tableLayout: 'fixed', width: 'max-content' }}>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead 
                  className="bg-muted z-20 min-w-[200px] font-bold py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
                  style={{ position: 'sticky', left: 0 }}
                >
                  KPI
                </TableHead>
                <TableHead 
                  className="bg-muted z-20 text-center font-bold min-w-[100px] py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]"
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
                    "text-center min-w-[125px] max-w-[125px] text-xs py-[7.2px]",
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
                key={month.identifier} 
                className="text-center min-w-[120px] max-w-[120px] text-xs py-[7.2px] font-bold"
              >
                <div className="text-xs font-semibold">{month.label}</div>
                <div className="text-[10px] text-muted-foreground">{month.year}</div>
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
                    className="bg-background z-10 font-medium pl-8 py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: 0 }}
                  >
                    {kpi.name}
                  </TableCell>
                  <TableCell 
                    className="bg-background z-10 text-center text-muted-foreground py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: '200px' }}
                  >
                    {formatTarget(kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type)}
                  </TableCell>
                  {viewMode === "weekly" ? weeks.map((week) => {
                    const weekDate = week.start.toISOString().split('T')[0];
                    const key = `${kpi.id}-${weekDate}`;
                    const entry = entries[key];
                    const status = getStatus(entry?.status || null);
                    const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type, kpi.name);
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
                        <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                          {entry?.actual_value !== null && entry?.actual_value !== undefined ? (
                            // Display formatted value when data exists
                            <div 
                              className={cn(
                                "h-full w-full flex items-center justify-center cursor-text",
                                status === "success" && "text-success font-medium",
                                status === "warning" && "text-warning font-medium",
                                status === "destructive" && "text-destructive font-medium"
                              )}
                              onClick={(e) => {
                                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                input?.focus();
                                input?.select();
                              }}
                            >
                              {formatTarget(entry.actual_value, kpi.metric_type, kpi.name)}
                            </div>
                          ) : (
                            // Empty state - just show symbols
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                              onClick={(e) => {
                                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                input?.focus();
                              }}
                            >
                              {kpi.metric_type === "dollar" ? "$" : kpi.metric_type === "percentage" ? "%" : "-"}
                            </div>
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
                            onFocus={(e) => {
                              const parent = e.target.parentElement;
                              if (parent) {
                                const display = parent.querySelector('div') as HTMLElement;
                                if (display) display.style.display = 'none';
                              }
                            }}
                            onBlur={(e) => {
                              const parent = e.target.parentElement;
                              if (parent) {
                                const display = parent.querySelector('div') as HTMLElement;
                                if (display) display.style.display = '';
                              }
                            }}
                            data-kpi-index={index}
                            data-period-index={weeks.findIndex(w => w.start.toISOString().split('T')[0] === weekDate)}
                            className={cn(
                              "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                              status === "success" && "text-success font-medium",
                              status === "warning" && "text-warning font-medium",
                              status === "destructive" && "text-destructive font-medium",
                              isCalculatedKPI(kpi.name) && "hidden"
                            )}
                            placeholder="-"
                            disabled={saving[key] || isCalculatedKPI(kpi.name)}
                            readOnly={isCalculatedKPI(kpi.name)}
                          />
                          {saving[key] && (
                            <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                          )}
                        </div>
                      </TableCell>
                    );
                  }) : months.map((month) => {
                    const key = `${kpi.id}-month-${month.identifier}`;
                    const entry = entries[key];
                    const status = getStatus(entry?.status || null);
                    const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type, kpi.name);
                    
                    return (
                      <TableCell
                        key={month.identifier}
                        className={cn(
                          "p-1 relative min-w-[120px] max-w-[120px]",
                          status === "success" && "bg-success/10",
                          status === "warning" && "bg-warning/10",
                          status === "destructive" && "bg-destructive/10"
                        )}
                      >
                        <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                          {entry?.actual_value !== null && entry?.actual_value !== undefined ? (
                            // Display formatted value when data exists
                            <div 
                              className={cn(
                                "h-full w-full flex items-center justify-center cursor-text",
                                status === "success" && "text-success font-medium",
                                status === "warning" && "text-warning font-medium",
                                status === "destructive" && "text-destructive font-medium"
                              )}
                              onClick={(e) => {
                                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                input?.focus();
                                input?.select();
                              }}
                            >
                              {formatTarget(entry.actual_value, kpi.metric_type, kpi.name)}
                            </div>
                          ) : (
                            // Empty state - just show symbols
                            <div className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                              onClick={(e) => {
                                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                input?.focus();
                              }}
                            >
                              {kpi.metric_type === "dollar" ? "$" : kpi.metric_type === "percentage" ? "%" : "-"}
                            </div>
                          )}
                          <Input
                            type="number"
                            step="any"
                            value={displayValue}
                            onChange={(e) =>
                              handleValueChange(kpi.id, '', e.target.value, kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type, kpi.target_direction, true, month.identifier)
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const currentKpiIndex = kpis.findIndex(k => k.id === kpi.id);
                                const currentPeriodIndex = months.findIndex(m => m.identifier === month.identifier);
                                
                                if (currentKpiIndex < kpis.length - 1) {
                                  const nextInput = document.querySelector(
                                    `input[data-kpi-index="${currentKpiIndex + 1}"][data-period-index="${currentPeriodIndex}"]`
                                  ) as HTMLInputElement;
                                  nextInput?.focus();
                                  nextInput?.select();
                                }
                              }
                            }}
                            onFocus={(e) => {
                              const parent = e.target.parentElement;
                              if (parent) {
                                const display = parent.querySelector('div') as HTMLElement;
                                if (display) display.style.display = 'none';
                              }
                            }}
                            onBlur={(e) => {
                              const parent = e.target.parentElement;
                              if (parent) {
                                const display = parent.querySelector('div') as HTMLElement;
                                if (display) display.style.display = '';
                              }
                            }}
                            data-kpi-index={index}
                            data-period-index={months.findIndex(m => m.identifier === month.identifier)}
                            className={cn(
                              "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                              status === "success" && "text-success font-medium",
                              status === "warning" && "text-warning font-medium",
                              status === "destructive" && "text-destructive font-medium",
                              isCalculatedKPI(kpi.name) && "hidden"
                            )}
                            placeholder="-"
                            disabled={saving[key] || isCalculatedKPI(kpi.name)}
                            readOnly={isCalculatedKPI(kpi.name)}
                          />
                          {saving[key] && (
                            <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                          )}
                        </div>
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
      )}
    </div>
  );
};


export default ScorecardGrid;
