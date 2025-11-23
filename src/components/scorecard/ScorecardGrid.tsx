import { useState, useEffect, useRef } from "react";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Calendar, CalendarDays, Copy, Plus, UserPlus, GripVertical, RefreshCw, ClipboardPaste } from "lucide-react";
import { SetKPITargetsDialog } from "./SetKPITargetsDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PRESET_KPIS = [
  { name: "Total Hours", metricType: "unit" as const, targetDirection: "above" as const },
  { name: "CP Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const },
  { name: "Warranty Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const },
  { name: "Internal Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const },
  { name: "Total Service Gross", metricType: "dollar" as const, targetDirection: "above" as const },
  { name: "Total Service Gross %", metricType: "percentage" as const, targetDirection: "above" as const },
  { name: "CP Hours", metricType: "unit" as const, targetDirection: "above" as const },
  { name: "CP RO's", metricType: "unit" as const, targetDirection: "above" as const },
  { name: "CP Labour Sales Per RO", metricType: "dollar" as const, targetDirection: "above" as const },
  { name: "CP Hours Per RO", metricType: "unit" as const, targetDirection: "above" as const },
  { name: "CP ELR", metricType: "dollar" as const, targetDirection: "above" as const },
];

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
  role?: string;
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

const getMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const months = [];
  
  // For Q1, show all 12 months to allow full year data entry
  if (quarter === 1) {
    for (let i = 0; i < 12; i++) {
      months.push({
        label: monthNames[i],
        identifier: `${year}-${String(i + 1).padStart(2, '0')}`,
        year: year,
        month: i + 1,
        type: 'month' as const,
      });
    }
  } else {
    // For Q2, Q3, Q4, show only the quarter's 3 months
    for (let i = 0; i < 3; i++) {
      const monthIndex = (quarter - 1) * 3 + i;
      months.push({
        label: monthNames[monthIndex],
        identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        year: year,
        month: monthIndex + 1,
        type: 'month' as const,
      });
    }
  }
  
  return months;
};

const getPrecedingQuarters = (currentQuarter: number, currentYear: number, count: number = 4) => {
  const quarters = [];
  let q = currentQuarter;
  let y = currentYear;
  
  for (let i = 0; i < count; i++) {
    q--;
    if (q < 1) {
      q = 4;
      y--;
    }
    quarters.push({ quarter: q, year: y, label: `Q${q} ${y}` });
  }
  
  return quarters.reverse();
};

const ScorecardGrid = ({ departmentId, kpis, onKPIsChange, year, quarter, onYearChange, onQuarterChange }: ScorecardGridProps) => {
  const [entries, setEntries] = useState<{ [key: string]: ScorecardEntry }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const [kpiTargets, setKpiTargets] = useState<{ [key: string]: number }>({});
  const [precedingQuartersData, setPrecedingQuartersData] = useState<{ [key: string]: number }>({});
  const [yearlyAverages, setYearlyAverages] = useState<{ [key: string]: { prevYear: number | null; currentYear: number | null } }>({});
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetEditValue, setTargetEditValue] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showAddKPI, setShowAddKPI] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [newKPIName, setNewKPIName] = useState("");
  const [newKPIType, setNewKPIType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [newKPIDirection, setNewKPIDirection] = useState<"above" | "below">("above");
  const [storeUsers, setStoreUsers] = useState<Profile[]>([]);
  const [draggedOwnerId, setDraggedOwnerId] = useState<string | null>(null);
  const [dragOverOwnerId, setDragOverOwnerId] = useState<string | null>(null);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteKpi, setPasteKpi] = useState<string>("");
  const [pasteData, setPasteData] = useState<string>("");
  const [parsedPasteData, setParsedPasteData] = useState<{ period: string; value: number }[]>([]);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const currentQuarterInfo = getQuarterInfo(new Date());
  const weeks = getWeekDates({ year, quarter });
  const months = getMonthsForQuarter(quarter, year);
  const precedingQuarters = getPrecedingQuarters(quarter, year, 4);
  const allPeriods = viewMode === "weekly" ? weeks : months;

  const getRoleColor = (role?: string) => {
    if (!role) return 'hsl(var(--muted))';
    switch (role) {
      case 'department_manager':
        return 'hsl(142 76% 36%)'; // Green
      case 'service_advisor':
        return 'hsl(221 83% 53%)'; // Blue
      case 'technician':
        return 'hsl(25 95% 53%)'; // Orange
      default:
        return 'hsl(var(--muted))';
    }
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  
  // Get current week's Monday to highlight it
  const today = new Date();
  const currentWeekMonday = getMondayOfWeek(today);
  const currentWeekDate = currentWeekMonday.toISOString().split('T')[0];
  
  // Get previous week's Monday (week before current)
  const previousWeekMonday = new Date(currentWeekMonday);
  previousWeekMonday.setDate(previousWeekMonday.getDate() - 7);
  const previousWeekDate = previousWeekMonday.toISOString().split('T')[0];

  useEffect(() => {
    loadUserRole();
    loadScorecardData();
    fetchProfiles();
    loadKPITargets();
    loadStoreUsers();
  }, [departmentId, kpis, year, quarter, viewMode]);

  useEffect(() => {
    if (viewMode === "monthly" && kpis.length > 0) {
      loadPrecedingQuartersData();
      calculateYearlyAverages();
    }
  }, [departmentId, kpis, year, quarter, viewMode, entries]);

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

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setUserRole(data.role);
    }
  };

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    // Fetch user roles for each profile
    const profilesWithRoles = await Promise.all(
      (data || []).map(async (profile) => {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .single();
        
        return {
          ...profile,
          role: roleData?.role || profile.role // Fall back to profile role if user_roles is empty
        };
      })
    );

    const profilesMap: { [key: string]: Profile } = {};
    profilesWithRoles.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
    setProfiles(profilesMap);
  };

  const loadStoreUsers = async () => {
    // Get the store_id from the department
    const { data: departmentData, error: deptError } = await supabase
      .from("departments")
      .select("store_id")
      .eq("id", departmentId)
      .maybeSingle();

    if (deptError || !departmentData) {
      console.error("Error fetching department:", deptError);
      return;
    }

    // Get profiles for that store
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("store_id", departmentData.store_id)
      .order("full_name");

    if (error) {
      console.error("Error fetching store users:", error);
      return;
    }

    setStoreUsers(data || []);
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
        
        // Recalculate status based on current target
        const kpi = kpis.find(k => k.id === entry.kpi_id);
        if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
          const target = kpiTargets[kpi.id] || kpi.target_value;
          
          const variance = kpi.metric_type === "percentage" 
            ? entry.actual_value - target 
            : target !== 0 ? ((entry.actual_value - target) / target) * 100 : 0;

          let status: string;
          if (kpi.target_direction === "above") {
            status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
          } else {
            status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
          }
          
          entry.status = status;
          entry.variance = variance;
        }
        
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
        
        // Recalculate status based on current target
        const kpi = kpis.find(k => k.id === entry.kpi_id);
        if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
          const target = kpiTargets[kpi.id] || kpi.target_value;
          
          const variance = kpi.metric_type === "percentage" 
            ? entry.actual_value - target 
            : target !== 0 ? ((entry.actual_value - target) / target) * 100 : 0;

          let status: string;
          if (kpi.target_direction === "above") {
            status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
          } else {
            status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
          }
          
          entry.status = status;
          entry.variance = variance;
        }
        
        newEntries[key] = entry;
      });
      setEntries(newEntries);
    }

    setLoading(false);
  };

  const loadPrecedingQuartersData = async () => {
    if (!departmentId || kpis.length === 0) return;

    const quarterAverages: { [key: string]: number } = {};
    
    // Load data for each preceding quarter
    for (const pq of precedingQuarters) {
      // Always get exactly 3 months for each quarter (for calculation purposes)
      const startMonth = (pq.quarter - 1) * 3 + 1;
      const quarterMonths = [
        `${pq.year}-${String(startMonth).padStart(2, '0')}`,
        `${pq.year}-${String(startMonth + 1).padStart(2, '0')}`,
        `${pq.year}-${String(startMonth + 2).padStart(2, '0')}`
      ];
      
      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpis.map(k => k.id))
        .eq("entry_type", "monthly")
        .in("month", quarterMonths);

      if (error) {
        console.error("Error loading preceding quarter data:", error);
        continue;
      }

      // Calculate average for each KPI in this quarter
      kpis.forEach(kpi => {
        const kpiEntries = data?.filter(e => e.kpi_id === kpi.id) || [];
        const values = kpiEntries
          .map(e => e.actual_value)
          .filter((v): v is number => v !== null && v !== undefined);
        
        if (values.length > 0) {
          const average = values.reduce((sum, v) => sum + v, 0) / values.length;
          const key = `${kpi.id}-Q${pq.quarter}-${pq.year}`;
          quarterAverages[key] = average;
        }
      });
    }

    setPrecedingQuartersData(quarterAverages);
  };

  const calculateYearlyAverages = async () => {
    if (!departmentId || kpis.length === 0) return;

    const averages: { [key: string]: { prevYear: number | null; currentYear: number | null } } = {};

    // Fetch previous year data (all 12 months)
    const prevYearMonths = Array.from({ length: 12 }, (_, i) => 
      `${year - 1}-${String(i + 1).padStart(2, '0')}`
    );

    const { data: prevYearData, error: prevYearError } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpis.map(k => k.id))
      .eq("entry_type", "monthly")
      .in("month", prevYearMonths);

    if (prevYearError) {
      console.error("Error loading previous year data:", prevYearError);
    }

    // Fetch current year data (all 12 months)
    const currentYearMonths = Array.from({ length: 12 }, (_, i) => 
      `${year}-${String(i + 1).padStart(2, '0')}`
    );

    const { data: currentYearData, error: currentYearError } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpis.map(k => k.id))
      .eq("entry_type", "monthly")
      .in("month", currentYearMonths);

    if (currentYearError) {
      console.error("Error loading current year data:", currentYearError);
    }

    // Calculate averages for each KPI
    kpis.forEach(kpi => {
      // Calculate previous year average
      const prevYearEntries = prevYearData?.filter(e => e.kpi_id === kpi.id) || [];
      const prevYearValues = prevYearEntries
        .map(e => e.actual_value)
        .filter((v): v is number => v !== null && v !== undefined);
      
      const prevYearAvg = prevYearValues.length > 0
        ? prevYearValues.reduce((sum, v) => sum + v, 0) / prevYearValues.length
        : null;

      // Calculate current year average
      const currentYearEntries = currentYearData?.filter(e => e.kpi_id === kpi.id) || [];
      const currentYearValues = currentYearEntries
        .map(e => e.actual_value)
        .filter((v): v is number => v !== null && v !== undefined);
      
      const currentYearAvg = currentYearValues.length > 0
        ? currentYearValues.reduce((sum, v) => sum + v, 0) / currentYearValues.length
        : null;

      averages[kpi.id] = {
        prevYear: prevYearAvg,
        currentYear: currentYearAvg
      };
    });

    setYearlyAverages(averages);
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
        
        // Round CP Hours Per RO to 2 decimal places
        if (kpi.name === "CP Hours Per RO") {
          calculatedValue = Math.round(calculatedValue * 100) / 100;
        }
        
        // Round CP Labour Sales Per RO and CP ELR to nearest dollar
        if (kpi.name === "CP Labour Sales Per RO" || kpi.name === "CP ELR") {
          calculatedValue = Math.round(calculatedValue);
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
          
          // Don't clear localValues for calculated values - let display logic handle it
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

    // Set new timeout to save after user stops typing (1.5 second delay)
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
        // Update entries state first
        let latestEntries: Record<string, ScorecardEntry> = {};
        setEntries(prev => {
          latestEntries = {
            ...prev,
            [key]: data as ScorecardEntry
          };
          return latestEntries;
        });
        
        // Don't clear localValues - let it stay until user focuses away or value changes
        // The display logic will prefer localValues but fall back to entries

        // Auto-calculate dependent KPIs with the updated entries
        await calculateDependentKPIs(kpiId, periodKey, isMonthly, monthId, latestEntries);
      }

      setSaving(prev => ({ ...prev, [key]: false }));
      delete saveTimeoutRef.current[key];
    }, 1500); // Debounce delay - 1.5 seconds
  };

  const getStatus = (status: string | null) => {
    if (!status) return "default";
    if (status === "green") return "success";
    if (status === "yellow") return "warning";
    return "destructive";
  };

  const formatValue = (value: number | null, type: string, kpiName?: string) => {
    if (value === null || value === undefined) return "";
    // CP Hours Per RO should always show 2 decimal places
    if (kpiName === "CP Hours Per RO") {
      return Number(value).toFixed(2);
    }
    // Total Hours, CP Labour Sales Per RO and CP ELR should show whole numbers
    if (kpiName === "Total Hours" || kpiName === "CP Labour Sales Per RO" || kpiName === "CP ELR") {
      return Math.round(value).toString();
    }
    // Don't format with commas for input fields - number inputs don't accept them
    return value.toString();
  };

  const formatTarget = (value: number, type: string, kpiName?: string) => {
    // CP Hours Per RO should always show 2 decimal places
    if (kpiName === "CP Hours Per RO") {
      return Number(value).toFixed(2);
    }
    // CP Labour Sales Per RO and CP ELR should show whole dollars
    if (kpiName === "CP Labour Sales Per RO" || kpiName === "CP ELR") {
      return `$${Math.round(value).toLocaleString()}`;
    }
    // Total Hours should show whole numbers
    if (kpiName === "Total Hours") {
      return Math.round(value).toLocaleString();
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

  const canEditTargets = () => {
    return userRole === 'super_admin' || userRole === 'store_gm' || userRole === 'department_manager';
  };

  const handleTargetEdit = (kpiId: string) => {
    if (!canEditTargets()) return;
    const currentTarget = kpiTargets[kpiId] || kpis.find(k => k.id === kpiId)?.target_value || 0;
    setEditingTarget(kpiId);
    setTargetEditValue(currentTarget.toString());
  };

  const handleTargetSave = async (kpiId: string) => {
    const trimmedValue = targetEditValue.trim();
    
    // Allow empty values - this clears/removes the target
    if (trimmedValue === "") {
      setEditingTarget(null);
      setTargetEditValue("");
      return;
    }
    
    const newValue = parseFloat(trimmedValue);
    if (isNaN(newValue)) {
      toast({
        title: "Invalid Value",
        description: "Please enter a valid number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("kpi_targets")
      .upsert({
        kpi_id: kpiId,
        quarter: quarter,
        year: year,
        target_value: newValue,
      }, {
        onConflict: "kpi_id,quarter,year",
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update target",
        variant: "destructive",
      });
      return;
    }

    setEditingTarget(null);
    // Reload targets and scorecard data to recalculate statuses immediately
    await loadKPITargets();
    await loadScorecardData();
    toast({
      title: "Success",
      description: "Target updated successfully",
    });
  };

  const handleCopyToQuarters = async (kpiId: string) => {
    const currentTarget = kpiTargets[kpiId] || kpis.find(k => k.id === kpiId)?.target_value;
    if (currentTarget === undefined || currentTarget === null) return;

    const updates = [1, 2, 3, 4]
      .filter(q => q !== quarter)
      .map(q => ({
        kpi_id: kpiId,
        quarter: q,
        year: year,
        target_value: currentTarget,
      }));

    const { error } = await supabase
      .from("kpi_targets")
      .upsert(updates, {
        onConflict: "kpi_id,quarter,year",
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to copy targets",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: `Target copied to all quarters in ${year}`,
    });
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

  const handlePresetSelect = (presetName: string) => {
    if (presetName === "custom") {
      setSelectedPreset("custom");
      setNewKPIName("");
      setNewKPIType("dollar");
      setNewKPIDirection("above");
    } else {
      const preset = PRESET_KPIS.find(p => p.name === presetName);
      if (preset) {
        setSelectedPreset(presetName);
        setNewKPIName(preset.name);
        setNewKPIType(preset.metricType);
        setNewKPIDirection(preset.targetDirection);
      }
    }
  };

  const handleBulkRecalculateAll = async () => {
    try {
      setSaving(prev => ({ ...prev, 'bulk-recalc': true }));
      
      let hoursPerROUpdates = 0;
      let elrUpdates = 0;

      // 1. Recalculate CP Hours Per RO
      const cpHoursPerROKpi = kpis.find(k => k.name === "CP Hours Per RO");
      const cpHoursKpi = kpis.find(k => k.name === "CP Hours");
      const cpROsKpi = kpis.find(k => k.name === "CP RO's");

      if (cpHoursPerROKpi && cpHoursKpi && cpROsKpi) {
        const { data: allEntries } = await supabase
          .from('scorecard_entries')
          .select('*')
          .in('kpi_id', [cpHoursKpi.id, cpROsKpi.id, cpHoursPerROKpi.id]);

        const updates: any[] = [];
        const entriesByKey: { [key: string]: any } = {};

        allEntries?.forEach(entry => {
          const key = entry.entry_type === 'weekly' 
            ? entry.week_start_date 
            : entry.month;
          if (!entriesByKey[key]) entriesByKey[key] = {};
          
          if (entry.kpi_id === cpHoursKpi.id) {
            entriesByKey[key].cpHours = entry.actual_value;
          } else if (entry.kpi_id === cpROsKpi.id) {
            entriesByKey[key].cpROs = entry.actual_value;
          } else if (entry.kpi_id === cpHoursPerROKpi.id) {
            entriesByKey[key].cpHoursPerROEntry = entry;
          }
        });

        Object.values(entriesByKey).forEach((data: any) => {
          if (data.cpHours && data.cpROs && data.cpROs !== 0 && data.cpHoursPerROEntry) {
            const newValue = Math.round((data.cpHours / data.cpROs) * 100) / 100;
            const target = kpiTargets[cpHoursPerROKpi.id] || cpHoursPerROKpi.target_value;
            const variance = target !== 0 ? ((newValue - target) / target) * 100 : 0;
            
            let status: string;
            if (cpHoursPerROKpi.target_direction === "above") {
              status = newValue >= target ? "green" : newValue >= target * 0.9 ? "yellow" : "red";
            } else {
              status = newValue <= target ? "green" : newValue <= target * 1.1 ? "yellow" : "red";
            }

            updates.push({
              id: data.cpHoursPerROEntry.id,
              actual_value: newValue,
              variance,
              status,
            });
          }
        });

        for (const update of updates) {
          await supabase
            .from('scorecard_entries')
            .update({
              actual_value: update.actual_value,
              variance: update.variance,
              status: update.status,
            })
            .eq('id', update.id);
        }

        hoursPerROUpdates = updates.length;
      }

      // 2. Recalculate CP ELR
      const cpELRKpis = kpis.filter(k => k.name === "CP ELR");
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      for (const elrKpi of cpELRKpis) {
        const ownerId = elrKpi.assigned_to;
        
        const cpLabourSalesKpi = kpis.find(k => k.name === "CP Labour Sales" && k.assigned_to === ownerId);
        const cpHoursKpi = kpis.find(k => k.name === "CP Hours" && k.assigned_to === ownerId);
        
        if (!cpLabourSalesKpi || !cpHoursKpi) continue;

        const { data: labourSalesEntries } = await supabase
          .from('scorecard_entries')
          .select('*')
          .eq('kpi_id', cpLabourSalesKpi.id);

        const { data: hoursEntries } = await supabase
          .from('scorecard_entries')
          .select('*')
          .eq('kpi_id', cpHoursKpi.id);

        if (!labourSalesEntries || !hoursEntries) continue;

        const labourSalesByPeriod: { [key: string]: number } = {};
        const hoursByPeriod: { [key: string]: number } = {};

        labourSalesEntries.forEach(e => {
          const key = e.entry_type === 'monthly' ? e.month : e.week_start_date;
          labourSalesByPeriod[key] = e.actual_value;
        });

        hoursEntries.forEach(e => {
          const key = e.entry_type === 'monthly' ? e.month : e.week_start_date;
          hoursByPeriod[key] = e.actual_value;
        });

        for (const [period, labourSales] of Object.entries(labourSalesByPeriod)) {
          const hours = hoursByPeriod[period];
          
          if (hours && hours !== 0) {
            const calculatedValue = Math.round(labourSales / hours);
            const target = kpiTargets[elrKpi.id] || elrKpi.target_value;
            const variance = target !== 0 ? ((calculatedValue - target) / target) * 100 : 0;
            
            let status: string;
            if (elrKpi.target_direction === "above") {
              status = calculatedValue >= target ? "green" : calculatedValue >= target * 0.9 ? "yellow" : "red";
            } else {
              status = calculatedValue <= target ? "green" : calculatedValue <= target * 1.1 ? "yellow" : "red";
            }

            const isMonthly = period.includes('-') && period.split('-').length === 2;
            const entryData: any = {
              kpi_id: elrKpi.id,
              actual_value: calculatedValue,
              variance,
              status,
              created_by: userId,
              entry_type: isMonthly ? 'monthly' : 'weekly',
            };

            if (isMonthly) {
              entryData.month = period;
            } else {
              entryData.week_start_date = period;
            }

            const { error } = await supabase
              .from('scorecard_entries')
              .upsert(entryData, {
                onConflict: isMonthly ? 'kpi_id,month' : 'kpi_id,week_start_date'
              });

            if (!error) {
              elrUpdates++;
            }
          }
        }
      }

      setSaving(prev => ({ ...prev, 'bulk-recalc': false }));
      
      toast({
        title: "Recalculation complete",
        description: `Updated ${hoursPerROUpdates} CP Hours Per RO and ${elrUpdates} CP ELR entries`,
      });

      loadScorecardData();
    } catch (error) {
      console.error('Error during bulk recalculation:', error);
      setSaving(prev => ({ ...prev, 'bulk-recalc': false }));
      toast({
        title: "Recalculation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddKPI = async () => {
    if (!newKPIName.trim() || !selectedUserId) {
      toast({
        title: "Missing Information",
        description: "Please select a user and enter a KPI name.",
        variant: "destructive",
      });
      return;
    }

    const maxOrder = Math.max(...kpis.map(k => k.display_order), 0);

    const { error } = await supabase
      .from("kpi_definitions")
      .insert({
        department_id: departmentId,
        name: newKPIName.trim(),
        metric_type: newKPIType,
        target_direction: newKPIDirection,
        target_value: 0,
        display_order: maxOrder + 1,
        assigned_to: selectedUserId,
      });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success",
      description: "KPI added successfully",
    });

    setSelectedPreset("");
    setNewKPIName("");
    setNewKPIType("dollar");
    setNewKPIDirection("above");
    setShowAddKPI(false);
    onKPIsChange();
  };

  const handlePasteDataChange = (value: string) => {
    setPasteData(value);
    
    if (!value.trim() || !pasteKpi) {
      setParsedPasteData([]);
      return;
    }

    const values = value.trim().split(/[\t\s]+/).map(v => v.replace(/[,$]/g, ''));
    const parsed: { period: string; value: number }[] = [];
    const periods = viewMode === "weekly" ? weeks : months;

    values.forEach((val, idx) => {
      if (idx < periods.length) {
        const numValue = parseFloat(val);
        if (!isNaN(numValue)) {
          const periodIdentifier = viewMode === "weekly" 
            ? periods[idx].start.toISOString().split('T')[0]
            : (periods[idx] as any).identifier;
          parsed.push({
            period: periodIdentifier,
            value: numValue
          });
        }
      }
    });

    setParsedPasteData(parsed);
  };

  const handlePasteSave = async () => {
    if (!pasteKpi || parsedPasteData.length === 0) {
      toast({
        title: "No data to save",
        description: "Please select a KPI and paste valid data",
        variant: "destructive"
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      for (const entry of parsedPasteData) {
        const kpi = kpis.find(k => k.id === pasteKpi);
        if (!kpi) continue;

        const target = kpiTargets[pasteKpi] || kpi.target_value;
        const variance = kpi.metric_type === "percentage" 
          ? entry.value - target 
          : ((entry.value - target) / target) * 100;

        let status: string;
        if (kpi.target_direction === "above") {
          status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
        } else {
          status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
        }

        const { error } = await supabase
          .from("scorecard_entries")
          .upsert({
            kpi_id: pasteKpi,
            [viewMode === "weekly" ? "week_start_date" : "month"]: entry.period,
            entry_type: viewMode,
            actual_value: entry.value,
            variance: variance,
            status: status,
            created_by: user.id
          }, {
            onConflict: viewMode === "weekly" ? 'kpi_id,week_start_date' : 'kpi_id,month'
          });

        if (error) throw error;
      }

      toast({
        title: "Data saved",
        description: `Successfully saved ${parsedPasteData.length} entries`
      });

      await loadScorecardData();
      setPasteDialogOpen(false);
      setPasteData("");
      setPasteKpi("");
      setParsedPasteData([]);
    } catch (error: any) {
      console.error('Error saving pasted data:', error);
      toast({
        title: "Error saving data",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleOwnerDragStart = (ownerId: string | null) => {
    setDraggedOwnerId(ownerId);
  };

  const handleOwnerDragOver = (e: React.DragEvent, ownerId: string | null) => {
    e.preventDefault();
    setDragOverOwnerId(ownerId);
  };

  const handleOwnerDragEnd = () => {
    setDraggedOwnerId(null);
    setDragOverOwnerId(null);
  };

  const handleOwnerDrop = async (e: React.DragEvent, targetOwnerId: string | null) => {
    e.preventDefault();
    
    if (!draggedOwnerId || draggedOwnerId === targetOwnerId) {
      setDraggedOwnerId(null);
      setDragOverOwnerId(null);
      return;
    }

    // Group KPIs by owner in current order
    const ownerGroups: { [key: string]: KPI[] } = {};
    const ownerOrder: string[] = [];
    
    kpis.forEach(kpi => {
      const ownerId = kpi.assigned_to || 'unassigned';
      if (!ownerGroups[ownerId]) {
        ownerGroups[ownerId] = [];
        ownerOrder.push(ownerId);
      }
      ownerGroups[ownerId].push(kpi);
    });

    // Find indices
    const draggedIndex = ownerOrder.indexOf(draggedOwnerId);
    const targetIndex = ownerOrder.indexOf(targetOwnerId || 'unassigned');

    // Reorder owner groups
    const newOwnerOrder = [...ownerOrder];
    const [removed] = newOwnerOrder.splice(draggedIndex, 1);
    newOwnerOrder.splice(targetIndex, 0, removed);

    // Flatten back to KPI array with new display_order
    let newDisplayOrder = 0;
    const updates: { id: string; display_order: number }[] = [];

    newOwnerOrder.forEach(ownerId => {
      ownerGroups[ownerId].forEach(kpi => {
        updates.push({ id: kpi.id, display_order: newDisplayOrder });
        newDisplayOrder++;
      });
    });

    // Update database
    for (const update of updates) {
      const { error } = await supabase
        .from("kpi_definitions")
        .update({ display_order: update.display_order })
        .eq("id", update.id);

      if (error) {
        console.error("Error updating KPI order:", error);
        toast({
          title: "Error",
          description: "Failed to update KPI order",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Success",
      description: "Owner order updated",
    });

    setDraggedOwnerId(null);
    setDragOverOwnerId(null);
    onKPIsChange();
  };

  const canManageKPIs = userRole === "super_admin" || userRole === "store_gm" || userRole === "department_manager";

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
        <div className="flex items-center gap-4">
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

          {/* View Mode Toggle - Prominent */}
          <div className="flex items-center border rounded-lg p-1 bg-muted/30">
            <Button
              variant={viewMode === "weekly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("weekly")}
              className="gap-2"
            >
              <CalendarDays className="h-4 w-4" />
              Weekly
            </Button>
            <Button
              variant={viewMode === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("monthly")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Monthly
            </Button>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {canManageKPIs && (
            <>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select user to add KPI" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {storeUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedUserId && (
                <Popover open={showAddKPI} onOpenChange={setShowAddKPI}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Add KPI
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 bg-background z-50" align="end">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">Add New KPI</h4>
                        <p className="text-sm text-muted-foreground">
                          for {storeUsers.find(u => u.id === selectedUserId)?.full_name}
                        </p>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="kpi-preset">Select KPI</Label>
                          <Select value={selectedPreset} onValueChange={handlePresetSelect}>
                            <SelectTrigger id="kpi-preset">
                              <SelectValue placeholder="Choose preset or custom" />
                            </SelectTrigger>
                            <SelectContent className="bg-background z-50">
                              <SelectItem value="custom">Custom KPI</SelectItem>
                              {PRESET_KPIS.map((preset) => (
                                <SelectItem key={preset.name} value={preset.name}>
                                  {preset.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedPreset && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="kpi-name">KPI Name</Label>
                              <Input
                                id="kpi-name"
                                placeholder="Enter KPI name"
                                value={newKPIName}
                                onChange={(e) => setNewKPIName(e.target.value)}
                                disabled={selectedPreset !== "custom"}
                              />
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="kpi-type">Metric Type</Label>
                              <Select 
                                value={newKPIType} 
                                onValueChange={(v: "dollar" | "percentage" | "unit") => setNewKPIType(v)}
                                disabled={selectedPreset !== "custom"}
                              >
                                <SelectTrigger id="kpi-type">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="dollar">Dollar ($)</SelectItem>
                                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                                  <SelectItem value="unit">Unit (#)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2">
                              <Label htmlFor="kpi-direction">Target Direction</Label>
                              <Select 
                                value={newKPIDirection} 
                                onValueChange={(v: "above" | "below") => setNewKPIDirection(v)}
                                disabled={selectedPreset !== "custom"}
                              >
                                <SelectTrigger id="kpi-direction">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-background z-50">
                                  <SelectItem value="above">Above Target</SelectItem>
                                  <SelectItem value="below">Below Target</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => setShowAddKPI(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddKPI}>
                          Add KPI
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </>
          )}
          
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
              {canManageKPIs && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPasteDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Paste Row
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkRecalculateAll}
                    disabled={saving['bulk-recalc']}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", saving['bulk-recalc'] && "animate-spin")} />
                    {saving['bulk-recalc'] ? "Recalculating..." : "Recalculate All"}
                  </Button>
                </>
              )}
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
            }) : (
              <>
                {precedingQuarters.map((pq) => (
                  <TableHead key={`${pq.quarter}-${pq.year}`} className="text-center font-bold min-w-[100px] py-[7.2px] bg-muted/50 sticky top-0 z-10">
                    {pq.label}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold min-w-[100px] py-[7.2px] bg-accent/30 border-x-2 border-accent sticky top-0 z-10">
                  AVG {year - 1}
                </TableHead>
                <TableHead className="text-center font-bold min-w-[100px] py-[7.2px] bg-accent/30 border-x-2 border-accent sticky top-0 z-10">
                  AVG {year}
                </TableHead>
                <TableHead className="text-center font-bold min-w-[100px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                  Q{quarter} Target
                </TableHead>
                {months.map((month) => (
                  <TableHead 
                    key={month.identifier} 
                    className="text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10"
                  >
                    {month.label}
                  </TableHead>
                ))}
              </>
            )}
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
                  <TableRow 
                    key={`owner-${kpi.assigned_to || 'unassigned'}`} 
                    className={cn(
                      "bg-muted/50 transition-colors",
                      dragOverOwnerId === (kpi.assigned_to || 'unassigned') && "bg-primary/20",
                      canManageKPIs && "cursor-grab active:cursor-grabbing"
                    )}
                    draggable={canManageKPIs}
                    onDragStart={() => handleOwnerDragStart(kpi.assigned_to || 'unassigned')}
                    onDragOver={(e) => handleOwnerDragOver(e, kpi.assigned_to || 'unassigned')}
                    onDragEnd={handleOwnerDragEnd}
                    onDrop={(e) => handleOwnerDrop(e, kpi.assigned_to || 'unassigned')}
                  >
                    <TableCell 
                      className="z-10 bg-muted py-1 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      style={{ position: 'sticky', left: 0 }}
                    >
                      <div className="flex items-center gap-2">
                        {canManageKPIs && (
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Avatar className="h-6 w-6">
                          <AvatarFallback 
                            style={{ backgroundColor: getRoleColor(owner?.role) }}
                            className="text-white text-xs font-semibold"
                          >
                            {getInitials(ownerName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-sm">{ownerName}</span>
                      </div>
                    </TableCell>
                    <TableCell 
                      className="z-10 bg-muted py-1 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                      style={{ position: 'sticky', left: '200px' }}
                    />
                    <TableCell colSpan={viewMode === "weekly" ? weeks.length : precedingQuarters.length + 3 + months.length} className="bg-muted/50 py-1" />
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
                    className="bg-background z-10 text-center py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: '200px' }}
                  >
                    {canEditTargets() && editingTarget === kpi.id ? (
                      <div className="flex items-center justify-center gap-1">
                        <Input
                          type="number"
                          step="any"
                          value={targetEditValue}
                          onChange={(e) => setTargetEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTargetSave(kpi.id);
                            if (e.key === 'Escape') setEditingTarget(null);
                          }}
                          className="w-20 h-7 text-center"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTargetSave(kpi.id)}
                          className="h-7 px-2"
                        >
                          ✓
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={cn(
                            "text-muted-foreground",
                            canEditTargets() && "cursor-pointer hover:text-foreground"
                          )}
                          onClick={() => canEditTargets() && handleTargetEdit(kpi.id)}
                        >
                          {formatTarget(kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type, kpi.name)}
                        </span>
                        {canEditTargets() && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 hover:bg-accent"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCopyToQuarters(kpi.id)}
                                className="text-xs"
                              >
                                Copy to Q1-Q4 {year}
                              </Button>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}
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
                          {(isCalculatedKPI(kpi.name) || focusedInput !== key) && (entry?.actual_value !== null && entry?.actual_value !== undefined) ? (
                            // Display formatted value when data exists (always for calculated, when not focused for others)
                            <div 
                              data-display-value
                              className={cn(
                                "h-full w-full flex items-center justify-center cursor-text",
                                status === "success" && "text-success font-medium",
                                status === "warning" && "text-warning font-medium",
                                status === "destructive" && "text-destructive font-medium",
                                isCalculatedKPI(kpi.name) && "cursor-default"
                              )}
                              onClick={(e) => {
                                if (!isCalculatedKPI(kpi.name)) {
                                  const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                  input?.focus();
                                  input?.select();
                                }
                              }}
                            >
                              {formatTarget(entry.actual_value, kpi.metric_type, kpi.name)}
                            </div>
                          ) : !isCalculatedKPI(kpi.name) && focusedInput !== key ? (
                            // Empty state - just show symbols when not focused
                            <div 
                              data-display-value
                              className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                              onClick={(e) => {
                                const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                input?.focus();
                              }}
                            >
                              {kpi.metric_type === "dollar" ? "$" : kpi.metric_type === "percentage" ? "%" : "-"}
                            </div>
                          ) : null}
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
                             onFocus={() => setFocusedInput(key)}
                             onBlur={() => {
                               // Clear local value on blur so display shows saved value
                               setTimeout(() => {
                                 setFocusedInput(null);
                                 setLocalValues(prev => {
                                   const newLocalValues = { ...prev };
                                   delete newLocalValues[key];
                                   return newLocalValues;
                                 });
                               }, 100);
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
                  }) : (
                    <>
                      {/* Preceding Quarters */}
                      {precedingQuarters.map((pq) => {
                        const qKey = `${kpi.id}-Q${pq.quarter}-${pq.year}`;
                        const qValue = precedingQuartersData[qKey];
                        
                        return (
                          <TableCell 
                            key={`${pq.quarter}-${pq.year}`} 
                            className="text-center py-[7.2px] min-w-[100px] text-muted-foreground"
                          >
                            {qValue !== null && qValue !== undefined ? formatTarget(qValue, kpi.metric_type, kpi.name) : "-"}
                          </TableCell>
                        );
                      })}
                      
                      {/* AVG Year-1 */}
                      <TableCell className="text-center py-[7.2px] min-w-[100px] bg-accent/10 border-x-2 border-accent font-medium">
                        {yearlyAverages[kpi.id]?.prevYear !== null && yearlyAverages[kpi.id]?.prevYear !== undefined
                          ? formatTarget(yearlyAverages[kpi.id].prevYear!, kpi.metric_type, kpi.name)
                          : "-"}
                      </TableCell>
                      
                      {/* AVG Year */}
                      <TableCell className="text-center py-[7.2px] min-w-[100px] bg-accent/10 border-x-2 border-accent font-medium">
                        {yearlyAverages[kpi.id]?.currentYear !== null && yearlyAverages[kpi.id]?.currentYear !== undefined
                          ? formatTarget(yearlyAverages[kpi.id].currentYear!, kpi.metric_type, kpi.name)
                          : "-"}
                      </TableCell>
                      
                      {/* Q{quarter} Target */}
                      <TableCell className="text-center py-[7.2px] min-w-[100px] bg-primary/10 border-x-2 border-primary/30 font-medium">
                        {formatTarget(kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type, kpi.name)}
                      </TableCell>
                      
                      {/* Months */}
                      {months.map((month) => {
                        const key = `${kpi.id}-month-${month.identifier}`;
                        const entry = entries[key];
                        const status = getStatus(entry?.status || null);
                        const displayValue = localValues[key] !== undefined ? localValues[key] : formatValue(entry?.actual_value || null, kpi.metric_type, kpi.name);
                        
                        return (
                          <TableCell
                            key={month.identifier}
                            className={cn(
                              "p-1 relative min-w-[125px] max-w-[125px]",
                              status === "success" && "bg-success/10",
                              status === "warning" && "bg-warning/10",
                              status === "destructive" && "bg-destructive/10"
                            )}
                          >
                            <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                              {(isCalculatedKPI(kpi.name) || focusedInput !== key) && (entry?.actual_value !== null && entry?.actual_value !== undefined) ? (
                                // Display formatted value when data exists (always for calculated, when not focused for others)
                                <div 
                                  data-display-value
                                  className={cn(
                                    "h-full w-full flex items-center justify-center cursor-text",
                                    status === "success" && "text-success font-medium",
                                    status === "warning" && "text-warning font-medium",
                                    status === "destructive" && "text-destructive font-medium",
                                    isCalculatedKPI(kpi.name) && "cursor-default"
                                  )}
                                  onClick={(e) => {
                                    if (!isCalculatedKPI(kpi.name)) {
                                      const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                      input?.focus();
                                      input?.select();
                                    }
                                  }}
                                >
                                  {formatTarget(entry.actual_value, kpi.metric_type, kpi.name)}
                                </div>
                              ) : !isCalculatedKPI(kpi.name) && focusedInput !== key ? (
                                // Empty state - just show symbols when not focused
                                <div 
                                  data-display-value
                                  className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                                  onClick={(e) => {
                                    const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                    input?.focus();
                                  }}
                                >
                                  {kpi.metric_type === "dollar" ? "$" : kpi.metric_type === "percentage" ? "%" : "-"}
                                </div>
                              ) : null}
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
                                 onFocus={() => setFocusedInput(key)}
                                 onBlur={() => {
                                   // Clear local value on blur so display shows saved value
                                   setTimeout(() => {
                                     setFocusedInput(null);
                                     setLocalValues(prev => {
                                       const newLocalValues = { ...prev };
                                       delete newLocalValues[key];
                                       return newLocalValues;
                                     });
                                   }, 100);
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
                    </>
                  )}
                </TableRow>
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
      )}

      {/* Paste Row Dialog */}
      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste Row Data</DialogTitle>
            <DialogDescription>
              Copy a row from Google Sheets and paste it here. The values should be tab-separated {viewMode === "weekly" ? "(weeks: " + weeks.map(w => w.label).join(', ') + ")" : "(months: " + months.map(m => m.label).join(', ') + ")"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="paste-kpi">Select KPI</Label>
              <Select value={pasteKpi} onValueChange={(value) => {
                setPasteKpi(value);
                handlePasteDataChange(pasteData);
              }}>
                <SelectTrigger id="paste-kpi">
                  <SelectValue placeholder="Choose a KPI..." />
                </SelectTrigger>
                <SelectContent>
                  {kpis.filter(k => !isCalculatedKPI(k.name)).map((kpi) => {
                    const owner = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
                    const ownerName = owner ? owner.full_name : "Unassigned";
                    return (
                      <SelectItem key={kpi.id} value={kpi.id}>
                        <div className="flex items-center justify-between w-full gap-3">
                          <span>{kpi.name}</span>
                          <span className="text-xs text-muted-foreground">({ownerName})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {pasteKpi && (() => {
                const selectedKpi = kpis.find(k => k.id === pasteKpi);
                if (selectedKpi) {
                  const owner = selectedKpi.assigned_to ? profiles[selectedKpi.assigned_to] : null;
                  const ownerName = owner ? owner.full_name : "Unassigned";
                  return (
                    <p className="text-sm text-muted-foreground">
                      Pasting values for <span className="font-medium text-foreground">{selectedKpi.name}</span> owned by <span className="font-medium text-foreground">{ownerName}</span>
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paste-values">Paste Values</Label>
              <Input
                id="paste-values"
                placeholder="Paste tab-separated values here (e.g., 150  160  155...)"
                value={pasteData}
                onChange={(e) => handlePasteDataChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tip: In Google Sheets, select the cells for all {viewMode === "weekly" ? "weeks" : "months"}, copy (Ctrl+C), and paste here
              </p>
            </div>

            {parsedPasteData.length > 0 && (
              <div className="space-y-2">
                <Label>Preview ({parsedPasteData.length} values)</Label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{viewMode === "weekly" ? "Week" : "Month"}</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPasteData.map((entry, idx) => {
                        const periodLabel = viewMode === "weekly" 
                          ? weeks.find(w => w.start.toISOString().split('T')[0] === entry.period)?.label
                          : months.find(m => (m as any).identifier === entry.period)?.label;
                        return (
                          <TableRow key={idx}>
                            <TableCell>{periodLabel}</TableCell>
                            <TableCell>{entry.value.toLocaleString()}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handlePasteSave}>
                Save {parsedPasteData.length} {parsedPasteData.length === 1 ? 'Entry' : 'Entries'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};


export default ScorecardGrid;
