import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Calendar,
  CalendarDays,
  Copy,
  Plus,
  GripVertical,
  RefreshCw,
  ClipboardPaste,
  AlertCircle,
  Flag,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SetKPITargetsDialog } from "./SetKPITargetsDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkline } from "@/components/ui/sparkline";
import { IssueManagementDialog } from "@/components/issues/IssueManagementDialog";
import { ScorecardPeriodDropZone } from "./ScorecardPeriodDropZone";
import { ScorecardMonthDropZone, ScorecardImportLog, ScorecardMonthDropZoneHandle } from "./ScorecardMonthDropZone";
import { ScorecardWeekDropZone, WeekImportLog } from "./ScorecardWeekDropZone";
import { ScorecardImportPreviewDialog } from "./ScorecardImportPreviewDialog";
import { parseCSRProductivityReport, CSRParseResult } from "@/utils/parsers/parseCSRProductivityReport";
import { StickyHScrollbar } from "./StickyHScrollbar";

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
  aggregation_type: "sum" | "average";
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
  onViewModeChange?: (mode: "weekly" | "monthly") => void;
}

// Custom year starts: 2025 starts on Dec 30, 2024 (Monday)
const YEAR_STARTS: { [key: number]: Date } = {
  2024: new Date(2024, 0, 1), // Jan 1, 2024 (Monday)
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
    weekStart.setDate(yearStart.getDate() + (quarterStartWeek + i) * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Format as "M/D-M/D" (e.g., "12/30-1/5")
    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endLabel = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;

    weeks.push({
      start: weekStart,
      label: `${startLabel}-${endLabel}`,
      type: "week" as const,
    });
  }

  return weeks;
};

const getMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const months = [];

  // Always show only the 3 months for the selected quarter
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
      year: year,
      month: monthIndex + 1,
      type: "month" as const,
    });
  }

  return months;
};

const getPreviousYearMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const months = [];
  const previousYear = year - 1;

  // Show the 3 months for the same quarter in the previous year
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${previousYear}-${String(monthIndex + 1).padStart(2, "0")}`,
      year: previousYear,
      month: monthIndex + 1,
      type: "month" as const,
    });
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

const getQuarterTrendPeriods = (currentQuarter: number, currentYear: number) => {
  const quarters = [];
  const startYear = currentYear - 1;

  // Start from Q1 of last year
  for (let y = startYear; y <= currentYear; y++) {
    const startQ = y === startYear ? 1 : 1;
    const endQ = y === currentYear ? currentQuarter : 4;

    for (let q = startQ; q <= endQ; q++) {
      quarters.push({
        quarter: q,
        year: y,
        label: `Q${q} ${y}`,
        type: "quarter" as const,
      });
    }
  }

  return quarters;
};

interface MonthlyTrendPeriod {
  month: number;
  year: number;
  label: string;
  identifier: string;
  type: "month" | "year-avg" | "year-total";
  summaryYear?: number;
  isYTD?: boolean;
}

const getMonthlyTrendPeriods = (selectedYear: number): MonthlyTrendPeriod[] => {
  const periods: MonthlyTrendPeriod[] = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Add all 12 months for the selected year only
  for (let m = 0; m < 12; m++) {
    periods.push({
      month: m,
      year: selectedYear,
      label: `${monthNames[m]} ${selectedYear}`,
      identifier: `${selectedYear}-${String(m + 1).padStart(2, "0")}`,
      type: "month",
    });
  }

  // Add year summary columns
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Avg ${selectedYear}`,
    identifier: `avg-${selectedYear}`,
    type: "year-avg",
    summaryYear: selectedYear,
  });
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Total ${selectedYear}`,
    identifier: `total-${selectedYear}`,
    type: "year-total",
    summaryYear: selectedYear,
  });

  return periods;
};

const ScorecardGrid = ({
  departmentId,
  kpis,
  onKPIsChange,
  year,
  quarter,
  onYearChange,
  onQuarterChange,
  onViewModeChange,
}: ScorecardGridProps) => {
  const [entries, setEntries] = useState<{ [key: string]: ScorecardEntry }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const [kpiTargets, setKpiTargets] = useState<{ [key: string]: number }>({});
  const [trendTargets, setTrendTargets] = useState<{ [key: string]: number }>({}); // For monthly trend: ${kpiId}-Q${quarter}-${year}
  const [precedingQuartersData, setPrecedingQuartersData] = useState<{ [key: string]: number }>({});
  const [yearlyAverages, setYearlyAverages] = useState<{
    [key: string]: { prevYear: number | null; currentYear: number | null };
  }>({});
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("monthly");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetEditValue, setTargetEditValue] = useState<string>("");
  const [editingTrendTarget, setEditingTrendTarget] = useState<string | null>(null); // Format: ${kpiId}-Q${quarter}-${year}
  const [trendTargetEditValue, setTrendTargetEditValue] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [showAddKPI, setShowAddKPI] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("");
  const [newKPIName, setNewKPIName] = useState("");
  const [newKPIType, setNewKPIType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [newKPIDirection, setNewKPIDirection] = useState<"above" | "below">("above");
  const [storeUsers, setStoreUsers] = useState<Profile[]>([]);
  const [dynamicPresetKpis, setDynamicPresetKpis] = useState<
    { id: string; name: string; metric_type: string; target_direction: string; aggregation_type: string }[]
  >([]);
  const [draggedOwnerId, setDraggedOwnerId] = useState<string | null>(null);
  const [dragOverOwnerId, setDragOverOwnerId] = useState<string | null>(null);
  const [departmentManagerId, setDepartmentManagerId] = useState<string | null>(null);
  const [departmentStoreId, setDepartmentStoreId] = useState<string | null>(null);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [droppedParseResult, setDroppedParseResult] = useState<CSRParseResult | null>(null);
  const [droppedFileName, setDroppedFileName] = useState<string>("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [importMonth, setImportMonth] = useState<string>("");
  const [importWeekStartDate, setImportWeekStartDate] = useState<string | null>(null);
  const [importLogs, setImportLogs] = useState<{ [month: string]: ScorecardImportLog }>({});
  const [weekImportLogs, setWeekImportLogs] = useState<{ [weekDate: string]: WeekImportLog }>({});
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const monthDropZoneRefs = useRef<Record<string, ScorecardMonthDropZoneHandle | null>>({});
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<string>("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");
  const [pasteOwnerFilter, setPasteOwnerFilter] = useState<string>("all");
  const [pasteKpi, setPasteKpi] = useState<string>("");
  const [pasteData, setPasteData] = useState<string>("");
  const [parsedPasteData, setParsedPasteData] = useState<{ period: string; value: number }[]>([]);
  const [pasteYear, setPasteYear] = useState<number>(new Date().getFullYear());
  const [pasteMonth, setPasteMonth] = useState<string>("01");
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueContext, setIssueContext] = useState<{
    title: string;
    description: string;
    severity: string;
    sourceKpiId?: string;
    sourcePeriod?: string;
  } | null>(null);
  const [cellIssues, setCellIssues] = useState<Set<string>>(new Set());
  const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
  const [clearPeriod, setClearPeriod] = useState<{ identifier: string; label: string; type: "month" | "week" } | null>(null);
  const [clearingPeriod, setClearingPeriod] = useState(false);
  const [previousYearTargets, setPreviousYearTargets] = useState<{ [key: string]: number }>({});
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [showTopScrollbar, setShowTopScrollbar] = useState(false);
  const [scrollLeftDebug, setScrollLeftDebug] = useState(0);
  const [tableWidth, setTableWidth] = useState(0);
  const [scrollbarRect, setScrollbarRect] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [scrollWidthDebug, setScrollWidthDebug] = useState(0);
  const [scrollClientWidthDebug, setScrollClientWidthDebug] = useState(0);

  const currentQuarterInfo = getQuarterInfo(new Date());
  const isQuarterTrendMode = quarter === 0;
  const isMonthlyTrendMode = quarter === -1;
  const weeks = getWeekDates({ year, quarter: quarter || 1 });
  const months = getMonthsForQuarter(quarter || 1, year);
  const previousYearMonths = getPreviousYearMonthsForQuarter(quarter || 1, year);
  const precedingQuarters = getPrecedingQuarters(quarter || 1, year, 4);
  const quarterTrendPeriods = isQuarterTrendMode
    ? getQuarterTrendPeriods(currentQuarterInfo.quarter, currentQuarterInfo.year)
    : [];
  const monthlyTrendPeriods = isMonthlyTrendMode ? getMonthlyTrendPeriods(year) : [];

  const allPeriods = isQuarterTrendMode
    ? quarterTrendPeriods
    : isMonthlyTrendMode
      ? monthlyTrendPeriods
      : viewMode === "weekly"
        ? weeks
        : months;

  // Filtered periods for paste dialog - excludes year averages and totals
  const pastePeriods = allPeriods.filter(
    (period) => !("type" in period && (period.type === "year-avg" || period.type === "year-total")),
  );

  const getRoleColor = (role?: string) => {
    if (!role) return "hsl(var(--muted))";
    switch (role) {
      case "department_manager":
      case "fixed_ops_manager":
        return "hsl(142 76% 36%)"; // Green
      case "service_advisor":
        return "hsl(221 83% 53%)"; // Blue
      case "technician":
        return "hsl(25 95% 53%)"; // Orange
      default:
        return "hsl(var(--muted))";
    }
  };

  const getInitials = (name: string) => {
    if (!name || typeof name !== "string" || name.trim() === "") {
      return "??";
    }
    const trimmedName = name.trim();
    const parts = trimmedName.split(/\s+/).filter((part) => part.length > 0);

    if (parts.length >= 2) {
      const firstInitial = parts[0][0] || "";
      const lastInitial = parts[parts.length - 1][0] || "";
      return `${firstInitial}${lastInitial}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
      return parts[0].toUpperCase();
    }
    return "??";
  };

  // Get current week's Monday to highlight it
  const today = new Date();
  const currentWeekMonday = getMondayOfWeek(today);
  const currentWeekDate = currentWeekMonday.toISOString().split("T")[0];

  // Get previous week's Monday (week before current)
  const previousWeekMonday = new Date(currentWeekMonday);
  previousWeekMonday.setDate(previousWeekMonday.getDate() - 7);
  const previousWeekDate = previousWeekMonday.toISOString().split("T")[0];

  // Track current user ID for realtime filtering
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  // Consolidated effect: Clear ALL state synchronously when view/quarter/department changes
  // This prevents flashing by ensuring all state is cleared in the same render cycle
  useEffect(() => {
    // Set loading immediately to prevent rendering stale data
    setLoading(true);

    // Clear all state synchronously to prevent partial renders
    setEntries({});
    setLocalValues({});
    setKpiTargets({});
    setProfiles({});
    setStoreUsers([]);
    setPrecedingQuartersData({});
    setYearlyAverages({});

    // Load data in correct sequence - targets must be loaded before scorecard data
    const loadData = async () => {
      loadUserRole();
      fetchProfiles();
      loadStoreUsers();
      loadDynamicPresetKpis();
      loadImportLogs();

      // Load targets first and pass them directly to scorecard data to avoid stale state
      const freshTargets = await loadKPITargets();
      await loadScorecardData(freshTargets);

      // Trend modes need additional aggregated data for sparklines + year summaries
      // Regular monthly view also needs preceding quarters data for Q Avg columns
      if (isMonthlyTrendMode || isQuarterTrendMode) {
        await loadPrecedingQuartersData();
        if (isMonthlyTrendMode) {
          await calculateYearlyAverages();
        }
      } else if (viewMode === "monthly") {
        // Regular monthly view needs Q Avg data for the current and previous year
        await loadPrecedingQuartersData();
      }
    };

    loadData();
  }, [departmentId, kpis, year, quarter, viewMode]);

  // Track when scroll container is available
  const [scrollContainerReady, setScrollContainerReady] = useState(false);

  // Set up scroll container ref callback
  useEffect(() => {
    const checkContainer = () => {
      if (scrollContainerRef.current) {
        setScrollContainerReady(true);
      }
    };
    // Check immediately and after a brief delay for render
    checkContainer();
    const timeout = setTimeout(checkContainer, 100);
    return () => clearTimeout(timeout);
  }, [loading, viewMode]);

  // Track table width + on-screen rect for fixed (viewport) scrollbar
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateMetrics = () => {
      const sw = container.scrollWidth;
      const cw = container.clientWidth;
      const rect = container.getBoundingClientRect();

      setTableWidth(sw);
      setScrollbarRect({ left: rect.left, width: rect.width });

      // Reuse the existing debug values so we can also drive visibility logic.
      setScrollWidthDebug(sw);
      setScrollClientWidthDebug(cw);

      setScrollLeftDebug(container.scrollLeft);
    };

    updateMetrics();
    const observer = new ResizeObserver(updateMetrics);
    observer.observe(container);
    window.addEventListener("resize", updateMetrics);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, [kpis, entries, viewMode, year, quarter]);

  const handleMainScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setScrollLeftDebug(container.scrollLeft);
    setScrollWidthDebug(container.scrollWidth);
    setScrollClientWidthDebug(container.clientWidth);
  }, []);

  const setContainerScrollLeft = useCallback((nextScrollLeft: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollLeft = nextScrollLeft;
    setScrollLeftDebug(container.scrollLeft);
  }, []);

  // IntersectionObserver to detect when header row scrolls out of view
  // When header is not visible, show a top scrollbar for easier horizontal scrolling
  useEffect(() => {
    const header = headerRowRef.current;
    if (!header) return;

    const checkVisibility = () => {
      const rect = header.getBoundingClientRect();
      // Header is "out of view" if its bottom is above the viewport top (with nav offset)
      const isOutOfView = rect.bottom < 72;
      setShowTopScrollbar(isOutOfView);
    };

    // Check on scroll
    window.addEventListener("scroll", checkVisibility, { passive: true });
    // Initial check
    checkVisibility();

    return () => {
      window.removeEventListener("scroll", checkVisibility);
    };
  }, []);

  // Sync scroll metrics for the scrollbar components
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const syncMetrics = () => {
      setScrollLeftDebug(container.scrollLeft);
      setScrollWidthDebug(container.scrollWidth);
      setScrollClientWidthDebug(container.clientWidth);
    };

    // Sync once on mount
    syncMetrics();

    const handleScroll = () => {
      syncMetrics();
    };

    container.addEventListener("scroll", handleScroll);
    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerReady]);

  // Real-time subscription for scorecard entries
  useEffect(() => {
    if (!departmentId || kpis.length === 0) return;

    const kpiIds = kpis.map((k) => k.id);

    const channel = supabase
      .channel(`scorecard-realtime-${departmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scorecard_entries",
        },
        async (payload) => {
          // Check if this change is for one of our KPIs
          const entry = (payload.new as any) || (payload.old as any);
          if (!entry?.kpi_id || !kpiIds.includes(entry.kpi_id)) return;

          // Skip if this was our own change (created_by matches current user)
          if (payload.eventType !== "DELETE" && (payload.new as any)?.created_by === currentUserId) {
            return;
          }

          console.log("Realtime scorecard update received:", payload);

          // Reload data to get the latest
          const freshTargets = await loadKPITargets();
          await loadScorecardData(freshTargets);

          // Show toast notification for updates from other users
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const kpi = kpis.find((k) => k.id === (payload.new as any)?.kpi_id);
            const userName = profiles[(payload.new as any)?.created_by]?.full_name || "Another user";
            toast({
              title: "Scorecard updated",
              description: `${kpi?.name || "A KPI"} was updated by ${userName}`,
              duration: 3000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, kpis, currentUserId, profiles]);

  // Auto-scroll to the far right on initial load in weekly/monthly mode so the current quarter is in view
  useLayoutEffect(() => {
    if (isQuarterTrendMode || isMonthlyTrendMode) return;
    if (!scrollContainerRef.current) return;
    if (loading) return;

    const container = scrollContainerRef.current;

    requestAnimationFrame(() => {
      container.scrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    });
  }, [viewMode, isQuarterTrendMode, isMonthlyTrendMode, loading]);

  // Auto-scroll to the far right in monthly trend mode to show the current year on load
  useLayoutEffect(() => {
    if (!isMonthlyTrendMode) return;
    if (!scrollContainerRef.current) return;
    if (loading) return;
    if (Object.keys(precedingQuartersData).length === 0) return;

    const container = scrollContainerRef.current;

    const scrollToRight = () => {
      container.scrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    };

    let tries = 0;
    const tick = () => {
      scrollToRight();
      tries += 1;
      if (tries < 12) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [isMonthlyTrendMode, loading, precedingQuartersData, monthlyTrendPeriods.length, departmentId]);

  // Update local values when entries change
  useEffect(() => {
    const newLocalValues: { [key: string]: string } = {};
    Object.entries(entries).forEach(([key, entry]) => {
      const kpi = kpis.find((k) => entry.kpi_id === k.id);
      if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
        newLocalValues[key] = formatValue(entry.actual_value, kpi.metric_type, kpi.name);
      }
    });
    setLocalValues((prev) => {
      // Only update if we don't have pending saves for these keys
      const updated = { ...prev };
      Object.keys(newLocalValues).forEach((key) => {
        if (!saveTimeoutRef.current[key]) {
          updated[key] = newLocalValues[key];
        }
      });
      return updated;
    });
  }, [entries, kpis]);

  // Fetch cell issues to display red flags
  useEffect(() => {
    const fetchCellIssues = async () => {
      if (!departmentId) return;

      const { data, error } = await supabase
        .from("issues")
        .select("source_kpi_id, source_period")
        .eq("department_id", departmentId)
        .eq("source_type", "scorecard")
        .not("source_kpi_id", "is", null)
        .not("source_period", "is", null);

      if (error) {
        console.error("Error fetching cell issues:", error);
        return;
      }

      const issueSet = new Set<string>();
      data?.forEach((issue) => {
        if (issue.source_kpi_id && issue.source_period) {
          issueSet.add(`${issue.source_kpi_id}-${issue.source_period}`);
        }
      });
      setCellIssues(issueSet);
    };

    fetchCellIssues();
  }, [departmentId]);

  // Ensure storeUsers are merged into profiles map for KPI owner display
  // This fixes cases where get_profiles_basic() may not return all needed profiles
  useEffect(() => {
    if (storeUsers.length > 0) {
      console.log("[ScorecardGrid] Merging storeUsers into profiles:", storeUsers.length, "users");
      setProfiles((prev) => {
        const updated = { ...prev };
        storeUsers.forEach((user) => {
          // Only add if not already present or if existing entry lacks full_name
          if (!updated[user.id] || !updated[user.id].full_name) {
            updated[user.id] = {
              id: user.id,
              full_name: user.full_name,
              role: user.role,
            };
          }
        });
        console.log("[ScorecardGrid] Profiles map after merge:", Object.keys(updated).length, "entries");
        return updated;
      });
    }
  }, [storeUsers]);

  const loadUserRole = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // First check user_roles table for actual roles
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roleError && roleData && roleData.length > 0) {
      // Prioritize roles: super_admin > store_gm > department_manager
      if (roleData.some((r) => r.role === "super_admin")) {
        setUserRole("super_admin");
        return;
      }
      if (roleData.some((r) => r.role === "store_gm")) {
        setUserRole("store_gm");
        return;
      }
      if (roleData.some((r) => r.role === "department_manager" || r.role === "fixed_ops_manager")) {
        setUserRole("department_manager");
        return;
      }
    }

    // Fallback to profile role if no user_roles found
    const { data, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

    if (!error && data) {
      setUserRole(data.role);
    }
  };

  const fetchProfiles = async () => {
    // Use security definer function to get basic profile data
    const { data, error } = await supabase.rpc("get_profiles_basic");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    const profilesMap: { [key: string]: Profile } = {};
    (data || []).forEach((profile: { id: string; full_name: string; role: string }) => {
      profilesMap[profile.id] = { id: profile.id, full_name: profile.full_name, role: profile.role };
    });
    setProfiles(profilesMap);
  };

  const loadStoreUsers = async () => {
    // Get the store_id and manager_id from the department
    const { data: departmentData, error: deptError } = await supabase
      .from("departments")
      .select("store_id, manager_id")
      .eq("id", departmentId)
      .maybeSingle();

    if (deptError || !departmentData) {
      console.error("Error fetching department:", deptError);
      return;
    }

    // Store the department manager ID and store ID
    setDepartmentManagerId(departmentData.manager_id);
    setDepartmentStoreId(departmentData.store_id);

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

  // Load import logs for this department (most recent per month and per week)
  const loadImportLogs = async () => {
    const { data, error } = await supabase
      .from("scorecard_import_logs")
      .select(
        "id, file_name, month, status, created_at, metrics_imported, user_mappings, unmatched_users, warnings, report_file_path",
      )
      .eq("department_id", departmentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching import logs:", error);
      return;
    }

    // Keep only the most recent import per period
    // Monthly identifiers look like "2026-01", weekly look like "2026-01-06"
    const logsByMonth: { [month: string]: ScorecardImportLog } = {};
    const logsByWeek: { [weekDate: string]: WeekImportLog } = {};

    (data || []).forEach((log) => {
      const identifier = log.month;
      // Check if it's a weekly identifier (ISO date format: YYYY-MM-DD)
      const isWeeklyLog = /^\d{4}-\d{2}-\d{2}$/.test(identifier);

      if (isWeeklyLog) {
        if (!logsByWeek[identifier]) {
          logsByWeek[identifier] = {
            id: log.id,
            file_name: log.file_name,
            week_start_date: identifier,
            status: log.status,
            created_at: log.created_at,
            metrics_imported: log.metrics_imported as { count: number } | null,
            user_mappings: log.user_mappings as Record<string, string> | null,
            unmatched_users: log.unmatched_users as string[] | null,
            warnings: log.warnings as string[] | null,
            report_file_path: (log as any).report_file_path as string | null,
          };
        }
      } else {
        if (!logsByMonth[identifier]) {
          logsByMonth[identifier] = {
            id: log.id,
            file_name: log.file_name,
            month: identifier,
            status: log.status,
            created_at: log.created_at,
            metrics_imported: log.metrics_imported as { count: number } | null,
            user_mappings: log.user_mappings as Record<string, string> | null,
            unmatched_users: log.unmatched_users as string[] | null,
            warnings: log.warnings as string[] | null,
            report_file_path: (log as any).report_file_path as string | null,
          };
        }
      }
    });
    setImportLogs(logsByMonth);
    setWeekImportLogs(logsByWeek);
  };

  const loadDynamicPresetKpis = async () => {
    const { data, error } = await supabase
      .from("preset_kpis")
      .select("id, name, metric_type, target_direction, aggregation_type")
      .order("display_order");

    if (error) {
      console.error("Error fetching preset KPIs:", error);
      return;
    }

    setDynamicPresetKpis(data || []);
  };

  const loadKPITargets = async () => {
    if (!kpis.length) return {};

    const kpiIds = kpis.map((k) => k.id);

    // For Monthly Trend mode, load targets for all quarters in the trend period
    if (isMonthlyTrendMode) {
      // Get unique quarter/year combinations from monthly trend periods
      const quarterYears = new Set<string>();
      monthlyTrendPeriods
        .filter((p) => p.type === "month")
        .forEach((month) => {
          const q = Math.floor(month.month / 3) + 1;
          quarterYears.add(`${q}-${month.year}`);
        });

      const { data, error } = await supabase
        .from("kpi_targets")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "monthly");

      if (error) {
        console.error("Error loading KPI targets for trend:", error);
        return {};
      }

      const trendTargetsMap: { [key: string]: number } = {};
      data?.forEach((target) => {
        const key = `${target.kpi_id}-Q${target.quarter}-${target.year}`;
        trendTargetsMap[key] = target.target_value || 0;
      });

      setTrendTargets(trendTargetsMap);
      return {};
    }

    // For Quarter Trend mode, load targets for all quarters in the trend period
    if (isQuarterTrendMode) {
      const { data, error } = await supabase
        .from("kpi_targets")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "monthly"); // Quarter targets use monthly entry_type

      if (error) {
        console.error("Error loading KPI targets for quarter trend:", error);
        return {};
      }

      const trendTargetsMap: { [key: string]: number } = {};
      data?.forEach((target) => {
        const key = `${target.kpi_id}-Q${target.quarter}-${target.year}`;
        trendTargetsMap[key] = target.target_value || 0;
      });

      setTrendTargets(trendTargetsMap);
      return {};
    }

    const { data, error } = await supabase
      .from("kpi_targets")
      .select("*")
      .in("kpi_id", kpiIds)
      .eq("quarter", quarter || 1)
      .eq("year", year)
      .eq("entry_type", viewMode);

    if (error) {
      console.error("Error loading KPI targets:", error);
      return {};
    }

    const targetsMap: { [key: string]: number } = {};
    data?.forEach((target) => {
      targetsMap[target.kpi_id] = target.target_value || 0;
    });

    // For KPIs without quarterly targets, fall back to default target_value
    kpis.forEach((kpi) => {
      if (!targetsMap[kpi.id]) {
        targetsMap[kpi.id] = kpi.target_value;
      }
    });

    setKpiTargets(targetsMap);
    return targetsMap; // Return the targets for immediate use
  };

  const loadScorecardData = async (freshTargets?: { [key: string]: number }) => {
    if (!departmentId || kpis.length === 0) {
      setLoading(false);
      return;
    }

    // Note: setLoading(true) is already called in the parent useEffect
    // Avoid calling it again here to prevent extra re-renders

    // Use fresh targets if provided, otherwise use state
    const targetsToUse = freshTargets || kpiTargets;

    const kpiIds = kpis.map((k) => k.id);

    // Monthly Trend Mode: load ALL monthly entries for the trend period
    if (isMonthlyTrendMode) {
      const monthIdentifiers = monthlyTrendPeriods.filter((p) => p.type === "month").map((p) => p.identifier);

      // PAGINATION: Fetch all monthly trend data to avoid 1000-row limit
      const monthlyData: any[] = [];
      let monthlyOffset = 0;
      const pageSize = 1000;
      let monthlyError: any = null;

      while (true) {
        const { data: page, error } = await supabase
          .from("scorecard_entries")
          .select("*")
          .in("kpi_id", kpiIds)
          .eq("entry_type", "monthly")
          .in("month", monthIdentifiers)
          .range(monthlyOffset, monthlyOffset + pageSize - 1);

        if (error) {
          monthlyError = error;
          break;
        }
        if (!page || page.length === 0) break;

        monthlyData.push(...page);
        if (page.length < pageSize) break;
        monthlyOffset += pageSize;
      }

      if (monthlyError) {
        console.error("Error loading monthly trend data:", monthlyError);
        toast({
          title: "Error",
          description: "Failed to load monthly trend scorecard data",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const newEntries: { [key: string]: ScorecardEntry } = {};
      monthlyData?.forEach((entry) => {
        const key = `${entry.kpi_id}-month-${entry.month}`;

        const kpi = kpis.find((k) => k.id === entry.kpi_id);
        if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
          // Targets in monthly trend are stored by quarter; for display we can safely fall back to the KPI default.
          const target = kpi.target_value;

          let variance: number;
          if (kpi.metric_type === "percentage") {
            variance = entry.actual_value - target;
          } else if (target !== 0) {
            variance = ((entry.actual_value - target) / target) * 100;
          } else {
            if (kpi.target_direction === "below") {
              variance = entry.actual_value > 0 ? 100 : 0;
            } else {
              variance = entry.actual_value > 0 ? 100 : -100;
            }
          }

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
      setLoading(false);
      return;
    }

    if (viewMode === "weekly") {
      // For weeks: fetch weekly entries for this quarter
      const weekDates = weeks.map((w) => w.start.toISOString().split("T")[0]);

      // PAGINATION: Fetch all weekly data to avoid 1000-row limit
      const weeklyData: any[] = [];
      let weeklyOffset = 0;
      const weeklyPageSize = 1000;
      let weeklyError: any = null;

      while (true) {
        const { data: page, error } = await supabase
          .from("scorecard_entries")
          .select("*")
          .in("kpi_id", kpiIds)
          .eq("entry_type", "weekly")
          .in("week_start_date", weekDates)
          .range(weeklyOffset, weeklyOffset + weeklyPageSize - 1);

        if (error) {
          weeklyError = error;
          break;
        }
        if (!page || page.length === 0) break;

        weeklyData.push(...page);
        if (page.length < weeklyPageSize) break;
        weeklyOffset += weeklyPageSize;
      }

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
        const kpi = kpis.find((k) => k.id === entry.kpi_id);
        if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
          const target = targetsToUse[kpi.id] || kpi.target_value;

          let variance: number;
          if (kpi.metric_type === "percentage") {
            variance = entry.actual_value - target;
          } else if (target !== 0) {
            variance = ((entry.actual_value - target) / target) * 100;
          } else {
            // Special handling when target is 0
            if (kpi.target_direction === "below") {
              // For "below" targets with 0 target, any positive value is bad
              variance = entry.actual_value > 0 ? 100 : 0;
            } else {
              // For "above" targets with 0 target, any positive value is good
              variance = entry.actual_value > 0 ? 100 : -100;
            }
          }

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
      // For months: fetch monthly entries for current quarter and previous year's same quarter
      const monthIdentifiers = [...months.map((m) => m.identifier), ...previousYearMonths.map((m) => m.identifier)];
      // PAGINATION: Fetch all monthly data to avoid 1000-row limit
      const monthlyData: any[] = [];
      let monthOffset = 0;
      const monthPageSize = 1000;
      let monthlyError: any = null;

      while (true) {
        const { data: page, error } = await supabase
          .from("scorecard_entries")
          .select("*")
          .in("kpi_id", kpiIds)
          .eq("entry_type", "monthly")
          .in("month", monthIdentifiers)
          .range(monthOffset, monthOffset + monthPageSize - 1);

        if (error) {
          monthlyError = error;
          break;
        }
        if (!page || page.length === 0) break;

        monthlyData.push(...page);
        if (page.length < monthPageSize) break;
        monthOffset += monthPageSize;
      }

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

      // Load previous year targets for comparison
      const previousYear = year - 1;
      const { data: prevYearTargetsData, error: prevYearTargetsError } = await supabase
        .from("kpi_targets")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("quarter", quarter)
        .eq("year", previousYear)
        .eq("entry_type", "monthly");

      if (prevYearTargetsError) {
        console.error("Error loading previous year targets:", prevYearTargetsError);
      }

      // Store previous year targets
      const prevYearTargetsMap: { [key: string]: number } = {};
      prevYearTargetsData?.forEach((target) => {
        prevYearTargetsMap[target.kpi_id] = target.target_value || 0;
      });
      // Fall back to default target_value for KPIs without previous year targets
      kpis.forEach((kpi) => {
        if (prevYearTargetsMap[kpi.id] === undefined) {
          prevYearTargetsMap[kpi.id] = kpi.target_value;
        }
      });
      setPreviousYearTargets(prevYearTargetsMap);

      const newEntries: { [key: string]: ScorecardEntry } = {};
      monthlyData?.forEach((entry) => {
        const key = `${entry.kpi_id}-month-${entry.month}`;

        // Recalculate status based on appropriate target (current year or previous year)
        const kpi = kpis.find((k) => k.id === entry.kpi_id);
        if (kpi && entry.actual_value !== null && entry.actual_value !== undefined) {
          // Determine if this is a previous year entry
          const entryYear = parseInt(entry.month.split("-")[0]);
          const isPrevYear = entryYear === previousYear;
          const target = isPrevYear
            ? (prevYearTargetsMap[kpi.id] ?? kpi.target_value)
            : targetsToUse[kpi.id] || kpi.target_value;

          let variance: number;
          if (kpi.metric_type === "percentage") {
            variance = entry.actual_value - target;
          } else if (target !== 0) {
            variance = ((entry.actual_value - target) / target) * 100;
          } else {
            // Special handling when target is 0
            if (kpi.target_direction === "below") {
              // For "below" targets with 0 target, any positive value is bad
              variance = entry.actual_value > 0 ? 100 : 0;
            } else {
              // For "above" targets with 0 target, any positive value is good
              variance = entry.actual_value > 0 ? 100 : -100;
            }
          }

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

    if (isMonthlyTrendMode) {
      // Load data for all months in the monthly trend in a single query
      // Filter out summary periods (year-avg, year-total) - only include actual month periods
      const actualMonthPeriods = monthlyTrendPeriods.filter((m) => m.type === "month");
      const monthIdentifiers = actualMonthPeriods.map((m) => m.identifier);

      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in(
          "kpi_id",
          kpis.map((k) => k.id),
        )
        .eq("entry_type", "monthly")
        .in("month", monthIdentifiers);

      if (error) {
        console.error("Error loading monthly trend data:", error);
      } else {
        // Calculate average for each KPI in each month (only actual months, not summaries)
        actualMonthPeriods.forEach((month) => {
          kpis.forEach((kpi) => {
            const kpiEntries = data?.filter((e) => e.kpi_id === kpi.id && e.month === month.identifier) || [];
            const values = kpiEntries
              .map((e) => e.actual_value)
              .filter((v): v is number => v !== null && v !== undefined);

            if (values.length > 0) {
              const average = values.reduce((sum, v) => sum + v, 0) / values.length;
              const key = `${kpi.id}-M${month.month + 1}-${month.year}`;
              quarterAverages[key] = average;
            }
          });
        });
      }
    } else if (isQuarterTrendMode) {
      // Load data for all quarters in a single query
      const allQuarterMonths: string[] = [];
      quarterTrendPeriods.forEach((qtr) => {
        const startMonth = (qtr.quarter - 1) * 3 + 1;
        allQuarterMonths.push(
          `${qtr.year}-${String(startMonth).padStart(2, "0")}`,
          `${qtr.year}-${String(startMonth + 1).padStart(2, "0")}`,
          `${qtr.year}-${String(startMonth + 2).padStart(2, "0")}`,
        );
      });

      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in(
          "kpi_id",
          kpis.map((k) => k.id),
        )
        .eq("entry_type", "monthly")
        .in("month", allQuarterMonths);

      if (error) {
        console.error("Error loading quarter trend data:", error);
      } else {
        // Calculate average for each KPI in each quarter
        quarterTrendPeriods.forEach((qtr) => {
          const startMonth = (qtr.quarter - 1) * 3 + 1;
          const quarterMonths = [
            `${qtr.year}-${String(startMonth).padStart(2, "0")}`,
            `${qtr.year}-${String(startMonth + 1).padStart(2, "0")}`,
            `${qtr.year}-${String(startMonth + 2).padStart(2, "0")}`,
          ];

          kpis.forEach((kpi) => {
            const kpiEntries = data?.filter((e) => e.kpi_id === kpi.id && quarterMonths.includes(e.month || "")) || [];
            const values = kpiEntries
              .map((e) => e.actual_value)
              .filter((v): v is number => v !== null && v !== undefined);

            if (values.length > 0) {
              const average = values.reduce((sum, v) => sum + v, 0) / values.length;
              const key = `${kpi.id}-Q${qtr.quarter}-${qtr.year}`;
              quarterAverages[key] = average;
            }
          });
        });
      }
    } else {
      // Load data for both previous year quarter and current year quarter
      const startMonth = (quarter - 1) * 3 + 1;
      const prevYearQuarterMonths = [
        `${year - 1}-${String(startMonth).padStart(2, "0")}`,
        `${year - 1}-${String(startMonth + 1).padStart(2, "0")}`,
        `${year - 1}-${String(startMonth + 2).padStart(2, "0")}`,
      ];
      const currentYearQuarterMonths = [
        `${year}-${String(startMonth).padStart(2, "0")}`,
        `${year}-${String(startMonth + 1).padStart(2, "0")}`,
        `${year}-${String(startMonth + 2).padStart(2, "0")}`,
      ];
      const allQuarterMonths = [...prevYearQuarterMonths, ...currentYearQuarterMonths];

      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in(
          "kpi_id",
          kpis.map((k) => k.id),
        )
        .eq("entry_type", "monthly")
        .in("month", allQuarterMonths);

      if (error) {
        console.error("Error loading quarter data:", error);
        return;
      }

      // Calculate average for previous year quarter
      kpis.forEach((kpi) => {
        const prevYearEntries =
          data?.filter((e) => e.kpi_id === kpi.id && prevYearQuarterMonths.includes(e.month || "")) || [];
        const prevYearValues = prevYearEntries
          .map((e) => e.actual_value)
          .filter((v): v is number => v !== null && v !== undefined);

        if (prevYearValues.length > 0) {
          const average = prevYearValues.reduce((sum, v) => sum + v, 0) / prevYearValues.length;
          quarterAverages[`${kpi.id}-Q${quarter}-${year - 1}`] = average;
        }
      });

      // Calculate average for current year quarter
      kpis.forEach((kpi) => {
        const currentYearEntries =
          data?.filter((e) => e.kpi_id === kpi.id && currentYearQuarterMonths.includes(e.month || "")) || [];
        const currentYearValues = currentYearEntries
          .map((e) => e.actual_value)
          .filter((v): v is number => v !== null && v !== undefined);

        if (currentYearValues.length > 0) {
          const average = currentYearValues.reduce((sum, v) => sum + v, 0) / currentYearValues.length;
          quarterAverages[`${kpi.id}-Q${quarter}-${year}`] = average;
        }
      });
    }

    setPrecedingQuartersData(quarterAverages);
  };

  const calculateYearlyAverages = async () => {
    if (!departmentId || kpis.length === 0) return;

    const averages: { [key: string]: { prevYear: number | null; currentYear: number | null } } = {};

    // Fetch previous year data (all 12 months)
    const prevYearMonths = Array.from({ length: 12 }, (_, i) => `${year - 1}-${String(i + 1).padStart(2, "0")}`);

    const { data: prevYearData, error: prevYearError } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .eq("entry_type", "monthly")
      .in("month", prevYearMonths);

    if (prevYearError) {
      console.error("Error loading previous year data:", prevYearError);
    }

    // Fetch current year data (all 12 months)
    const currentYearMonths = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

    const { data: currentYearData, error: currentYearError } = await supabase
      .from("scorecard_entries")
      .select("*")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .eq("entry_type", "monthly")
      .in("month", currentYearMonths);

    if (currentYearError) {
      console.error("Error loading current year data:", currentYearError);
    }

    // Calculate averages for each KPI
    kpis.forEach((kpi) => {
      // Calculate previous year average
      const prevYearEntries = prevYearData?.filter((e) => e.kpi_id === kpi.id) || [];
      const prevYearValues = prevYearEntries
        .map((e) => e.actual_value)
        .filter((v): v is number => v !== null && v !== undefined);

      const prevYearAvg =
        prevYearValues.length > 0 ? prevYearValues.reduce((sum, v) => sum + v, 0) / prevYearValues.length : null;

      // Calculate current year average
      const currentYearEntries = currentYearData?.filter((e) => e.kpi_id === kpi.id) || [];
      const currentYearValues = currentYearEntries
        .map((e) => e.actual_value)
        .filter((v): v is number => v !== null && v !== undefined);

      const currentYearAvg =
        currentYearValues.length > 0
          ? currentYearValues.reduce((sum, v) => sum + v, 0) / currentYearValues.length
          : null;

      averages[kpi.id] = {
        prevYear: prevYearAvg,
        currentYear: currentYearAvg,
      };
    });

    setYearlyAverages(averages);
  };

  const calculateDependentKPIs = async (
    changedKpiId: string,
    periodKey: string,
    isMonthly: boolean,
    monthId?: string,
    updatedEntries?: { [key: string]: ScorecardEntry },
  ) => {
    const changedKpi = kpis.find((k) => k.id === changedKpiId);
    if (!changedKpi) return;

    // Use the updated entries if provided, otherwise use state
    const currentEntries = updatedEntries || entries;

    // Define calculation rules (empty - no auto-calculated KPIs currently)
    const calculationRules: { [key: string]: { numerator: string; denominator: string } } = {
      // "CP Labour Sales Per RO": { numerator: "CP Labour Sales", denominator: "CP RO's" }, - removed to allow manual entry
    };

    // Find KPIs that need to be calculated based on the changed KPI
    for (const kpi of kpis) {
      const rule = calculationRules[kpi.name];
      if (!rule) continue;

      // Check if the changed KPI is part of this calculation
      if (rule.numerator !== changedKpi.name && rule.denominator !== changedKpi.name) continue;

      // CRITICAL: Find the numerator and denominator KPIs that belong to the SAME OWNER as the calculated KPI
      const numeratorKpi = kpis.find((k) => k.name === rule.numerator && k.assigned_to === kpi.assigned_to);
      const denominatorKpi = kpis.find((k) => k.name === rule.denominator && k.assigned_to === kpi.assigned_to);

      if (!numeratorKpi || !denominatorKpi) continue;

      // Get the values for this period
      const numeratorKey = isMonthly ? `${numeratorKpi.id}-month-${monthId}` : `${numeratorKpi.id}-${periodKey}`;
      const denominatorKey = isMonthly ? `${denominatorKpi.id}-month-${monthId}` : `${denominatorKpi.id}-${periodKey}`;

      const numeratorEntry = currentEntries[numeratorKey];
      const denominatorEntry = currentEntries[denominatorKey];

      const numeratorValue = numeratorEntry?.actual_value;
      const denominatorValue = denominatorEntry?.actual_value;

      console.log("📈 Values:", { numeratorValue, denominatorValue });

      // Only calculate if both values exist and denominator is not zero
      if (numeratorValue && denominatorValue && denominatorValue !== 0) {
        console.log("✅ Calculating:", kpi.name, "=", numeratorValue, "/", denominatorValue);
        let calculatedValue = numeratorValue / denominatorValue;

        // Round CP Labour Sales Per RO to nearest dollar
        if (kpi.name === "CP Labour Sales Per RO") {
          calculatedValue = Math.round(calculatedValue);
        }

        const target = kpiTargets[kpi.id] || kpi.target_value;

        const variance =
          kpi.metric_type === "percentage" ? calculatedValue - target : ((calculatedValue - target) / target) * 100;

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
          entry_type: isMonthly ? "monthly" : "weekly",
        };

        if (isMonthly) {
          entryData.month = monthId;
        } else {
          entryData.week_start_date = periodKey;
        }

        const { data, error } = await supabase
          .from("scorecard_entries")
          .upsert(entryData, {
            onConflict: isMonthly ? "kpi_id,month" : "kpi_id,week_start_date",
          })
          .select()
          .single();

        if (!error && data) {
          const calculatedKey = isMonthly ? `${kpi.id}-month-${monthId}` : `${kpi.id}-${periodKey}`;
          console.log("💾 Saved calculated value:", kpi.name, "=", calculatedValue);

          // Update entries using functional form
          setEntries((prev) => ({
            ...prev,
            [calculatedKey]: data as ScorecardEntry,
          }));

          // Don't clear localValues for calculated values - let display logic handle it
        } else if (error) {
          console.error("❌ Failed to save calculated value:", error);
        }
      } else {
        console.log("⚠️ Skipping calculation - missing values");
      }
    }
  };

  const handleValueChange = (
    kpiId: string,
    periodKey: string,
    value: string,
    target: number,
    type: string,
    targetDirection: "above" | "below",
    isMonthly: boolean,
    monthId?: string,
  ) => {
    const key = isMonthly ? `${kpiId}-month-${monthId}` : `${kpiId}-${periodKey}`;

    // Only update local state - don't save yet
    setLocalValues((prev) => ({ ...prev, [key]: value }));
  };

  const saveValue = async (
    kpiId: string,
    periodKey: string,
    value: string,
    target: number,
    type: string,
    targetDirection: "above" | "below",
    isMonthly: boolean,
    monthId?: string,
  ) => {
    const key = isMonthly ? `${kpiId}-month-${monthId}` : `${kpiId}-${periodKey}`;

    // Clear any existing timeout for this field
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
      delete saveTimeoutRef.current[key];
    }

    const actualValue = parseFloat(value) || null;

    setSaving((prev) => ({ ...prev, [key]: true }));

    // If value is empty/null, delete the entry
    if (actualValue === null || value === "") {
      let deleteQuery = supabase
        .from("scorecard_entries")
        .delete()
        .eq("kpi_id", kpiId)
        .eq("entry_type", isMonthly ? "monthly" : "weekly");

      if (isMonthly) {
        deleteQuery = deleteQuery.eq("month", monthId);
      } else {
        deleteQuery = deleteQuery.eq("week_start_date", periodKey);
      }

      const { error } = await deleteQuery;

      if (error) {
        toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
      } else {
        // Remove from local state
        setEntries((prev) => {
          const newEntries = { ...prev };
          delete newEntries[key];
          return newEntries;
        });
        // Keep an explicit empty local value so the UI doesn't fall back to cached/preceding data
        setLocalValues((prev) => ({
          ...prev,
          [key]: "",
        }));

        // In monthly views, cells may fall back to precedingQuartersData; clear that too for this cell.
        if (isMonthly && monthId) {
          const [year, month] = monthId.split("-");
          const monthNumber = Number(month);
          if (year && Number.isFinite(monthNumber)) {
            const mKey = `${kpiId}-M${monthNumber}-${year}`;
            setPrecedingQuartersData((prev) => {
              const next = { ...prev };
              delete next[mKey];
              return next;
            });
          }
        }
      }

      setSaving((prev) => ({ ...prev, [key]: false }));
      return;
    }

    let variance: number;
    if (type === "percentage") {
      variance = actualValue - target;
    } else if (target !== 0) {
      variance = ((actualValue - target) / target) * 100;
    } else {
      // Special handling when target is 0
      if (targetDirection === "below") {
        // For "below" targets with 0 target, any positive value is bad
        variance = actualValue > 0 ? 100 : 0;
      } else {
        // For "above" targets with 0 target, any positive value is good
        variance = actualValue > 0 ? 100 : -100;
      }
    }

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
      entry_type: isMonthly ? "monthly" : "weekly",
    };

    if (isMonthly) {
      entryData.month = monthId;
    } else {
      entryData.week_start_date = periodKey;
    }

    const { data, error } = await supabase
      .from("scorecard_entries")
      .upsert(entryData, {
        onConflict: isMonthly ? "kpi_id,month" : "kpi_id,week_start_date",
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error", description: "Failed to save entry", variant: "destructive" });
    } else if (data) {
      // Update entries state first
      let latestEntries: Record<string, ScorecardEntry> = {};
      setEntries((prev) => {
        latestEntries = {
          ...prev,
          [key]: data as ScorecardEntry,
        };
        return latestEntries;
      });

      // Clear localValues after successful save
      setLocalValues((prev) => {
        const newLocalValues = { ...prev };
        delete newLocalValues[key];
        return newLocalValues;
      });

      // Auto-calculate dependent KPIs with the updated entries
      await calculateDependentKPIs(kpiId, periodKey, isMonthly, monthId, latestEntries);
    }

    setSaving((prev) => ({ ...prev, [key]: false }));
  };

  const getStatus = (status: string | null) => {
    if (!status) return "default";
    if (status === "green") return "success";
    if (status === "yellow") return "warning";
    return "destructive";
  };

  const formatValue = (value: number | null, type: string, kpiName?: string) => {
    if (value === null || value === undefined) return "";
    // CP Hours Per RO (including "Total CP Hours Per RO"), Total ELR, Total CP ELR, and Warranty ELR should always show 2 decimal places
    if (
      kpiName === "CP Hours Per RO" ||
      kpiName === "Total CP Hours Per RO" ||
      kpiName === "Total ELR" ||
      kpiName === "Total CP ELR" ||
      kpiName === "Warranty ELR"
    ) {
      return Number(value).toFixed(2);
    }
    // Total Hours, Total Labour Sales, CP Labour Sales Per RO, Total CP Labour Sales Per RO, CP ELR, CP Hours, and Customer Pay Hours should show whole numbers
    if (
      kpiName === "Total Hours" ||
      kpiName === "Total Labour Sales" ||
      kpiName === "CP Labour Sales Per RO" ||
      kpiName === "Total CP Labour Sales Per RO" ||
      kpiName === "CP ELR" ||
      kpiName === "CP Hours" ||
      kpiName === "Customer Pay Hours"
    ) {
      return Math.round(value).toString();
    }
    // Don't format with commas for input fields - number inputs don't accept them
    return value.toString();
  };

  const formatTarget = (value: number, type: string, kpiName?: string) => {
    // CP Hours Per RO (including "Total CP Hours Per RO") should always show 2 decimal places
    if (kpiName === "CP Hours Per RO" || kpiName === "Total CP Hours Per RO") {
      return Number(value).toFixed(2);
    }
    // Total ELR, Total CP ELR, and Warranty ELR should show 2 decimal places with $
    if (kpiName === "Total ELR" || kpiName === "Total CP ELR" || kpiName === "Warranty ELR") {
      return `$${Number(value).toFixed(2)}`;
    }
    // Total Labour Sales, CP Labour Sales Per RO, Total CP Labour Sales Per RO, and CP ELR should show whole dollars
    if (
      kpiName === "Total Labour Sales" ||
      kpiName === "CP Labour Sales Per RO" ||
      kpiName === "Total CP Labour Sales Per RO" ||
      kpiName === "CP ELR"
    ) {
      return `$${Math.round(value).toLocaleString()}`;
    }
    // Total Hours, CP Hours, and Customer Pay Hours should show whole numbers
    if (kpiName === "Total Hours" || kpiName === "CP Hours" || kpiName === "Customer Pay Hours") {
      return Math.round(value).toLocaleString();
    }
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${Math.round(value)}%`;
    return value.toString();
  };

  const formatQuarterAverage = (value: number, type: string, kpiName?: string) => {
    // CP Hours Per RO (including "Total CP Hours Per RO") should always show 2 decimal places
    if (kpiName === "CP Hours Per RO" || kpiName === "Total CP Hours Per RO") {
      return Number(value).toFixed(2);
    }
    // CP Labour Sales, CP Hours, and CP RO's should show no decimal places in quarter averages
    if (kpiName === "CP Labour Sales") {
      return `$${Math.round(value).toLocaleString()}`;
    }
    if (
      kpiName === "CP Hours" ||
      kpiName === "CP RO's" ||
      kpiName === "Customer Pay Hours" ||
      kpiName === "Total RO's"
    ) {
      return Math.round(value).toLocaleString();
    }
    // Internal ELR should show 2 decimal places
    if (kpiName === "Internal ELR") {
      return `$${Number(value).toFixed(2)}`;
    }

    // Percentages: whole number
    if (type === "percentage") {
      return `${Math.round(value)}%`;
    }

    // Dollars: if average isn't whole dollars, show cents
    if (type === "dollar") {
      const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
      const nf2 = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const hasDecimals = value % 1 !== 0;
      return `$${(hasDecimals ? nf2 : nf0).format(value)}`;
    }

    // Everything else (including custom KPIs like CSI): if the average has decimals, show 2 decimals
    // This avoids long repeating decimals like 97.6666666667.
    const hasDecimals = value % 1 !== 0;
    if (hasDecimals) return Number(value).toFixed(2);
    return value.toLocaleString();
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
    return (
      userRole === "super_admin" ||
      userRole === "store_gm" ||
      userRole === "department_manager" ||
      userRole === "fixed_ops_manager"
    );
  };

  const handleTargetEdit = (kpiId: string) => {
    if (!canEditTargets()) return;
    const currentTarget = kpiTargets[kpiId] || kpis.find((k) => k.id === kpiId)?.target_value || 0;
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

    const { error } = await supabase.from("kpi_targets").upsert(
      {
        kpi_id: kpiId,
        quarter: quarter,
        year: year,
        entry_type: viewMode,
        target_value: newValue,
      },
      {
        onConflict: "kpi_id,quarter,year,entry_type",
      },
    );

    if (error) {
      console.error("Failed to update target:", error);
      toast({
        title: "Error",
        description: `Failed to update target: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    setEditingTarget(null);

    // Fetch fresh targets from database
    const { data: freshTargetsData } = await supabase
      .from("kpi_targets")
      .select("*")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .eq("quarter", quarter)
      .eq("year", year)
      .eq("entry_type", viewMode);

    const freshTargetsMap: { [key: string]: number } = {};
    freshTargetsData?.forEach((target) => {
      freshTargetsMap[target.kpi_id] = target.target_value || 0;
    });

    // Update state with fresh targets
    setKpiTargets(freshTargetsMap);

    // Recalculate status for all existing entries with the new target
    await recalculateEntryStatuses(kpiId, newValue);

    // Reload scorecard data with fresh targets to ensure colors update
    await loadScorecardData(freshTargetsMap);

    toast({
      title: "Success",
      description: "Target updated and statuses recalculated",
    });
  };

  const handleCopyToQuarters = async (kpiId: string) => {
    const currentTarget = kpiTargets[kpiId] || kpis.find((k) => k.id === kpiId)?.target_value;
    if (currentTarget === undefined || currentTarget === null) return;

    const updates = [1, 2, 3, 4]
      .filter((q) => q !== quarter)
      .map((q) => ({
        kpi_id: kpiId,
        quarter: q,
        year: year,
        entry_type: viewMode,
        target_value: currentTarget,
      }));

    const { error } = await supabase.from("kpi_targets").upsert(updates, {
      onConflict: "kpi_id,quarter,year,entry_type",
    });

    if (error) {
      console.error("Failed to copy targets:", error);
      toast({
        title: "Error",
        description: `Failed to copy targets: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    // Fetch fresh targets from database
    const { data: freshTargetsData } = await supabase
      .from("kpi_targets")
      .select("*")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .eq("quarter", quarter)
      .eq("year", year)
      .eq("entry_type", viewMode);

    const freshTargetsMap: { [key: string]: number } = {};
    freshTargetsData?.forEach((target) => {
      freshTargetsMap[target.kpi_id] = target.target_value || 0;
    });

    // Update state with fresh targets
    setKpiTargets(freshTargetsMap);

    // Recalculate status for all existing entries with the new target
    await recalculateEntryStatuses(kpiId, currentTarget);

    // Reload scorecard data with fresh targets to ensure colors update
    await loadScorecardData(freshTargetsMap);

    toast({
      title: "Success",
      description: `Target copied to all quarters in ${year} and statuses recalculated`,
    });
  };

  // Handle editing trend targets (for Monthly Trend view)
  const handleTrendTargetEdit = (kpiId: string, targetQuarter: number, targetYear: number) => {
    if (!canEditTargets()) return;
    const targetKey = `${kpiId}-Q${targetQuarter}-${targetYear}`;
    const currentTarget = trendTargets[targetKey] ?? kpis.find((k) => k.id === kpiId)?.target_value ?? 0;
    setEditingTrendTarget(targetKey);
    setTrendTargetEditValue(currentTarget.toString());
  };

  const handleTrendTargetSave = async (kpiId: string, targetQuarter: number, targetYear: number) => {
    const trimmedValue = trendTargetEditValue.trim();

    if (trimmedValue === "") {
      setEditingTrendTarget(null);
      setTrendTargetEditValue("");
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

    const { error } = await supabase.from("kpi_targets").upsert(
      {
        kpi_id: kpiId,
        quarter: targetQuarter,
        year: targetYear,
        entry_type: "monthly",
        target_value: newValue,
      },
      {
        onConflict: "kpi_id,quarter,year,entry_type",
      },
    );

    if (error) {
      console.error("Failed to update trend target:", error);
      toast({
        title: "Error",
        description: `Failed to update target: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    // Update local state
    const targetKey = `${kpiId}-Q${targetQuarter}-${targetYear}`;
    setTrendTargets((prev) => ({ ...prev, [targetKey]: newValue }));
    setEditingTrendTarget(null);
    setTrendTargetEditValue("");

    toast({
      title: "Success",
      description: `Q${targetQuarter} ${targetYear} target updated`,
    });
  };

  const handleCopyTrendTargetToAllQuarters = async (kpiId: string, sourceQuarter: number, sourceYear: number) => {
    const targetKey = `${kpiId}-Q${sourceQuarter}-${sourceYear}`;
    const currentTarget = trendTargets[targetKey] ?? kpis.find((k) => k.id === kpiId)?.target_value;
    if (currentTarget === undefined || currentTarget === null) return;

    // Get all unique years from the monthly trend periods
    const yearsInTrend = Array.from(new Set(monthlyTrendPeriods.map((m) => m.year)));

    const updates: { kpi_id: string; quarter: number; year: number; entry_type: string; target_value: number }[] = [];

    yearsInTrend.forEach((y) => {
      [1, 2, 3, 4].forEach((q) => {
        // Skip the source quarter/year combination
        if (!(q === sourceQuarter && y === sourceYear)) {
          updates.push({
            kpi_id: kpiId,
            quarter: q,
            year: y,
            entry_type: "monthly",
            target_value: currentTarget,
          });
        }
      });
    });

    const { error } = await supabase.from("kpi_targets").upsert(updates, {
      onConflict: "kpi_id,quarter,year,entry_type",
    });

    if (error) {
      console.error("Failed to copy trend targets:", error);
      toast({
        title: "Error",
        description: `Failed to copy targets: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    // Update local trendTargets state
    const newTrendTargets = { ...trendTargets };
    updates.forEach((u) => {
      newTrendTargets[`${u.kpi_id}-Q${u.quarter}-${u.year}`] = u.target_value;
    });
    setTrendTargets(newTrendTargets);

    toast({
      title: "Success",
      description: `Target copied to all quarters (${yearsInTrend.join(", ")})`,
    });
  };

  // Recalculate status for all existing entries of a KPI when target changes
  const recalculateEntryStatuses = async (kpiId: string, newTarget: number) => {
    const kpi = kpis.find((k) => k.id === kpiId);
    if (!kpi) return;

    // Fetch all existing entries for this KPI in the current quarter/year
    const { data: existingEntries, error: fetchError } = await supabase
      .from("scorecard_entries")
      .select("*")
      .eq("kpi_id", kpiId)
      .eq("entry_type", viewMode);

    if (fetchError || !existingEntries) {
      console.error("Error fetching entries for recalculation:", fetchError);
      return;
    }

    // Filter entries for current quarter/year based on view mode
    const relevantEntries =
      viewMode === "weekly"
        ? existingEntries.filter((e) => {
            if (!e.week_start_date) return false;
            const entryDate = new Date(e.week_start_date);
            const entryQuarterInfo = getQuarterInfo(entryDate);
            return entryQuarterInfo.year === year && entryQuarterInfo.quarter === quarter;
          })
        : existingEntries.filter((e) => {
            if (!e.month) return false;
            const [entryYear, entryMonth] = e.month.split("-").map(Number);
            const entryQuarter = Math.ceil(entryMonth / 3);
            return entryYear === year && entryQuarter === quarter;
          });

    // Recalculate status for each entry
    const updates = relevantEntries
      .map((entry) => {
        const actualValue = entry.actual_value;
        if (actualValue === null || actualValue === undefined) return null;

        const variance =
          kpi.metric_type === "percentage" ? actualValue - newTarget : ((actualValue - newTarget) / newTarget) * 100;

        let status: string;
        if (kpi.target_direction === "above") {
          status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
        } else {
          status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
        }

        return {
          id: entry.id,
          variance,
          status,
        };
      })
      .filter(Boolean);

    // Update all entries with new status
    for (const update of updates) {
      if (update) {
        await supabase
          .from("scorecard_entries")
          .update({
            variance: update.variance,
            status: update.status,
          })
          .eq("id", update.id);
      }
    }
  };

  // Recalculate statuses for all KPIs (used when bulk updating targets)
  const recalculateAllEntryStatuses = async () => {
    // Get updated targets directly from database
    const { data: targets, error: targetsError } = await supabase
      .from("kpi_targets")
      .select("*")
      .in(
        "kpi_id",
        kpis.map((k) => k.id),
      )
      .eq("quarter", quarter)
      .eq("year", year)
      .eq("entry_type", viewMode);

    if (targetsError) {
      console.error("Error loading targets for recalculation:", targetsError);
      return;
    }

    const freshTargetsMap: { [key: string]: number } = {};
    targets?.forEach((target) => {
      freshTargetsMap[target.kpi_id] = target.target_value || 0;
    });

    // Update state with fresh targets
    setKpiTargets(freshTargetsMap);

    // For KPIs without quarterly targets, use default target_value
    kpis.forEach((kpi) => {
      if (!freshTargetsMap[kpi.id]) {
        freshTargetsMap[kpi.id] = kpi.target_value;
      }
    });

    // Recalculate each KPI's entries
    for (const kpi of kpis) {
      await recalculateEntryStatuses(kpi.id, freshTargetsMap[kpi.id]);
    }
  };

  // Check if a KPI is automatically calculated
  const isCalculatedKPI = (kpiName: string): boolean => {
    const calculatedKPIs: string[] = [
      // "CP Labour Sales Per RO" - removed to allow manual entry/paste
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
      // First try to find in dynamic presets from database
      const dynamicPreset = dynamicPresetKpis.find((p) => p.name === presetName);
      if (dynamicPreset) {
        setSelectedPreset(presetName);
        setNewKPIName(dynamicPreset.name);
        setNewKPIType(dynamicPreset.metric_type as "dollar" | "percentage" | "unit");
        setNewKPIDirection(dynamicPreset.target_direction as "above" | "below");
      } else {
        // Fallback to hardcoded presets for backwards compatibility
        const preset = PRESET_KPIS.find((p) => p.name === presetName);
        if (preset) {
          setSelectedPreset(presetName);
          setNewKPIName(preset.name);
          setNewKPIType(preset.metricType);
          setNewKPIDirection(preset.targetDirection);
        }
      }
    }
  };

  const handleBulkRecalculateAll = async () => {
    try {
      setSaving((prev) => ({ ...prev, "bulk-recalc": true }));

      let hoursPerROUpdates = 0;
      let elrUpdates = 0;

      // 1. Recalculate CP Hours Per RO
      const cpHoursPerROKpi = kpis.find((k) => k.name === "CP Hours Per RO");
      const cpHoursKpi = kpis.find((k) => k.name === "CP Hours");
      const cpROsKpi = kpis.find((k) => k.name === "CP RO's");

      if (cpHoursPerROKpi && cpHoursKpi && cpROsKpi) {
        const { data: allEntries } = await supabase
          .from("scorecard_entries")
          .select("*")
          .in("kpi_id", [cpHoursKpi.id, cpROsKpi.id, cpHoursPerROKpi.id]);

        const updates: any[] = [];
        const entriesByKey: { [key: string]: any } = {};

        allEntries?.forEach((entry) => {
          const key = entry.entry_type === "weekly" ? entry.week_start_date : entry.month;
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
            .from("scorecard_entries")
            .update({
              actual_value: update.actual_value,
              variance: update.variance,
              status: update.status,
            })
            .eq("id", update.id);
        }

        hoursPerROUpdates = updates.length;
      }

      // 2. Recalculate CP ELR
      const cpELRKpis = kpis.filter((k) => k.name === "CP ELR");
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user?.id;

      for (const elrKpi of cpELRKpis) {
        const ownerId = elrKpi.assigned_to;

        const cpLabourSalesKpi = kpis.find((k) => k.name === "CP Labour Sales" && k.assigned_to === ownerId);
        const cpHoursKpi = kpis.find((k) => k.name === "CP Hours" && k.assigned_to === ownerId);

        if (!cpLabourSalesKpi || !cpHoursKpi) continue;

        const { data: labourSalesEntries } = await supabase
          .from("scorecard_entries")
          .select("*")
          .eq("kpi_id", cpLabourSalesKpi.id);

        const { data: hoursEntries } = await supabase.from("scorecard_entries").select("*").eq("kpi_id", cpHoursKpi.id);

        if (!labourSalesEntries || !hoursEntries) continue;

        const labourSalesByPeriod: { [key: string]: number } = {};
        const hoursByPeriod: { [key: string]: number } = {};

        labourSalesEntries.forEach((e) => {
          const key = e.entry_type === "monthly" ? e.month : e.week_start_date;
          labourSalesByPeriod[key] = e.actual_value;
        });

        hoursEntries.forEach((e) => {
          const key = e.entry_type === "monthly" ? e.month : e.week_start_date;
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

            const isMonthly = period.includes("-") && period.split("-").length === 2;
            const entryData: any = {
              kpi_id: elrKpi.id,
              actual_value: calculatedValue,
              variance,
              status,
              created_by: userId,
              entry_type: isMonthly ? "monthly" : "weekly",
            };

            if (isMonthly) {
              entryData.month = period;
            } else {
              entryData.week_start_date = period;
            }

            const { error } = await supabase.from("scorecard_entries").upsert(entryData, {
              onConflict: isMonthly ? "kpi_id,month" : "kpi_id,week_start_date",
            });

            if (!error) {
              elrUpdates++;
            }
          }
        }
      }

      setSaving((prev) => ({ ...prev, "bulk-recalc": false }));

      toast({
        title: "Recalculation complete",
        description: `Updated ${hoursPerROUpdates} CP Hours Per RO and ${elrUpdates} CP ELR entries`,
      });

      loadScorecardData();
    } catch (error) {
      console.error("Error during bulk recalculation:", error);
      setSaving((prev) => ({ ...prev, "bulk-recalc": false }));
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

    const maxOrder = Math.max(...kpis.map((k) => k.display_order), 0);

    const { error } = await supabase.from("kpi_definitions").insert({
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

    const values = value
      .trim()
      .split(/[\t\s]+/)
      .map((v) => v.replace(/[,$]/g, ""));
    const parsed: { period: string; value: number }[] = [];

    // Start from pasteYear and pasteMonth, iterate through consecutive months
    let currentYear = pasteYear;
    let currentMonth = parseInt(pasteMonth);

    values.forEach((val) => {
      const numValue = parseFloat(val);
      if (!isNaN(numValue)) {
        const periodIdentifier = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;
        parsed.push({
          period: periodIdentifier,
          value: numValue,
        });
      }

      // Move to next month
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    });

    setParsedPasteData(parsed);
  };

  const handlePasteSave = async () => {
    if (!pasteKpi || parsedPasteData.length === 0) {
      toast({
        title: "No data to save",
        description: "Please select a KPI and paste valid data",
        variant: "destructive",
      });
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      for (const entry of parsedPasteData) {
        const kpi = kpis.find((k) => k.id === pasteKpi);
        if (!kpi) continue;

        const target = kpiTargets[pasteKpi] || kpi.target_value;
        const variance =
          kpi.metric_type === "percentage" ? entry.value - target : ((entry.value - target) / target) * 100;

        let status: string;
        if (kpi.target_direction === "above") {
          status = variance >= 0 ? "green" : variance >= -10 ? "yellow" : "red";
        } else {
          status = variance <= 0 ? "green" : variance <= 10 ? "yellow" : "red";
        }

        const { error } = await supabase.from("scorecard_entries").upsert(
          {
            kpi_id: pasteKpi,
            [isMonthlyTrendMode || isQuarterTrendMode || viewMode === "monthly" ? "month" : "week_start_date"]:
              entry.period,
            entry_type: isMonthlyTrendMode || isQuarterTrendMode ? "monthly" : viewMode,
            actual_value: entry.value,
            variance: variance,
            status: status,
            created_by: user.id,
          },
          {
            onConflict:
              isMonthlyTrendMode || isQuarterTrendMode || viewMode === "monthly"
                ? "kpi_id,month"
                : "kpi_id,week_start_date",
          },
        );

        if (error) throw error;
      }

      toast({
        title: "Data saved",
        description: `Successfully saved ${parsedPasteData.length} entries`,
      });

      await loadScorecardData();
      setPasteDialogOpen(false);
      setPasteData("");
      setPasteKpi("");
      setParsedPasteData([]);
      setPasteMonth("01");
      setPasteOwnerFilter("all");
    } catch (error: any) {
      console.error("Error saving pasted data:", error);
      toast({
        title: "Error saving data",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Handler for month-specific file drop in Monthly Trend view
  const handleMonthFileDrop = useCallback(
    (result: CSRParseResult, fileName: string, monthIdentifier: string, file: File) => {
      result.month = monthIdentifier;
      setDroppedParseResult(result);
      setDroppedFileName(fileName);
      setDroppedFile(file);
      setImportMonth(monthIdentifier);
      setImportWeekStartDate(null); // Clear weekly import state
      setImportPreviewOpen(true);

      toast({
        title: "File parsed successfully",
        description: `Found ${result.advisors.length} advisors for ${monthIdentifier}`,
      });
    },
    [toast],
  );

  // Handler for week-specific file drop in Weekly view
  const handleWeekFileDrop = useCallback(
    (result: CSRParseResult, fileName: string, weekStartDate: string, file: File) => {
      setDroppedParseResult(result);
      setDroppedFileName(fileName);
      setDroppedFile(file);
      setImportMonth(""); // Clear monthly import state
      setImportWeekStartDate(weekStartDate);
      setImportPreviewOpen(true);

      toast({
        title: "File parsed successfully",
        description: `Found ${result.advisors.length} advisors for week of ${weekStartDate}`,
      });
    },
    [toast],
  );

  // Handler for re-importing a previously imported file with updated KPI mappings
  const handleReimport = useCallback(
    async (filePath: string, fileName: string, monthIdentifier: string) => {
      try {
        toast({
          title: "Downloading file...",
          description: "Fetching the original report for re-import",
        });

        // Download the file from storage
        const { data, error } = await supabase.storage.from("scorecard-imports").download(filePath);

        if (error || !data) {
          throw new Error(error?.message || "Failed to download file");
        }

        // Convert blob to File
        const file = new File([data], fileName, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        // Parse the file
        const result = await parseCSRProductivityReport(file);
        result.month = monthIdentifier;

        // Open the import preview dialog
        setDroppedParseResult(result);
        setDroppedFileName(fileName);
        setDroppedFile(file);
        setImportMonth(monthIdentifier);
        setImportWeekStartDate(null); // Clear weekly import state
        setImportPreviewOpen(true);

        toast({
          title: "Ready to re-import",
          description: `Found ${result.advisors.length} advisors. Review and confirm to apply new KPI mappings.`,
        });
      } catch (error: any) {
        toast({
          title: "Re-import failed",
          description: error.message || "Failed to re-import file",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  // Handler for re-importing a previously imported weekly file
  const handleWeekReimport = useCallback(
    async (filePath: string, fileName: string, weekStartDate: string) => {
      try {
        toast({
          title: "Downloading file...",
          description: "Fetching the original report for re-import",
        });

        // Download the file from storage
        const { data, error } = await supabase.storage.from("scorecard-imports").download(filePath);

        if (error || !data) {
          throw new Error(error?.message || "Failed to download file");
        }

        // Convert blob to File
        const file = new File([data], fileName, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        // Parse the file
        const result = await parseCSRProductivityReport(file);

        // Open the import preview dialog
        setDroppedParseResult(result);
        setDroppedFileName(fileName);
        setDroppedFile(file);
        setImportMonth(""); // Clear monthly import state
        setImportWeekStartDate(weekStartDate);
        setImportPreviewOpen(true);

        toast({
          title: "Ready to re-import",
          description: `Found ${result.advisors.length} advisors. Review and confirm to apply new KPI mappings.`,
        });
      } catch (error: any) {
        toast({
          title: "Re-import failed",
          description: error.message || "Failed to re-import file",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

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

    kpis.forEach((kpi) => {
      const ownerId = kpi.assigned_to || "unassigned";
      if (!ownerGroups[ownerId]) {
        ownerGroups[ownerId] = [];
        ownerOrder.push(ownerId);
      }
      ownerGroups[ownerId].push(kpi);
    });

    // Find indices
    const draggedIndex = ownerOrder.indexOf(draggedOwnerId);
    const targetIndex = ownerOrder.indexOf(targetOwnerId || "unassigned");

    // Reorder owner groups
    const newOwnerOrder = [...ownerOrder];
    const [removed] = newOwnerOrder.splice(draggedIndex, 1);
    newOwnerOrder.splice(targetIndex, 0, removed);

    // Flatten back to KPI array with new display_order
    let newDisplayOrder = 0;
    const updates: { id: string; display_order: number }[] = [];

    newOwnerOrder.forEach((ownerId) => {
      ownerGroups[ownerId].forEach((kpi) => {
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

  const handleClearPeriodData = useCallback(async () => {
    if (!clearPeriod) return;
    setClearingPeriod(true);
    try {
      const kpiIds = kpis.map((k) => k.id);
      if (kpiIds.length === 0) {
        setClearPeriod(null);
        setClearingPeriod(false);
        return;
      }

      let deleteQuery;
      if (clearPeriod.type === "month") {
        deleteQuery = supabase
          .from("scorecard_entries")
          .delete()
          .in("kpi_id", kpiIds)
          .eq("entry_type", "monthly")
          .eq("month", clearPeriod.identifier)
          .select("id");
      } else {
        deleteQuery = supabase
          .from("scorecard_entries")
          .delete()
          .in("kpi_id", kpiIds)
          .eq("entry_type", "weekly")
          .eq("week_start_date", clearPeriod.identifier)
          .select("id");
      }

      const { data: deletedRows, error } = await deleteQuery;
      if (error) {
        console.error("[ClearPeriod] Delete error:", error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (!deletedRows || deletedRows.length === 0) {
        console.warn("[ClearPeriod] No rows were deleted. KPI IDs:", kpiIds, "Period:", clearPeriod);
        toast({ title: "No data cleared", description: "No entries were found for this period, or you don't have permission to delete them.", variant: "destructive" });
      } else {
        console.log("[ClearPeriod] Deleted", deletedRows.length, "rows for", clearPeriod.label);
        // Remove cleared entries from local state (entries, localValues, precedingQuartersData)
        const matchesKey = (key: string) => {
          if (clearPeriod.type === "month") return key.includes(`-month-${clearPeriod.identifier}`);
          return key.includes(`-${clearPeriod.identifier}`);
        };

        setEntries((prev) => {
          const newEntries = { ...prev };
          Object.keys(newEntries).forEach((key) => { if (matchesKey(key)) delete newEntries[key]; });
          return newEntries;
        });

        setLocalValues((prev) => {
          const newVals = { ...prev };
          Object.keys(newVals).forEach((key) => { if (matchesKey(key)) delete newVals[key]; });
          return newVals;
        });

        if (clearPeriod.type === "month") {
          const [year, monthNum] = clearPeriod.identifier.split("-");
          const mNum = parseInt(monthNum, 10);
          const pqSuffix = `-M${mNum}-${year}`;
          setPrecedingQuartersData((prev) => {
            const newPq = { ...prev };
            Object.keys(newPq).forEach((key) => { if (key.endsWith(pqSuffix)) delete newPq[key]; });
            return newPq;
          });
        }

        toast({ title: "Cleared", description: `${deletedRows.length} entries for ${clearPeriod.label} have been removed.` });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to clear data", variant: "destructive" });
    } finally {
      setClearPeriod(null);
      setClearingPeriod(false);
    }
  }, [clearPeriod, kpis, toast]);

  const canManageKPIs = userRole === "super_admin" || userRole === "store_gm" || userRole === "department_manager";

  const handleDeleteKPI = async (id: string) => {
    const { error } = await supabase.from("kpi_definitions").delete().eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "KPI deleted successfully" });
    setDeleteKpiId(null);
    onKPIsChange();
  };

  // Get unique KPI names for filter
  const uniqueKpiNames = Array.from(new Set(kpis.map((k) => k.name))).sort();

  // Get unique roles for filter
  const uniqueRoles = Array.from(
    new Set(kpis.map((k) => (k.assigned_to ? profiles[k.assigned_to]?.role : null)).filter(Boolean)),
  ).sort();

  // Apply filters to KPIs
  const filteredKpis = kpis.filter((kpi) => {
    // Filter by KPI name
    if (selectedKpiFilter !== "all" && kpi.name !== selectedKpiFilter) {
      return false;
    }

    // Filter by role
    if (selectedRoleFilter !== "all") {
      const assignedProfile = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
      if (!assignedProfile || assignedProfile.role !== selectedRoleFilter) {
        return false;
      }
    }

    return true;
  });

  // Helper function to create issue from scorecard cell
  const handleCreateIssueFromCell = (
    kpi: KPI,
    actualValue: number | null | undefined,
    targetValue: number | null | undefined,
    periodLabel: string,
    periodType: "week" | "month",
    periodIdentifier: string,
  ) => {
    const ownerName = kpi.assigned_to ? profiles[kpi.assigned_to]?.full_name || "Unknown" : "Unassigned";
    const formattedActual =
      actualValue !== null && actualValue !== undefined ? formatValue(actualValue, kpi.metric_type, kpi.name) : "N/A";
    const formattedTarget =
      targetValue !== null && targetValue !== undefined ? formatValue(targetValue, kpi.metric_type, kpi.name) : "N/A";

    const title = `${kpi.name} - ${periodLabel}`;
    const description = `**KPI:** ${kpi.name}
**Owner:** ${ownerName}
**Period:** ${periodLabel} (${periodType === "week" ? "Week" : "Month"})
**Year:** ${year}
**Quarter:** Q${quarter}

**Current Value:** ${formattedActual}
**Target:** ${formattedTarget}

---
*Issue created from scorecard*`;

    // Determine severity based on status
    let severity = "medium";
    if (actualValue !== null && actualValue !== undefined && targetValue !== null && targetValue !== undefined) {
      let variance: number;
      if (kpi.metric_type === "percentage") {
        variance = actualValue - targetValue;
      } else if (targetValue !== 0) {
        variance = ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
      } else {
        variance = kpi.target_direction === "below" ? (actualValue > 0 ? -100 : 0) : actualValue > 0 ? 100 : -100;
      }

      const adjustedVariance = kpi.target_direction === "below" ? -variance : variance;

      if (adjustedVariance < -10) {
        severity = "high";
      } else if (adjustedVariance < 0) {
        severity = "medium";
      } else {
        severity = "low";
      }
    }

    setIssueContext({
      title,
      description,
      severity,
      sourceKpiId: kpi.id,
      sourcePeriod: periodIdentifier,
    });
    setIssueDialogOpen(true);
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
        <div className="flex items-center gap-4 flex-wrap">
          <ScorecardPeriodDropZone
            disabled={!departmentStoreId}
            onFileDrop={async (file) => {
              try {
                const result = await parseCSRProductivityReport(file);
                // Calculate appropriate month based on current period
                const now = new Date();
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
                result.month = monthStr;

                setDroppedParseResult(result);
                setDroppedFileName(file.name);
                setDroppedFile(file);
                setImportMonth(monthStr);
                setImportPreviewOpen(true);

                toast({
                  title: "File parsed successfully",
                  description: `Found ${result.advisors.length} advisors`,
                });
              } catch (error: any) {
                toast({
                  title: "Parse error",
                  description: error.message || "Failed to parse file",
                  variant: "destructive",
                });
              }
            }}
          >
            <div className="flex items-center gap-2">
              <Select value={year.toString()} onValueChange={(v) => onYearChange(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value={(new Date().getFullYear() - 1).toString()}>
                    {new Date().getFullYear() - 1}
                  </SelectItem>
                  <SelectItem value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</SelectItem>
                  <SelectItem value={(new Date().getFullYear() + 1).toString()}>
                    {new Date().getFullYear() + 1}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={quarter.toString()} onValueChange={(v) => onQuarterChange(parseInt(v))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1</SelectItem>
                  <SelectItem value="2">Q2</SelectItem>
                  <SelectItem value="3">Q3</SelectItem>
                  <SelectItem value="4">Q4</SelectItem>
                  <SelectItem value="0">Quarter Trend</SelectItem>
                  <SelectItem value="-1">Monthly Trend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </ScorecardPeriodDropZone>

          {/* View Mode Toggle - Prominent - Hide in Quarter Trend and Monthly Trend */}
          {!isQuarterTrendMode && !isMonthlyTrendMode && (
            <div className="flex items-center border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === "weekly" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("weekly");
                  onViewModeChange?.("weekly");
                }}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Weekly
              </Button>
              <Button
                variant={viewMode === "monthly" ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setViewMode("monthly");
                  onViewModeChange?.("monthly");
                }}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Monthly
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={selectedKpiFilter} onValueChange={setSelectedKpiFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filter by KPI" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All KPIs</SelectItem>
                {uniqueKpiNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRoleFilter} onValueChange={setSelectedRoleFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">All Roles</SelectItem>
                {uniqueRoles.map((role) => (
                  <SelectItem key={role} value={role as string}>
                    {role === "department_manager"
                      ? "Department Manager"
                      : role === "service_advisor"
                        ? "Service Advisor"
                        : role === "sales_advisor"
                          ? "Sales Advisor"
                          : role === "parts_advisor"
                            ? "Parts Advisor"
                            : role === "technician"
                              ? "Technician"
                              : role === "store_gm"
                                ? "Store GM"
                                : role === "super_admin"
                                  ? "Super Admin"
                                  : role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                          for {storeUsers.find((u) => u.id === selectedUserId)?.full_name}
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
                              {dynamicPresetKpis.map((preset) => (
                                <SelectItem key={preset.id} value={preset.name}>
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
                viewMode={viewMode}
                onTargetsChange={async () => {
                  await recalculateAllEntryStatuses();
                  // Fetch fresh targets to pass to loadScorecardData
                  const { data: freshTargetsData } = await supabase
                    .from("kpi_targets")
                    .select("*")
                    .in(
                      "kpi_id",
                      kpis.map((k) => k.id),
                    )
                    .eq("quarter", quarter)
                    .eq("year", year)
                    .eq("entry_type", viewMode);

                  const freshTargetsMap: { [key: string]: number } = {};
                  freshTargetsData?.forEach((target) => {
                    freshTargetsMap[target.kpi_id] = target.target_value || 0;
                  });

                  await loadScorecardData(freshTargetsMap);
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
                    disabled={saving["bulk-recalc"]}
                    className="gap-2"
                  >
                    <RefreshCw className={cn("h-4 w-4", saving["bulk-recalc"] && "animate-spin")} />
                    {saving["bulk-recalc"] ? "Recalculating..." : "Recalculate All"}
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Phase 4: Quarter Tab Pills - only in weekly view */}
      {viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode && kpis.length > 0 && (
        <div className="flex items-center gap-1 mb-2">
          {[1, 2, 3, 4].map((q) => {
            const qYearStart = YEAR_STARTS[year] || new Date(year, 0, 1);
            const qStart = new Date(qYearStart);
            qStart.setDate(qYearStart.getDate() + (q - 1) * 13 * 7);
            const qEnd = new Date(qStart);
            qEnd.setDate(qStart.getDate() + 13 * 7 - 1);
            const qStartLabel = `${qStart.getMonth() + 1}/${qStart.getDate()}`;
            const qEndLabel = `${qEnd.getMonth() + 1}/${qEnd.getDate()}`;
            return (
              <button
                key={q}
                onClick={() => onQuarterChange(q)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  quarter === q
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/60"
                )}
              >
                <div>Q{q}</div>
                <div className="text-[10px] opacity-70">{qStartLabel}–{qEndLabel}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Phase 3: Quarter Summary Stats Bar */}
      {viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode && kpis.length > 0 && (() => {
        const today = new Date();
        const currentWeekInfo = getQuarterInfo(today);
        const currentWeekNum = (currentWeekInfo.year === year && currentWeekInfo.quarter === quarter) ? currentWeekInfo.weekInQuarter : null;
        const qYearStart = YEAR_STARTS[year] || new Date(year, 0, 1);
        const qStart = new Date(qYearStart);
        qStart.setDate(qYearStart.getDate() + (quarter - 1) * 13 * 7);
        const qEnd = new Date(qStart);
        qEnd.setDate(qStart.getDate() + 13 * 7 - 1);
        const qStartLabel = `${qStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
        const qEndLabel = `${qEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

        // Count weeks with data and total green/yellow/red
        let weeksWithData = 0;
        let totalGreen = 0, totalYellow = 0, totalRed = 0;
        weeks.forEach((week) => {
          const weekDate = week.start.toISOString().split("T")[0];
          let hasData = false;
          filteredKpis.forEach((kpi) => {
            const entry = entries[`${kpi.id}-${weekDate}`];
            if (entry?.actual_value !== null && entry?.actual_value !== undefined) {
              hasData = true;
              if (entry.status === "green") totalGreen++;
              else if (entry.status === "yellow") totalYellow++;
              else if (entry.status === "red") totalRed++;
            }
          });
          if (hasData) weeksWithData++;
        });

        return (
          <div className="flex items-center gap-4 mb-2 px-3 py-2 rounded-lg bg-muted/30 border text-xs">
            <div className="font-bold text-sm">Q{quarter} {year}</div>
            <div className="text-muted-foreground">{qStartLabel} – {qEndLabel} · 13 weeks</div>
            {currentWeekNum && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="font-medium">Week {currentWeekNum}</span>
              </div>
            )}
            <div className="text-muted-foreground">{weeksWithData}/13 weeks entered</div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 font-semibold">{totalGreen}</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100 font-semibold">{totalYellow}</span>
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 font-semibold">{totalRed}</span>
            </div>
          </div>
        );
      })()}

      {kpis.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-muted-foreground mb-4">No KPIs defined for this department yet.</p>
          <p className="text-sm text-muted-foreground">Click "Manage KPIs" to add your first metric.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            {/* Loading overlay - prevents flash by covering stale content during transitions */}
            {loading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-[1px] z-30 flex items-center justify-center rounded-lg">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            <div ref={scrollContainerRef} className="overflow-x-auto border rounded-lg" onScroll={handleMainScroll}>
              <Table>
                <TableHeader>
                  <TableRow ref={headerRowRef} className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted z-20 w-[170px] min-w-[170px] max-w-[170px] font-bold py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                      KPI
                    </TableHead>
                    {viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode && (
                      <>
                        {/* Current quarter target column - sticky horizontally */}
                        <TableHead
                          className="text-center font-bold min-w-[80px] py-[7.2px] bg-primary border-x-2 border-primary/30 sticky top-0 z-20 text-primary-foreground"
                          style={{
                            position: "sticky",
                             left: 170,
                            zIndex: 19,
                            boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Target</div>
                            <div className="text-xs font-normal opacity-70">{year}</div>
                          </div>
                        </TableHead>
                      </>
                    )}
                    {isMonthlyTrendMode ? (
                      <>
                        <TableHead className="text-center min-w-[80px] max-w-[80px] font-bold py-[7.2px] bg-muted sticky top-0 left-[170px] z-20 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                          Trend
                        </TableHead>
                        {/* Latest quarter target column only */}
                        {(() => {
                          const latestQuarter = Array.from(
                            new Set(
                              monthlyTrendPeriods
                                .filter((m) => m.type === "month")
                                .map((m) => `Q${Math.floor(m.month / 3) + 1}-${m.year}`),
                            ),
                          ).sort((a, b) => {
                            const [qA, yA] = a.replace("Q", "").split("-").map(Number);
                            const [qB, yB] = b.replace("Q", "").split("-").map(Number);
                            if (yB !== yA) return yB - yA;
                            return qB - qA;
                          })[0];
                          if (!latestQuarter) return null;
                          const [q, y] = latestQuarter.replace("Q", "").split("-");
                          return (
                            <TableHead
                              key={`target-${latestQuarter}`}
                              className="text-center min-w-[80px] max-w-[80px] font-bold py-[7.2px] bg-primary text-primary-foreground border-x border-primary/30 sticky top-0 left-[250px] z-20 shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                            >
                              <div className="flex flex-col items-center">
                                <div className="text-xs">Q{q} Target</div>
                                <div className="text-xs font-normal opacity-70">{y}</div>
                              </div>
                            </TableHead>
                          );
                        })()}
                        {monthlyTrendPeriods.map((period) => (
                          <TableHead
                            key={period.identifier}
                            className={cn(
                              "text-center min-w-[90px] max-w-[90px] font-bold py-[7.2px] sticky top-0 z-10 p-0",
                              period.type === "year-avg" && "bg-primary/10 border-l-2 border-primary/30",
                              period.type === "year-total" && "bg-primary/10 border-r-2 border-primary/30",
                              period.type === "month" && "bg-muted/50",
                            )}
                          >
                            {period.type === "month" ? (
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <div>
                                    <ScorecardMonthDropZone
                                      ref={(el) => { monthDropZoneRefs.current[period.identifier] = el; }}
                                      monthIdentifier={period.identifier}
                                      onFileDrop={handleMonthFileDrop}
                                      onReimport={handleReimport}
                                      className="w-full h-full py-[7.2px]"
                                      importLog={importLogs[period.identifier]}
                                    >
                                      <div className="flex flex-col items-center">
                                        <div>{period.label.split(" ")[0]}</div>
                                        <div className="text-xs font-normal text-muted-foreground">{period.year}</div>
                                      </div>
                                    </ScorecardMonthDropZone>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="bg-background z-50">
                                  <ContextMenuItem
                                    onClick={() => monthDropZoneRefs.current[period.identifier]?.triggerFileSelect()}
                                  >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import Scorecard File
                                  </ContextMenuItem>
                                  {canManageKPIs && (
                                    <ContextMenuItem
                                      onClick={() => setClearPeriod({ identifier: period.identifier, label: `${period.label.split(" ")[0]} ${period.year}`, type: "month" })}
                                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Clear Month Data
                                    </ContextMenuItem>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                            ) : (
                              <div className="flex flex-col items-center py-[7.2px]">
                                <div>{period.type === "year-avg" ? "Avg" : "Total"}</div>
                                <div className="text-xs font-normal text-muted-foreground">
                                  {period.isYTD ? `${period.summaryYear} YTD` : period.summaryYear}
                                </div>
                              </div>
                            )}
                          </TableHead>
                        ))}
                      </>
                    ) : isQuarterTrendMode ? (
                      quarterTrendPeriods.map((qtr) => (
                        <TableHead
                          key={qtr.label}
                          className="text-center min-w-[90px] max-w-[90px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10"
                        >
                          {qtr.label}
                        </TableHead>
                      ))
                    ) : viewMode === "weekly" ? (
                      <>
                      {weeks.map((week) => {
                        const weekDate = week.start.toISOString().split("T")[0];
                        const isCurrentWeek = weekDate === currentWeekDate;
                        const isPreviousWeek = weekDate === previousWeekDate;
                        const isCurrentOrPast = week.start <= today;

                        // Calculate status counts for this week
                        const statusCounts = { green: 0, yellow: 0, red: 0, gray: 0 };
                        if (isCurrentOrPast) {
                          filteredKpis.forEach((kpi) => {
                            const key = `${kpi.id}-${weekDate}`;
                            const entry = entries[key];

                            if (entry?.status === "green") statusCounts.green++;
                            else if (entry?.status === "yellow") statusCounts.yellow++;
                            else if (entry?.status === "red") statusCounts.red++;
                            else statusCounts.gray++;
                          });
                        }

                        const weekIndex = weeks.indexOf(week) + 1;
                        return (
                          <TableHead
                            key={week.label}
                            className={cn(
                              "text-center min-w-[90px] max-w-[90px] text-xs py-0",
                              isCurrentWeek && "bg-primary/20 font-bold border-l-2 border-r-2 border-primary",
                              isPreviousWeek && "bg-accent/30 font-bold border-l-2 border-r-2 border-accent",
                            )}
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div>
                                   <ScorecardWeekDropZone
                                    weekStartDate={weekDate}
                                    weekLabel={week.label}
                                    onFileDrop={handleWeekFileDrop}
                                    onReimport={handleWeekReimport}
                                    className="w-full h-full py-0.5"
                                    importLog={weekImportLogs[weekDate]}
                                  >
                                    <div className="text-xs font-bold">WK {weekIndex}</div>
                                    <div className="text-[10px] text-muted-foreground">{week.label}</div>
                                    {isCurrentWeek && <div className="text-[10px] text-primary font-semibold">Current</div>}
                                    {isPreviousWeek && (
                                      <div className="text-[10px] text-accent-foreground font-semibold">Review</div>
                                    )}
                                  </ScorecardWeekDropZone>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="bg-background z-50">
                                {canManageKPIs && (
                                  <ContextMenuItem
                                    onClick={() => setClearPeriod({ identifier: weekDate, label: week.label, type: "week" })}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Clear Week Data
                                  </ContextMenuItem>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          </TableHead>
                        );
                      })}
                      {/* Phase 5: Q TOTAL header */}
                      <TableHead className="text-center min-w-[80px] max-w-[80px] text-xs py-1 bg-muted/70 border-l-2 border-border font-bold sticky top-0 z-10">
                        <div className="flex flex-col items-center">
                          <div className="text-xs font-bold">Q{quarter}</div>
                          <div className="text-[10px] text-muted-foreground">TOTAL</div>
                        </div>
                      </TableHead>
                    </>
                    ) : (
                      <>
                        {/* Previous Year Quarter Target */}
                        <TableHead className="text-center font-bold min-w-[80px] max-w-[80px] py-[7.2px] bg-muted/70 border-x-2 border-muted-foreground/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div className="text-xs">Q{quarter} Target</div>
                            <div className="text-xs font-normal text-muted-foreground">{year - 1}</div>
                          </div>
                        </TableHead>
                        {previousYearMonths.map((month) => (
                          <TableHead
                            key={month.identifier}
                            className="text-center min-w-[90px] max-w-[90px] font-bold py-0 bg-muted/30 sticky top-0 z-10"
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div>
                                  <ScorecardMonthDropZone
                                    ref={(el) => { monthDropZoneRefs.current[month.identifier] = el; }}
                                    monthIdentifier={month.identifier}
                                    onFileDrop={handleMonthFileDrop}
                                    onReimport={handleReimport}
                                    className="w-full h-full py-[7.2px]"
                                    importLog={importLogs[month.identifier]}
                                  >
                                    <div className="flex flex-col items-center">
                                      <div>{month.label}</div>
                                      <div className="text-xs font-normal text-muted-foreground">{month.year}</div>
                                    </div>
                                  </ScorecardMonthDropZone>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="bg-background z-50">
                                <ContextMenuItem
                                  onClick={() => monthDropZoneRefs.current[month.identifier]?.triggerFileSelect()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Import Scorecard File
                                </ContextMenuItem>
                                {canManageKPIs && (
                                  <ContextMenuItem
                                    onClick={() => setClearPeriod({ identifier: month.identifier, label: `${month.label} ${month.year}`, type: "month" })}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Clear Month Data
                                  </ContextMenuItem>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          </TableHead>
                        ))}
                        {/* Previous Year Quarter Avg */}
                        <TableHead className="text-center font-bold min-w-[80px] max-w-[80px] py-[7.2px] bg-muted/50 border-x-2 border-muted-foreground/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Avg</div>
                            <div className="text-xs font-normal text-muted-foreground">{year - 1}</div>
                          </div>
                        </TableHead>
                        {/* Current Quarter Target */}
                        <TableHead className="text-center font-bold min-w-[80px] max-w-[80px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Target</div>
                            <div className="text-xs font-normal text-muted-foreground">{year}</div>
                          </div>
                        </TableHead>
                        {months.map((month) => (
                          <TableHead
                            key={month.identifier}
                            className="text-center min-w-[90px] max-w-[90px] font-bold py-0 bg-muted/50 sticky top-0 z-10"
                          >
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div>
                                  <ScorecardMonthDropZone
                                    ref={(el) => { monthDropZoneRefs.current[month.identifier] = el; }}
                                    monthIdentifier={month.identifier}
                                    onFileDrop={handleMonthFileDrop}
                                    onReimport={handleReimport}
                                    className="w-full h-full py-[7.2px]"
                                    importLog={importLogs[month.identifier]}
                                  >
                                    <div className="flex flex-col items-center">
                                      <div>{month.label}</div>
                                      <div className="text-xs font-normal text-muted-foreground">{month.year}</div>
                                    </div>
                                  </ScorecardMonthDropZone>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="bg-background z-50">
                                <ContextMenuItem
                                  onClick={() => monthDropZoneRefs.current[month.identifier]?.triggerFileSelect()}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Import Scorecard File
                                </ContextMenuItem>
                                {canManageKPIs && (
                                  <ContextMenuItem
                                    onClick={() => setClearPeriod({ identifier: month.identifier, label: `${month.label} ${month.year}`, type: "month" })}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Clear Month Data
                                  </ContextMenuItem>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold min-w-[80px] max-w-[80px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Avg</div>
                            <div className="text-xs font-normal text-muted-foreground">{year}</div>
                          </div>
                        </TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...filteredKpis]
                    .sort((a, b) => {
                      // Group KPIs by owner, with department managers at the bottom
                      // First, get the role priority (department managers go last)
                      const getRolePriority = (ownerId: string | null) => {
                        if (!ownerId) return 999; // Unassigned at the very end
                        const ownerRole = profiles[ownerId]?.role;
                        if (ownerRole === "department_manager" || ownerRole === "fixed_ops_manager") {
                          return 100; // Department managers near the end
                        }
                        return 0; // All other roles (technicians, service advisors, etc.) first
                      };

                      // Get the minimum display_order for each owner to determine owner group order
                      const getOwnerMinOrder = (ownerId: string | null) => {
                        const ownerKpis = filteredKpis.filter((k) => k.assigned_to === ownerId);
                        return Math.min(...ownerKpis.map((k) => k.display_order));
                      };

                      const aOwnerId = a.assigned_to || "unassigned";
                      const bOwnerId = b.assigned_to || "unassigned";

                      // If same owner, sort by display_order within the group
                      if (aOwnerId === bOwnerId) {
                        return a.display_order - b.display_order;
                      }

                      // Different owners: first sort by role priority, then by display_order
                      const aRolePriority = getRolePriority(a.assigned_to);
                      const bRolePriority = getRolePriority(b.assigned_to);

                      if (aRolePriority !== bRolePriority) {
                        return aRolePriority - bRolePriority;
                      }

                      // Same role priority: sort by the minimum display_order of the owner group
                      return getOwnerMinOrder(a.assigned_to) - getOwnerMinOrder(b.assigned_to);
                    })
                    .map((kpi, index, sortedKpis) => {
                      const showOwnerHeader = index === 0 || kpi.assigned_to !== sortedKpis[index - 1]?.assigned_to;
                      const owner = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
                      const ownerName = owner?.full_name || "Unassigned";
                      const ownerInitials =
                        owner?.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase() || "U";

                      return (
                        <React.Fragment key={kpi.id}>
                          {showOwnerHeader && (
                            <TableRow
                              key={`owner-${kpi.assigned_to || "unassigned"}`}
                              className={cn(
                                "bg-muted/50 transition-colors",
                                dragOverOwnerId === (kpi.assigned_to || "unassigned") && "bg-primary/20",
                                canManageKPIs && "cursor-grab active:cursor-grabbing",
                              )}
                              draggable={canManageKPIs}
                              onDragStart={() => handleOwnerDragStart(kpi.assigned_to || "unassigned")}
                              onDragOver={(e) => handleOwnerDragOver(e, kpi.assigned_to || "unassigned")}
                              onDragEnd={handleOwnerDragEnd}
                              onDrop={(e) => handleOwnerDrop(e, kpi.assigned_to || "unassigned")}
                            >
                              <TableCell className="sticky left-0 z-10 bg-muted py-0.5 w-[170px] min-w-[170px] max-w-[170px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                                <div className="flex items-center gap-2">
                                  {canManageKPIs && <GripVertical className="h-4 w-4 text-muted-foreground" />}
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
                              {/* For weekly view, render sticky target cells in owner header */}
                              {viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode && (
                                <>
                                  <TableCell
                                    className="bg-primary py-1 min-w-[80px] border-x-2 border-primary/30"
                                    style={{
                                      position: "sticky",
                                       left: 170,
                                      zIndex: 9,
                                      boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                                    }}
                                  />
                                  {weeks.map((week) => (
                                    <TableCell
                                      key={`owner-curr-week-${week.label}`}
                                      className="bg-muted/50 py-0.5 min-w-[90px]"
                                    />
                                  ))}
                                </>
                              )}
                              {/* For non-weekly views, use colspan as before */}
                              {(isMonthlyTrendMode || isQuarterTrendMode || viewMode !== "weekly") && (
                                <TableCell
                                  colSpan={
                                    isMonthlyTrendMode
                                      ? 2 + monthlyTrendPeriods.length
                                      : isQuarterTrendMode
                                        ? quarterTrendPeriods.length
                                        : 1 + previousYearMonths.length + 1 + 1 + months.length + 1
                                  }
                                  className="bg-muted/50 py-1"
                                />
                              )}
                            </TableRow>
                          )}
                          <TableRow className="hover:bg-muted/30">
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <TableCell className="sticky left-0 bg-background z-10 w-[170px] min-w-[170px] max-w-[170px] font-medium pl-8 py-0.5 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)] cursor-context-menu text-xs">
                                  {kpi.name}
                                </TableCell>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="bg-background z-50">
                                {canManageKPIs && (
                                  <ContextMenuItem
                                    onClick={() => setDeleteKpiId(kpi.id)}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete KPI
                                  </ContextMenuItem>
                                )}
                              </ContextMenuContent>
                            </ContextMenu>
                            {viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode && (
                              <>
                                {/* Current quarter target cell - sticky horizontally */}
                                <TableCell
                                  className="text-center py-0.5 min-w-[80px] bg-primary border-x-2 border-primary/30 font-medium text-primary-foreground"
                                  style={{
                                    position: "sticky",
                                    left: 170,
                                    zIndex: 9,
                                    boxShadow: "2px 0 4px rgba(0,0,0,0.1)",
                                  }}
                                >
                                  {canEditTargets() && editingTarget === kpi.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Input
                                        type="number"
                                        step="any"
                                        value={targetEditValue}
                                        onChange={(e) => setTargetEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleTargetSave(kpi.id);
                                          if (e.key === "Escape") setEditingTarget(null);
                                        }}
                                        className="w-20 h-7 text-center text-foreground"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleTargetSave(kpi.id)}
                                        className="h-7 px-2 text-primary-foreground hover:bg-primary-foreground/20"
                                      >
                                        ✓
                                      </Button>
                                    </div>
                                  ) : (
                                    <span
                                      className={cn(canEditTargets() && "cursor-pointer hover:opacity-80")}
                                      onClick={() => canEditTargets() && handleTargetEdit(kpi.id)}
                                    >
                                      {formatTarget(kpiTargets[kpi.id] || kpi.target_value, kpi.metric_type, kpi.name)}
                                    </span>
                                  )}
                                </TableCell>
                              </>
                            )}
                            {isMonthlyTrendMode ? (
                              <>
                                <TableCell className="px-1 py-0.5 min-w-[80px] max-w-[80px] bg-background sticky left-[170px] z-10 border-r shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
                                  <Sparkline
                                    data={monthlyTrendPeriods
                                      .filter((p) => p.type === "month" && p.year === year)
                                      .map((month) => {
                                        const mKey = `${kpi.id}-M${month.month + 1}-${month.year}`;
                                        return precedingQuartersData[mKey];
                                      })}
                                  />
                                </TableCell>
                                {/* Latest quarter target cell - editable */}
                                {(() => {
                                  const latestQuarter = Array.from(
                                    new Set(
                                      monthlyTrendPeriods
                                        .filter((m) => m.type === "month")
                                        .map((m) => `Q${Math.floor(m.month / 3) + 1}-${m.year}`),
                                    ),
                                  ).sort((a, b) => {
                                    const [qA, yA] = a.replace("Q", "").split("-").map(Number);
                                    const [qB, yB] = b.replace("Q", "").split("-").map(Number);
                                    if (yB !== yA) return yB - yA;
                                    return qB - qA;
                                  })[0];
                                  if (!latestQuarter) return null;
                                  const [q, y] = latestQuarter.replace("Q", "").split("-");
                                  const targetQuarter = parseInt(q);
                                  const targetYear = parseInt(y);
                                  const targetKey = `${kpi.id}-Q${q}-${y}`;
                                  const targetValue = trendTargets[targetKey] ?? kpi.target_value;
                                  const isEditing = editingTrendTarget === targetKey;

                                  return (
                                    <TableCell
                                      key={`target-${latestQuarter}`}
                                      className="px-1 py-0.5 text-center min-w-[80px] max-w-[80px] bg-primary text-primary-foreground border-x border-primary/30 sticky left-[250px] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.05)]"
                                    >
                                      {canEditTargets() && isEditing ? (
                                        <div className="flex items-center justify-center gap-1">
                                          <Input
                                            type="number"
                                            step="any"
                                            value={trendTargetEditValue}
                                            onChange={(e) => setTrendTargetEditValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter")
                                                handleTrendTargetSave(kpi.id, targetQuarter, targetYear);
                                              if (e.key === "Escape") setEditingTrendTarget(null);
                                            }}
                                            className="w-16 h-7 text-center text-foreground"
                                            autoFocus
                                          />
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleTrendTargetSave(kpi.id, targetQuarter, targetYear)}
                                            className="h-7 px-1 text-primary-foreground hover:bg-primary/80"
                                          >
                                            ✓
                                          </Button>
                                        </div>
                                      ) : (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <span className={cn(canEditTargets() && "cursor-pointer hover:underline")}>
                                              {targetValue !== null && targetValue !== undefined
                                                ? formatTarget(targetValue, kpi.metric_type, kpi.name)
                                                : "-"}
                                            </span>
                                          </PopoverTrigger>
                                          {canEditTargets() && (
                                            <PopoverContent className="w-auto p-2" align="center">
                                              <div className="flex flex-col gap-2">
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleTrendTargetEdit(kpi.id, targetQuarter, targetYear)
                                                  }
                                                >
                                                  Edit Target
                                                </Button>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() =>
                                                    handleCopyTrendTargetToAllQuarters(
                                                      kpi.id,
                                                      targetQuarter,
                                                      targetYear,
                                                    )
                                                  }
                                                >
                                                  <Copy className="h-3 w-3 mr-1" />
                                                  Copy to All Quarters
                                                </Button>
                                              </div>
                                            </PopoverContent>
                                          )}
                                        </Popover>
                                      )}
                                    </TableCell>
                                  );
                                })()}
                                {monthlyTrendPeriods.map((month, periodIndex) => {
                                  // Skip year summary columns - they remain read-only
                                  if (month.type !== "month") {
                                    const summaryYear = month.summaryYear!;
                                    const isAvg = month.type === "year-avg";

                                    // Collect all monthly values for the summary year
                                    const yearMonthlyValues: number[] = [];
                                    for (let m = 0; m < 12; m++) {
                                      const mKey = `${kpi.id}-M${m + 1}-${summaryYear}`;
                                      // Also check entries with the format kpi_id-month-YYYY-MM
                                      const monthIdentifier = `${summaryYear}-${String(m + 1).padStart(2, "0")}`;
                                      const entryKey = `${kpi.id}-month-${monthIdentifier}`;
                                      const entryVal = entries[entryKey]?.actual_value;
                                      const precedingVal = precedingQuartersData[mKey];
                                      // Prefer entry value, fall back to precedingQuartersData
                                      const val = entryVal ?? precedingVal;
                                      if (val !== null && val !== undefined) {
                                        yearMonthlyValues.push(val);
                                      }
                                    }

                                    let displayValue: number | undefined;
                                    if (yearMonthlyValues.length > 0) {
                                      const total = yearMonthlyValues.reduce((a, b) => a + b, 0);
                                      const average = total / yearMonthlyValues.length;

                                      // For percentage metrics and rate-based metrics,
                                      // the Total should equal the Average since you don't sum these
                                      // Use the aggregation_type from the database
                                      const shouldAverage = kpi.aggregation_type === "average";

                                      displayValue = isAvg || shouldAverage ? average : total;
                                    }

                                    return (
                                      <TableCell
                                        key={month.identifier}
                                        className={cn(
                                          "px-1 py-0.5 text-center min-w-[90px] max-w-[90px] font-medium",
                                          month.type === "year-avg" && "bg-primary/10 border-l-2 border-primary/30",
                                          month.type === "year-total" && "bg-primary/10 border-r-2 border-primary/30",
                                        )}
                                      >
                                        {displayValue !== null && displayValue !== undefined
                                          ? formatQuarterAverage(displayValue, kpi.metric_type, kpi.name)
                                          : "-"}
                                      </TableCell>
                                    );
                                  }

                                  // Editable month cells
                                  const monthIdentifier = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
                                  const key = `${kpi.id}-month-${monthIdentifier}`;
                                  const entry = entries[key];
                                  const mValue =
                                    entry?.actual_value ??
                                    precedingQuartersData[`${kpi.id}-M${month.month + 1}-${month.year}`];
                                  const displayValue =
                                    localValues[key] !== undefined
                                      ? localValues[key]
                                      : formatValue(mValue || null, kpi.metric_type, kpi.name);

                                  // Calculate quarter from month (0-indexed month: 0-2 = Q1, 3-5 = Q2, etc.)
                                  const monthQuarter = Math.floor(month.month / 3) + 1;
                                  const targetKey = `${kpi.id}-Q${monthQuarter}-${month.year}`;
                                  // Use quarter-specific target, fall back to default kpi target
                                  const rawTarget = trendTargets[targetKey] ?? kpi.target_value;
                                  const targetValue =
                                    rawTarget !== null && rawTarget !== undefined && rawTarget !== 0 ? rawTarget : null;

                                  let trendStatus: "success" | "warning" | "destructive" | null = null;

                                  if (mValue !== null && mValue !== undefined && targetValue !== null) {
                                    let variance: number;
                                    if (kpi.metric_type === "percentage") {
                                      variance = mValue - targetValue;
                                    } else {
                                      variance = ((mValue - targetValue) / Math.abs(targetValue)) * 100;
                                    }

                                    const adjustedVariance = kpi.target_direction === "below" ? -variance : variance;

                                    if (adjustedVariance >= 0) {
                                      trendStatus = "success";
                                    } else if (adjustedVariance >= -10) {
                                      trendStatus = "warning";
                                    } else {
                                      trendStatus = "destructive";
                                    }
                                  }

                                  return (
                                    <ContextMenu key={month.identifier}>
                                      <ContextMenuTrigger asChild>
                                        <TableCell
                                          className={cn(
                             "px-1 py-0.5 relative min-w-[90px] max-w-[90px]",
                            trendStatus === "success" && "bg-success/10",
                            trendStatus === "warning" && "bg-warning/10",
                            trendStatus === "destructive" && "bg-destructive/10",
                                            !trendStatus && "text-muted-foreground",
                                          )}
                                        >
                                          <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                                            {(isCalculatedKPI(kpi.name) || focusedInput !== key) &&
                                            mValue !== null &&
                                            mValue !== undefined ? (
                                              <div
                                                data-display-value
                                                className={cn(
                                                  "h-full w-full flex items-center justify-center cursor-text",
                                                  trendStatus === "success" && "text-success font-medium",
                                                  trendStatus === "warning" && "text-warning font-medium",
                                                  trendStatus === "destructive" && "text-destructive font-medium",
                                                  isCalculatedKPI(kpi.name) && "cursor-default",
                                                )}
                                                onClick={(e) => {
                                                  if (!isCalculatedKPI(kpi.name)) {
                                                    const input = e.currentTarget
                                                      .nextElementSibling as HTMLInputElement;
                                                    input?.focus();
                                                    input?.select();
                                                  }
                                                }}
                                              >
                                                {formatQuarterAverage(mValue, kpi.metric_type, kpi.name)}
                                              </div>
                                            ) : !isCalculatedKPI(kpi.name) && focusedInput !== key ? (
                                              <div
                                                data-display-value
                                                className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                                                onClick={(e) => {
                                                  const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                                  input?.focus();
                                                }}
                                              >
                                                {kpi.metric_type === "dollar"
                                                  ? "$"
                                                  : kpi.metric_type === "percentage"
                                                    ? "%"
                                                    : "-"}
                                              </div>
                                            ) : null}
                                            <Input
                                              type="number"
                                              step="any"
                                              value={displayValue}
                                              onChange={(e) =>
                                                handleValueChange(
                                                  kpi.id,
                                                  "",
                                                  e.target.value,
                                                  targetValue,
                                                  kpi.metric_type,
                                                  kpi.target_direction,
                                                  true,
                                                  monthIdentifier,
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === "Tab") {
                                                  e.preventDefault();
                                                  saveValue(
                                                    kpi.id,
                                                    "",
                                                    localValues[key] ?? displayValue,
                                                    targetValue,
                                                    kpi.metric_type,
                                                    kpi.target_direction,
                                                    true,
                                                    monthIdentifier,
                                                  );
                                                  const currentKpiIndex = index;
                                                  if (currentKpiIndex < sortedKpis.length - 1) {
                                                    const nextInput = document.querySelector(
                                                      `input[data-kpi-index="${currentKpiIndex + 1}"][data-trend-period-index="${periodIndex}"]`,
                                                    ) as HTMLInputElement;
                                                    nextInput?.focus();
                                                    nextInput?.select();
                                                  }
                                                }
                                              }}
                                              onFocus={() => setFocusedInput(key)}
                                              onBlur={() => {
                                                const valueToSave = localValues[key];
                                                if (valueToSave !== undefined) {
                                                  saveValue(
                                                    kpi.id,
                                                    "",
                                                    valueToSave,
                                                    targetValue,
                                                    kpi.metric_type,
                                                    kpi.target_direction,
                                                    true,
                                                    monthIdentifier,
                                                  );
                                                }
                                                setTimeout(() => {
                                                  setFocusedInput(null);
                                                  setLocalValues((prev) => {
                                                    const newLocalValues = { ...prev };
                                                    delete newLocalValues[key];
                                                    return newLocalValues;
                                                  });
                                                }, 100);
                                              }}
                                              data-kpi-index={index}
                                              data-trend-period-index={periodIndex}
                                              className={cn(
                                                "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                                                trendStatus === "success" && "text-success font-medium",
                                                trendStatus === "warning" && "text-warning font-medium",
                                                trendStatus === "destructive" && "text-destructive font-medium",
                                                isCalculatedKPI(kpi.name) && "hidden",
                                              )}
                                              placeholder="-"
                                              disabled={saving[key] || isCalculatedKPI(kpi.name)}
                                              readOnly={isCalculatedKPI(kpi.name)}
                                            />
                                            {saving[key] && (
                                              <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                                            )}
                                            {cellIssues.has(`${kpi.id}-month-${monthIdentifier}`) && !saving[key] && (
                                              <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                            )}
                                          </div>
                                        </TableCell>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="bg-background z-50">
                                        <ContextMenuItem
                                          onClick={() =>
                                            handleCreateIssueFromCell(
                                              kpi,
                                              mValue,
                                              targetValue,
                                              month.label,
                                              "month",
                                              `month-${monthIdentifier}`,
                                            )
                                          }
                                        >
                                          <AlertCircle className="h-4 w-4 mr-2" />
                                          Create Issue from Cell
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  );
                                })}
                              </>
                            ) : isQuarterTrendMode ? (
                              quarterTrendPeriods.map((qtr) => {
                                const qKey = `${kpi.id}-Q${qtr.quarter}-${qtr.year}`;
                                const qValue = precedingQuartersData[qKey];

                                // Get quarter-specific target
                                const targetKey = `${kpi.id}-Q${qtr.quarter}-${qtr.year}`;
                                const rawTarget = trendTargets[targetKey] ?? kpi.target_value;
                                const targetValue =
                                  rawTarget !== null && rawTarget !== undefined && rawTarget !== 0 ? rawTarget : null;

                                let trendStatus: "success" | "warning" | "destructive" | null = null;

                                if (qValue !== null && qValue !== undefined && targetValue !== null) {
                                  let variance: number;
                                  if (kpi.metric_type === "percentage") {
                                    variance = qValue - targetValue;
                                  } else {
                                    variance = ((qValue - targetValue) / Math.abs(targetValue)) * 100;
                                  }

                                  const adjustedVariance = kpi.target_direction === "below" ? -variance : variance;

                                  if (adjustedVariance >= 0) {
                                    trendStatus = "success";
                                  } else if (adjustedVariance >= -10) {
                                    trendStatus = "warning";
                                  } else {
                                    trendStatus = "destructive";
                                  }
                                }

                                return (
                                  <TableCell
                                    key={qtr.label}
                                    className={cn(
                                      "px-0.5 py-0 text-center min-w-[90px] max-w-[90px]",
                                      trendStatus === "success" && "bg-emerald-100 dark:bg-emerald-900/40",
                                      trendStatus === "warning" && "bg-amber-100 dark:bg-amber-900/40",
                                      trendStatus === "destructive" && "bg-red-100 dark:bg-red-900/40",
                                      !trendStatus && "text-muted-foreground",
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        trendStatus === "success" && "text-emerald-800 dark:text-emerald-200 font-medium",
                                        trendStatus === "warning" && "text-amber-800 dark:text-amber-200 font-medium",
                                        trendStatus === "destructive" && "text-red-800 dark:text-red-200 font-medium",
                                      )}
                                    >
                                      {qValue !== null && qValue !== undefined
                                        ? formatQuarterAverage(qValue, kpi.metric_type, kpi.name)
                                        : "-"}
                                    </span>
                                  </TableCell>
                                );
                              })
                            ) : viewMode === "weekly" ? (
                              <>
                              {weeks.map((week) => {
                                const weekDate = week.start.toISOString().split("T")[0];
                                const key = `${kpi.id}-${weekDate}`;
                                const entry = entries[key];
                                const status = getStatus(entry?.status || null);
                                const displayValue =
                                  localValues[key] !== undefined
                                    ? localValues[key]
                                    : formatValue(entry?.actual_value || null, kpi.metric_type, kpi.name);
                                const isCurrentWeek = weekDate === currentWeekDate;
                                const targetValue = kpiTargets[kpi.id] || kpi.target_value;

                                return (
                                  <ContextMenu key={week.label}>
                                    <ContextMenuTrigger asChild>
                                      <TableCell
                                        className={cn(
                                          "px-0.5 py-0 relative min-w-[90px] max-w-[90px]",
                                          status === "success" && "bg-emerald-100 dark:bg-emerald-900/40",
                                          status === "warning" && "bg-amber-100 dark:bg-amber-900/40",
                                          status === "destructive" && "bg-red-100 dark:bg-red-900/40",
                                          isCurrentWeek && "border-l-2 border-r-2 border-primary bg-primary/5",
                                        )}
                                      >
                                        <div className="relative flex items-center justify-center gap-0 h-7 w-full">
                                          {(isCalculatedKPI(kpi.name) || focusedInput !== key) &&
                                          entry?.actual_value !== null &&
                                          entry?.actual_value !== undefined ? (
                                            // Display formatted value when data exists (always for calculated, when not focused for others)
                                            <div
                                              data-display-value
                                            className={cn(
                                                "h-full w-full flex items-center justify-center cursor-text text-xs",
                                                status === "success" && "text-emerald-800 dark:text-emerald-200 font-medium",
                                                status === "warning" && "text-amber-800 dark:text-amber-200 font-medium",
                                                status === "destructive" && "text-red-800 dark:text-red-200 font-medium",
                                                isCalculatedKPI(kpi.name) && "cursor-default",
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
                                              {kpi.metric_type === "dollar"
                                                ? "$"
                                                : kpi.metric_type === "percentage"
                                                  ? "%"
                                                  : "-"}
                                            </div>
                                          ) : null}
                                          <Input
                                            type="number"
                                            step="any"
                                            value={displayValue}
                                            onChange={(e) =>
                                              handleValueChange(
                                                kpi.id,
                                                weekDate,
                                                e.target.value,
                                                kpiTargets[kpi.id] || kpi.target_value,
                                                kpi.metric_type,
                                                kpi.target_direction,
                                                false,
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === "Enter" || e.key === "Tab") {
                                                e.preventDefault();
                                                saveValue(
                                                  kpi.id,
                                                  weekDate,
                                                  localValues[key] ?? displayValue,
                                                  kpiTargets[kpi.id] || kpi.target_value,
                                                  kpi.metric_type,
                                                  kpi.target_direction,
                                                  false,
                                                );
                                                // Use sortedKpis index instead of original kpis
                                                const currentKpiIndex = index;
                                                const currentPeriodIndex = weeks.findIndex(
                                                  (w) => w.start.toISOString().split("T")[0] === weekDate,
                                                );

                                                if (currentKpiIndex < sortedKpis.length - 1) {
                                                  const nextInput = document.querySelector(
                                                    `input[data-kpi-index="${currentKpiIndex + 1}"][data-period-index="${currentPeriodIndex}"]`,
                                                  ) as HTMLInputElement;
                                                  nextInput?.focus();
                                                  nextInput?.select();
                                                }
                                              }
                                            }}
                                            onFocus={() => setFocusedInput(key)}
                                            onBlur={() => {
                                              const valueToSave = localValues[key];
                                              if (valueToSave !== undefined) {
                                                saveValue(
                                                  kpi.id,
                                                  weekDate,
                                                  valueToSave,
                                                  kpiTargets[kpi.id] || kpi.target_value,
                                                  kpi.metric_type,
                                                  kpi.target_direction,
                                                  false,
                                                );
                                              }
                                              setTimeout(() => {
                                                setFocusedInput(null);
                                                setLocalValues((prev) => {
                                                  const newLocalValues = { ...prev };
                                                  delete newLocalValues[key];
                                                  return newLocalValues;
                                                });
                                              }, 100);
                                            }}
                                            data-kpi-index={index}
                                            data-period-index={weeks.findIndex(
                                              (w) => w.start.toISOString().split("T")[0] === weekDate,
                                            )}
                                            className={cn(
                                              "h-full w-full text-center text-xs border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                                              status === "success" && "text-emerald-800 dark:text-emerald-200 font-medium",
                                              status === "warning" && "text-amber-800 dark:text-amber-200 font-medium",
                                              status === "destructive" && "text-red-800 dark:text-red-200 font-medium",
                                              isCalculatedKPI(kpi.name) && "hidden",
                                            )}
                                            placeholder="-"
                                            disabled={saving[key] || isCalculatedKPI(kpi.name)}
                                            readOnly={isCalculatedKPI(kpi.name)}
                                          />
                                          {saving[key] && (
                                            <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                                          )}
                                          {cellIssues.has(`${kpi.id}-week-${weekDate}`) && !saving[key] && (
                                            <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                          )}
                                        </div>
                                      </TableCell>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent className="bg-background z-50">
                                      <ContextMenuItem
                                        onClick={() =>
                                          handleCreateIssueFromCell(
                                            kpi,
                                            entry?.actual_value,
                                            targetValue,
                                            week.label,
                                            "week",
                                            `week-${weekDate}`,
                                          )
                                        }
                                      >
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Create Issue from Cell
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                               })}
                               {/* Phase 5: Q TOTAL data cell */}
                              {(() => {
                                const weekValues = weeks.map((week) => {
                                  const weekDate = week.start.toISOString().split("T")[0];
                                  const entry = entries[`${kpi.id}-${weekDate}`];
                                  return entry?.actual_value ?? null;
                                }).filter((v): v is number => v !== null);
                                
                                let qTotal: number | null = null;
                                if (weekValues.length > 0) {
                                  if (kpi.aggregation_type === "average") {
                                    qTotal = weekValues.reduce((a, b) => a + b, 0) / weekValues.length;
                                  } else {
                                    qTotal = weekValues.reduce((a, b) => a + b, 0);
                                  }
                                }

                                // Calculate status for q total vs target * 13 (for sum) or target (for avg)
                                const targetValue = kpiTargets[kpi.id] || kpi.target_value;
                                let qStatus: "success" | "warning" | "destructive" | null = null;
                                if (qTotal !== null && targetValue) {
                                  const qTarget = kpi.aggregation_type === "average" ? targetValue : targetValue;
                                  let variance: number;
                                  if (kpi.metric_type === "percentage") {
                                    variance = qTotal - qTarget;
                                  } else {
                                    variance = ((qTotal - qTarget) / Math.abs(qTarget)) * 100;
                                  }
                                  const adjustedVariance = kpi.target_direction === "below" ? -variance : variance;
                                  if (adjustedVariance >= 0) qStatus = "success";
                                  else if (adjustedVariance >= -10) qStatus = "warning";
                                  else qStatus = "destructive";
                                }

                                return (
                                  <TableCell className={cn(
                                    "px-0.5 py-0 text-center min-w-[80px] max-w-[80px] border-l-2 border-border bg-muted/30 font-semibold text-xs",
                                    qStatus === "success" && "bg-emerald-100 dark:bg-emerald-900/40",
                                    qStatus === "warning" && "bg-amber-100 dark:bg-amber-900/40",
                                    qStatus === "destructive" && "bg-red-100 dark:bg-red-900/40",
                                  )}>
                                    <span className={cn(
                                      qStatus === "success" && "text-emerald-800 dark:text-emerald-200",
                                      qStatus === "warning" && "text-amber-800 dark:text-amber-200",
                                      qStatus === "destructive" && "text-red-800 dark:text-red-200",
                                    )}>
                                      {qTotal !== null ? formatTarget(qTotal, kpi.metric_type, kpi.name) : "-"}
                                    </span>
                                  </TableCell>
                                );
                              })()}
                              </>
                            ) : (
                              <>
                                {/* Previous Year Quarter Target */}
                                <TableCell className="text-center py-0.5 min-w-[80px] max-w-[80px] text-muted-foreground bg-muted/70 border-x-2 border-muted-foreground/30 font-medium">
                                  {formatTarget(
                                    previousYearTargets[kpi.id] ?? kpi.target_value,
                                    kpi.metric_type,
                                    kpi.name,
                                  )}
                                </TableCell>

                                {/* Previous Year Months with visual cues */}
                                {previousYearMonths.map((month) => {
                                  const key = `${kpi.id}-month-${month.identifier}`;
                                  const entry = entries[key];
                                  const status = getStatus(entry?.status || null);

                                  return (
                                    <TableCell
                                      key={month.identifier}
                                      className={cn(
                                        "px-1 py-0.5 relative min-w-[90px] max-w-[90px] text-center bg-muted/20",
                                        status === "success" && "bg-success/10",
                                        status === "warning" && "bg-warning/10",
                                        status === "destructive" && "bg-destructive/10",
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          "text-muted-foreground",
                                          status === "success" && "text-success font-medium",
                                          status === "warning" && "text-warning font-medium",
                                          status === "destructive" && "text-destructive font-medium",
                                        )}
                                      >
                                        {entry?.actual_value !== null && entry?.actual_value !== undefined
                                          ? formatTarget(entry.actual_value, kpi.metric_type, kpi.name)
                                          : "-"}
                                      </span>
                                    </TableCell>
                                  );
                                })}

                                {/* Previous Year Quarter Avg with visual cues */}
                                <TableCell
                                  className={cn(
                                    "text-center py-0.5 min-w-[80px] max-w-[80px] bg-muted/50 border-x-2 border-muted-foreground/30",
                                    (() => {
                                      const qKey = `${kpi.id}-Q${quarter}-${year - 1}`;
                                      const qValue = precedingQuartersData[qKey];
                                      const target = previousYearTargets[kpi.id] ?? kpi.target_value;
                                      if (
                                        qValue !== null &&
                                        qValue !== undefined &&
                                        target !== null &&
                                        target !== undefined &&
                                        target !== 0
                                      ) {
                                        let variance: number;
                                        if (kpi.metric_type === "percentage") {
                                          variance = qValue - target;
                                        } else {
                                          variance = ((qValue - target) / target) * 100;
                                        }
                                        const adjustedVariance =
                                          kpi.target_direction === "below" ? -variance : variance;
                                        if (adjustedVariance >= 0) return "bg-success/10";
                                        if (adjustedVariance >= -10) return "bg-warning/10";
                                        return "bg-destructive/10";
                                      }
                                      return "";
                                    })(),
                                  )}
                                >
                                  {(() => {
                                    const qKey = `${kpi.id}-Q${quarter}-${year - 1}`;
                                    const qValue = precedingQuartersData[qKey];
                                    const target = previousYearTargets[kpi.id] ?? kpi.target_value;

                                    let statusClass = "text-muted-foreground";
                                    if (
                                      qValue !== null &&
                                      qValue !== undefined &&
                                      target !== null &&
                                      target !== undefined &&
                                      target !== 0
                                    ) {
                                      let variance: number;
                                      if (kpi.metric_type === "percentage") {
                                        variance = qValue - target;
                                      } else {
                                        variance = ((qValue - target) / target) * 100;
                                      }
                                      const adjustedVariance = kpi.target_direction === "below" ? -variance : variance;
                                      if (adjustedVariance >= 0) statusClass = "text-success font-medium";
                                      else if (adjustedVariance >= -10) statusClass = "text-warning font-medium";
                                      else statusClass = "text-destructive font-medium";
                                    }

                                    return (
                                      <span className={statusClass}>
                                        {qValue !== null && qValue !== undefined
                                          ? formatQuarterAverage(qValue, kpi.metric_type, kpi.name)
                                          : "-"}
                                      </span>
                                    );
                                  })()}
                                </TableCell>

                                {/* Q{quarter} Target */}
                                <TableCell className="text-center py-0.5 min-w-[80px] max-w-[80px] bg-background border-x-2 border-primary/30 font-medium">
                                  {canEditTargets() && editingTarget === kpi.id ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <Input
                                        type="number"
                                        step="any"
                                        value={targetEditValue}
                                        onChange={(e) => setTargetEditValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleTargetSave(kpi.id);
                                          if (e.key === "Escape") setEditingTarget(null);
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
                                          canEditTargets() && "cursor-pointer hover:text-foreground",
                                        )}
                                        onClick={() => canEditTargets() && handleTargetEdit(kpi.id)}
                                      >
                                        {formatTarget(
                                          kpiTargets[kpi.id] || kpi.target_value,
                                          kpi.metric_type,
                                          kpi.name,
                                        )}
                                      </span>
                                      {canEditTargets() && (
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 hover:bg-accent">
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

                                {/* Months */}
                                {months.map((month) => {
                                  const key = `${kpi.id}-month-${month.identifier}`;
                                  const entry = entries[key];
                                  const status = getStatus(entry?.status || null);
                                  const displayValue =
                                    localValues[key] !== undefined
                                      ? localValues[key]
                                      : formatValue(entry?.actual_value || null, kpi.metric_type, kpi.name);
                                  const targetValue = kpiTargets[kpi.id] || kpi.target_value;

                                  return (
                                    <ContextMenu key={month.identifier}>
                                      <ContextMenuTrigger asChild>
                                        <TableCell
                                          className={cn(
                             "px-1 py-0.5 relative min-w-[90px] max-w-[90px]",
                            status === "success" && "bg-success/10",
                            status === "warning" && "bg-warning/10",
                            status === "destructive" && "bg-destructive/10",
                                          )}
                                        >
                                          <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                                            {(isCalculatedKPI(kpi.name) || focusedInput !== key) &&
                                            entry?.actual_value !== null &&
                                            entry?.actual_value !== undefined ? (
                                              // Display formatted value when data exists (always for calculated, when not focused for others)
                                              <div
                                                data-display-value
                                                className={cn(
                                                  "h-full w-full flex items-center justify-center cursor-text",
                                                  status === "success" && "text-success font-medium",
                                                  status === "warning" && "text-warning font-medium",
                                                  status === "destructive" && "text-destructive font-medium",
                                                  isCalculatedKPI(kpi.name) && "cursor-default",
                                                )}
                                                onClick={(e) => {
                                                  if (!isCalculatedKPI(kpi.name)) {
                                                    const input = e.currentTarget
                                                      .nextElementSibling as HTMLInputElement;
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
                                                {kpi.metric_type === "dollar"
                                                  ? "$"
                                                  : kpi.metric_type === "percentage"
                                                    ? "%"
                                                    : "-"}
                                              </div>
                                            ) : null}
                                            <Input
                                              type="number"
                                              step="any"
                                              value={displayValue}
                                              onChange={(e) =>
                                                handleValueChange(
                                                  kpi.id,
                                                  "",
                                                  e.target.value,
                                                  kpiTargets[kpi.id] || kpi.target_value,
                                                  kpi.metric_type,
                                                  kpi.target_direction,
                                                  true,
                                                  month.identifier,
                                                )
                                              }
                                              onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === "Tab") {
                                                  e.preventDefault();
                                                  saveValue(
                                                    kpi.id,
                                                    "",
                                                    localValues[key] ?? displayValue,
                                                    kpiTargets[kpi.id] || kpi.target_value,
                                                    kpi.metric_type,
                                                    kpi.target_direction,
                                                    true,
                                                    month.identifier,
                                                  );
                                                  // Use sortedKpis index instead of original kpis
                                                  const currentKpiIndex = index;
                                                  const currentPeriodIndex = months.findIndex(
                                                    (m) => m.identifier === month.identifier,
                                                  );

                                                  if (currentKpiIndex < sortedKpis.length - 1) {
                                                    const nextInput = document.querySelector(
                                                      `input[data-kpi-index="${currentKpiIndex + 1}"][data-period-index="${currentPeriodIndex}"]`,
                                                    ) as HTMLInputElement;
                                                    nextInput?.focus();
                                                    nextInput?.select();
                                                  }
                                                }
                                              }}
                                              onFocus={() => setFocusedInput(key)}
                                              onBlur={() => {
                                                const valueToSave = localValues[key];
                                                if (valueToSave !== undefined) {
                                                  saveValue(
                                                    kpi.id,
                                                    "",
                                                    valueToSave,
                                                    kpiTargets[kpi.id] || kpi.target_value,
                                                    kpi.metric_type,
                                                    kpi.target_direction,
                                                    true,
                                                    month.identifier,
                                                  );
                                                }
                                                setTimeout(() => {
                                                  setFocusedInput(null);
                                                  setLocalValues((prev) => {
                                                    const newLocalValues = { ...prev };
                                                    delete newLocalValues[key];
                                                    return newLocalValues;
                                                  });
                                                }, 100);
                                              }}
                                              data-kpi-index={index}
                                              data-period-index={months.findIndex(
                                                (m) => m.identifier === month.identifier,
                                              )}
                                              className={cn(
                                                "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                                                status === "success" && "text-success font-medium",
                                                status === "warning" && "text-warning font-medium",
                                                status === "destructive" && "text-destructive font-medium",
                                                isCalculatedKPI(kpi.name) && "hidden",
                                              )}
                                              placeholder="-"
                                              disabled={saving[key] || isCalculatedKPI(kpi.name)}
                                              readOnly={isCalculatedKPI(kpi.name)}
                                            />
                                            {saving[key] && (
                                              <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                                            )}
                                            {cellIssues.has(`${kpi.id}-month-${month.identifier}`) && !saving[key] && (
                                              <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                            )}
                                          </div>
                                        </TableCell>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="bg-background z-50">
                                        <ContextMenuItem
                                          onClick={() =>
                                            handleCreateIssueFromCell(
                                              kpi,
                                              entry?.actual_value,
                                              targetValue,
                                              month.label,
                                              "month",
                                              `month-${month.identifier}`,
                                            )
                                          }
                                        >
                                          <AlertCircle className="h-4 w-4 mr-2" />
                                          Create Issue from Cell
                                        </ContextMenuItem>
                                      </ContextMenuContent>
                                    </ContextMenu>
                                  );
                                })}
                                {/* Current Year Quarter Average */}
                                <TableCell className="text-center py-0.5 min-w-[80px] max-w-[80px] bg-primary/10 border-x-2 border-primary/30">
                                  {(() => {
                                    const qKey = `${kpi.id}-Q${quarter}-${year}`;
                                    const qValue = precedingQuartersData[qKey];
                                    return qValue !== null && qValue !== undefined
                                      ? formatQuarterAverage(qValue, kpi.metric_type, kpi.name)
                                      : "-";
                                  })()}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </div>

          <StickyHScrollbar
            show={showTopScrollbar}
            position="top"
            offsetPx={72}
            left={scrollbarRect.left}
            width={scrollbarRect.width}
            scrollWidth={tableWidth}
            clientWidth={scrollClientWidthDebug}
            scrollLeft={scrollLeftDebug}
            onSetScrollLeft={setContainerScrollLeft}
          />

          <StickyHScrollbar
            show={true}
            position="bottom"
            offsetPx={12}
            left={scrollbarRect.left}
            width={scrollbarRect.width}
            scrollWidth={tableWidth}
            clientWidth={scrollClientWidthDebug}
            scrollLeft={scrollLeftDebug}
            onSetScrollLeft={setContainerScrollLeft}
          />
        </>
      )}

      {/* Paste Row Dialog */}
      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste Row Data</DialogTitle>
            <DialogDescription>
              Copy a row from Google Sheets and paste it here. The values should be tab-separated ({pastePeriods.length}{" "}
              periods)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Owner filter for easier KPI selection */}
            <div className="space-y-2">
              <Label htmlFor="paste-owner-filter">Filter by Owner</Label>
              <Select
                value={pasteOwnerFilter}
                onValueChange={(value) => {
                  setPasteOwnerFilter(value);
                  // Clear KPI selection when owner filter changes
                  setPasteKpi("");
                  setParsedPasteData([]);
                }}
              >
                <SelectTrigger id="paste-owner-filter">
                  <SelectValue placeholder="All Owners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Owners</SelectItem>
                  {(() => {
                    // Get unique owners from KPIs
                    const ownerIds = new Set<string>();
                    kpis
                      .filter((k) => !isCalculatedKPI(k.name))
                      .forEach((kpi) => {
                        if (kpi.assigned_to) {
                          ownerIds.add(kpi.assigned_to);
                        }
                      });

                    return Array.from(ownerIds)
                      .map((ownerId) => ({
                        id: ownerId,
                        name: profiles[ownerId]?.full_name || "Unknown",
                      }))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ));
                  })()}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paste-kpi">Select KPI</Label>
              <Select
                value={pasteKpi}
                onValueChange={(value) => {
                  setPasteKpi(value);
                  handlePasteDataChange(pasteData);
                }}
              >
                <SelectTrigger id="paste-kpi">
                  <SelectValue placeholder="Choose a KPI..." />
                </SelectTrigger>
                <SelectContent>
                  {kpis
                    .filter((k) => !isCalculatedKPI(k.name))
                    .filter((k) => pasteOwnerFilter === "all" || k.assigned_to === pasteOwnerFilter)
                    .map((kpi) => {
                      const owner = kpi.assigned_to ? profiles[kpi.assigned_to] : null;
                      const ownerName = owner ? owner.full_name : "Unassigned";
                      return (
                        <SelectItem key={kpi.id} value={kpi.id}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <span>{kpi.name}</span>
                            {pasteOwnerFilter === "all" && (
                              <span className="text-xs text-muted-foreground">({ownerName})</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              {pasteKpi &&
                (() => {
                  const selectedKpi = kpis.find((k) => k.id === pasteKpi);
                  if (selectedKpi) {
                    const owner = selectedKpi.assigned_to ? profiles[selectedKpi.assigned_to] : null;
                    const ownerName = owner ? owner.full_name : "Unassigned";
                    return (
                      <p className="text-sm text-muted-foreground">
                        Pasting values for <span className="font-medium text-foreground">{selectedKpi.name}</span> owned
                        by <span className="font-medium text-foreground">{ownerName}</span>
                      </p>
                    );
                  }
                  return null;
                })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paste-year">Starting Year</Label>
                <Select
                  value={pasteYear.toString()}
                  onValueChange={(value) => {
                    setPasteYear(parseInt(value));
                    handlePasteDataChange(pasteData);
                  }}
                >
                  <SelectTrigger id="paste-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[year - 2, year - 1, year, year + 1].map((y) => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paste-month">Starting Month</Label>
                <Select
                  value={pasteMonth}
                  onValueChange={(value) => {
                    setPasteMonth(value);
                    handlePasteDataChange(pasteData);
                  }}
                >
                  <SelectTrigger id="paste-month">
                    <SelectValue placeholder="Select month..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: "01", label: "January" },
                      { value: "02", label: "February" },
                      { value: "03", label: "March" },
                      { value: "04", label: "April" },
                      { value: "05", label: "May" },
                      { value: "06", label: "June" },
                      { value: "07", label: "July" },
                      { value: "08", label: "August" },
                      { value: "09", label: "September" },
                      { value: "10", label: "October" },
                      { value: "11", label: "November" },
                      { value: "12", label: "December" },
                    ].map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                Tip: In Google Sheets, select cells for consecutive months, copy (Ctrl+C), and paste here
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
                        // Format the period identifier (YYYY-MM) to a readable month name
                        const monthNames = [
                          "January",
                          "February",
                          "March",
                          "April",
                          "May",
                          "June",
                          "July",
                          "August",
                          "September",
                          "October",
                          "November",
                          "December",
                        ];
                        const parts = entry.period.split("-");
                        const periodLabel =
                          parts.length === 2 ? `${monthNames[parseInt(parts[1]) - 1]} ${parts[0]}` : entry.period;
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
                Save {parsedPasteData.length} {parsedPasteData.length === 1 ? "Entry" : "Entries"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Creation Dialog - triggered from cell context menu */}
      <IssueManagementDialog
        departmentId={departmentId}
        onIssueAdded={() => {
          setIssueDialogOpen(false);
          setIssueContext(null);
          // Refresh cell issues to show the new flag
          if (issueContext?.sourceKpiId && issueContext?.sourcePeriod) {
            setCellIssues((prev) => new Set([...prev, `${issueContext.sourceKpiId}-${issueContext.sourcePeriod}`]));
          }
          toast({
            title: "Issue Created",
            description: "The issue has been created successfully.",
          });
        }}
        open={issueDialogOpen}
        onOpenChange={(open) => {
          setIssueDialogOpen(open);
          if (!open) setIssueContext(null);
        }}
        trigger={<span className="hidden" />}
        initialTitle={issueContext?.title}
        initialDescription={issueContext?.description}
        initialSeverity={issueContext?.severity}
        sourceType="scorecard"
        sourceKpiId={issueContext?.sourceKpiId}
        sourcePeriod={issueContext?.sourcePeriod}
      />

      {/* Delete KPI Confirmation Dialog */}
      <AlertDialog open={!!deleteKpiId} onOpenChange={(open) => !open && setDeleteKpiId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this KPI and all associated scorecard data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteKpiId && handleDeleteKPI(deleteKpiId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Period Confirmation Dialog */}
      <AlertDialog open={!!clearPeriod} onOpenChange={(open) => !open && setClearPeriod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear {clearPeriod?.type === "week" ? "Week" : "Month"} Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all scorecard entries for <strong>{clearPeriod?.label}</strong> across every KPI in this department. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingPeriod}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearPeriodData}
              disabled={clearingPeriod}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearingPeriod ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                "Clear All Data"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Scorecard Import Preview Dialog */}
      {departmentStoreId && droppedParseResult && (
        <ScorecardImportPreviewDialog
          open={importPreviewOpen}
          onOpenChange={(open) => {
            setImportPreviewOpen(open);
            if (!open) {
              setDroppedParseResult(null);
              setDroppedFileName("");
              setDroppedFile(null);
              setImportWeekStartDate(null);
            }
          }}
          parseResult={droppedParseResult}
          fileName={droppedFileName}
          file={droppedFile}
          departmentId={departmentId}
          storeId={departmentStoreId}
          month={importMonth}
          weekStartDate={importWeekStartDate || undefined}
          onImportSuccess={() => {
            setImportPreviewOpen(false);
            setDroppedParseResult(null);
            setDroppedFileName("");
            setDroppedFile(null);
            setImportWeekStartDate(null);
            // Refresh scorecard data and import logs after import
            loadKPITargets().then((freshTargets) => loadScorecardData(freshTargets));
            loadImportLogs();
          }}
        />
      )}
    </div>
  );
};

export default ScorecardGrid;
