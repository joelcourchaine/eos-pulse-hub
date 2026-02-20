import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronUp, ChevronRight, DollarSign, Loader2, Settings, StickyNote, Copy, Upload, ClipboardPaste, Trophy, AlertCircle, Flag, Download, TrendingUp, Mountain } from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getMetricsForBrand, isHondaLegacyMonth, type FinancialMetric } from "@/config/financialMetrics";
import { FinancialDataImport } from "./FinancialDataImport";
import { Sparkline } from "@/components/ui/sparkline";
import { IssueManagementDialog } from "@/components/issues/IssueManagementDialog";
import { MonthDropZone } from "./MonthDropZone";
import { useSubMetrics } from "@/hooks/useSubMetrics";
import { useSubMetricTargets } from "@/hooks/useSubMetricTargets";
import { SubMetricsRow, ExpandableMetricName } from "./SubMetricsRow";
import { ForecastDrawer } from "./ForecastDrawer";
import { useRockTargets } from "@/hooks/useRockTargets";
import { useForecastTargets } from "@/hooks/useForecastTargets";

interface FinancialSummaryProps {
  departmentId: string;
  year: number;
  quarter: number;
}


const getMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const months = [];
  
  // Always show only the 3 months for the selected quarter
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

const getPreviousYearMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const months = [];
  const previousYear = year - 1;
  
  // Show the 3 months for the same quarter in the previous year
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: `${monthNames[monthIndex]} ${previousYear}`,
      identifier: `${previousYear}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

// Helper function to get only the 3 months for a quarter (for average calculations)
const getQuarterMonthsForCalculation = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const months = [];
  // Always return exactly 3 months for the quarter
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
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
  
  // Start from Q1 of last year - matches ScorecardGrid behavior
  for (let y = startYear; y <= currentYear; y++) {
    const startQ = 1;
    const endQ = y === currentYear ? currentQuarter : 4;
    
    for (let q = startQ; q <= endQ; q++) {
      quarters.push({
        quarter: q,
        year: y,
        label: `Q${q} ${y}`,
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
  type: 'month' | 'year-avg' | 'year-total';
  summaryYear?: number;
  isYTD?: boolean;
}

const getMonthlyTrendPeriods = (selectedYear: number): MonthlyTrendPeriod[] => {
  const periods: MonthlyTrendPeriod[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Add all 12 months for the selected year only
  for (let m = 0; m < 12; m++) {
    periods.push({
      month: m,
      year: selectedYear,
      label: `${monthNames[m]} ${selectedYear}`,
      identifier: `${selectedYear}-${String(m + 1).padStart(2, '0')}`,
      type: 'month',
    });
  }
  
  // Add year summary columns
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Avg ${selectedYear}`,
    identifier: `avg-${selectedYear}`,
    type: 'year-avg',
    summaryYear: selectedYear,
  });
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Total ${selectedYear}`,
    identifier: `total-${selectedYear}`,
    type: 'year-total',
    summaryYear: selectedYear,
  });
  
  return periods;
};

export const FinancialSummary = ({ departmentId, year, quarter }: FinancialSummaryProps) => {
  const [entries, setEntries] = useState<{ [key: string]: number }>({});
  const [targets, setTargets] = useState<{ [key: string]: number }>({});
  const [trendTargets, setTrendTargets] = useState<{ [metricKey: string]: { [quarterYear: string]: { value: number; direction: "above" | "below" } } }>({});
  const [targetDirections, setTargetDirections] = useState<{ [key: string]: "above" | "below" }>({});
  const [precedingQuarterTargets, setPrecedingQuarterTargets] = useState<{ [key: string]: { value: number; direction: "above" | "below" } }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [isOpen, setIsOpen] = useState(true);
  const [targetsDialogOpen, setTargetsDialogOpen] = useState(false);
  const [editTargets, setEditTargets] = useState<{ [quarter: number]: { [key: string]: string } }>({ 1: {}, 2: {}, 3: {}, 4: {} });
  const [editTargetDirections, setEditTargetDirections] = useState<{ [quarter: number]: { [key: string]: "above" | "below" } }>({ 1: {}, 2: {}, 3: {}, 4: {} });
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const [precedingQuartersData, setPrecedingQuartersData] = useState<{ [key: string]: number }>({});
  const [storeBrand, setStoreBrand] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [targetYear, setTargetYear] = useState(year);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [currentNoteCell, setCurrentNoteCell] = useState<{ metricKey: string; monthId: string } | null>(null);
  const [currentNote, setCurrentNote] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetEditValue, setTargetEditValue] = useState<string>("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteMetric, setPasteMetric] = useState<string>("");
  const [pasteData, setPasteData] = useState<string>("");
  const [parsedPasteData, setParsedPasteData] = useState<{ month: string; value: number }[]>([]);
  const [pasteMonth, setPasteMonth] = useState<string>("");
  const [pasteYear, setPasteYear] = useState<number>(year);
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  // Ref to track cells actively being edited or saved - used by realtime to avoid overwriting
  const activeCellRef = useRef<string | null>(null);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueContext, setIssueContext] = useState<{
    title: string;
    description: string;
    severity: string;
    sourceMetricName?: string;
    sourcePeriod?: string;
  } | null>(null);
  const [cellIssues, setCellIssues] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<{ [monthId: string]: { id: string; file_name: string; file_path: string; file_type: string } }>({});
  const [siblingAttachments, setSiblingAttachments] = useState<{ [monthId: string]: { file_name: string; file_path: string; file_type: string; department_name: string } }>({});
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  const [copyingMonth, setCopyingMonth] = useState<string | null>(null);
  const [copyMetadata, setCopyMetadata] = useState<{ [monthId: string]: { sourceLabel: string; copiedAt: string } }>({});
  const [forecastDrawerOpen, setForecastDrawerOpen] = useState(false);
  const [clearMonthDialogOpen, setClearMonthDialogOpen] = useState(false);
  const [clearMonthTarget, setClearMonthTarget] = useState<string | null>(null);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  // Request ID tracking to prevent stale async data from overwriting fresh data
  const loadRequestIdRef = useRef(0);
  const precedingDataRequestIdRef = useRef(0);
  // Debounce ref to batch realtime-triggered reloads
  const precedingDataDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to always call the latest version of loadPrecedingQuartersData from realtime handler
  const loadPrecedingQuartersDataRef = useRef<() => void>(() => {});

  // Fetch financial attachments for current department AND sibling departments
  const fetchAttachments = useCallback(async () => {
    if (!departmentId || !storeId) {
      // Fallback to department-only query if storeId not available
      if (!departmentId) return;
      const { data } = await supabase
        .from('financial_attachments')
        .select('id, month_identifier, file_name, file_path, file_type')
        .eq('department_id', departmentId);
      
      const attachmentMap: typeof attachments = {};
      data?.forEach(att => {
        attachmentMap[att.month_identifier] = {
          id: att.id,
          file_name: att.file_name,
          file_path: att.file_path,
          file_type: att.file_type,
        };
      });
      setAttachments(attachmentMap);
      setSiblingAttachments({});
      return;
    }

    // Get all department IDs for this store
    const { data: storeDepartments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('store_id', storeId);
    
    if (!storeDepartments || storeDepartments.length === 0) return;
    
    const allDeptIds = storeDepartments.map(d => d.id);
    const deptNameMap = Object.fromEntries(storeDepartments.map(d => [d.id, d.name]));

    // Fetch attachments for ALL departments at this store
    const { data } = await supabase
      .from('financial_attachments')
      .select('id, month_identifier, file_name, file_path, file_type, department_id')
      .in('department_id', allDeptIds);
    
    const attachmentMap: typeof attachments = {};
    const siblingMap: typeof siblingAttachments = {};
    
    data?.forEach(att => {
      if (att.department_id === departmentId) {
        // This is our department's attachment
        attachmentMap[att.month_identifier] = {
          id: att.id,
          file_name: att.file_name,
          file_path: att.file_path,
          file_type: att.file_type,
        };
      } else if (!attachmentMap[att.month_identifier] && !siblingMap[att.month_identifier]) {
        // This is a sibling's attachment (only store first one found if no current dept attachment)
        siblingMap[att.month_identifier] = {
          file_name: att.file_name,
          file_path: att.file_path,
          file_type: att.file_type,
          department_name: deptNameMap[att.department_id] || 'Another Department',
        };
      }
    });
    
    // Remove sibling attachments where current dept already has one
    Object.keys(attachmentMap).forEach(monthId => {
      delete siblingMap[monthId];
    });
    
    setAttachments(attachmentMap);
    setSiblingAttachments(siblingMap);
  }, [departmentId, storeId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Fetch copy metadata to show "copied from" indicator
  const fetchCopyMetadata = useCallback(async () => {
    if (!departmentId) return;
    const { data } = await supabase
      .from('financial_copy_metadata')
      .select('target_month, source_label, copied_at')
      .eq('department_id', departmentId);
    
    const metadataMap: typeof copyMetadata = {};
    data?.forEach(item => {
      metadataMap[item.target_month] = {
        sourceLabel: item.source_label || item.target_month,
        copiedAt: item.copied_at,
      };
    });
    setCopyMetadata(metadataMap);
  }, [departmentId]);

  useEffect(() => {
    fetchCopyMetadata();
  }, [fetchCopyMetadata]);

  // Fetch cell issues to display red flags
  useEffect(() => {
    const fetchCellIssues = async () => {
      if (!departmentId) return;
      const { data } = await supabase
        .from('issues')
        .select('source_metric_name, source_period')
        .eq('department_id', departmentId)
        .eq('source_type', 'financial')
        .not('source_metric_name', 'is', null);
      
      const issueSet = new Set<string>();
      data?.forEach(issue => {
        if (issue.source_metric_name && issue.source_period) {
          issueSet.add(`${issue.source_metric_name}-${issue.source_period}`);
        }
      });
      setCellIssues(issueSet);
    };
    fetchCellIssues();
  }, [departmentId]);

  const isQuarterTrendMode = quarter === 0;
  const isMonthlyTrendMode = quarter === -1;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
   const lastMonthlyColumnRef = useRef<HTMLTableCellElement | null>(null);
  const currentDate = new Date();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
  const currentYear = currentDate.getFullYear();
  // Use actual current year for quarter trend to match ScorecardGrid behavior
  const quarterTrendPeriods = isQuarterTrendMode ? getQuarterTrendPeriods(currentQuarter, currentYear) : [];
  const monthlyTrendPeriods = isMonthlyTrendMode ? getMonthlyTrendPeriods(year) : [];
  const months = getMonthsForQuarter(quarter || 1, year);
  const previousYearMonths = getPreviousYearMonthsForQuarter(quarter || 1, year);
  const precedingQuarters = getPrecedingQuarters(quarter || 1, year, 4);
  
  // Collect all month identifiers for sub-metrics
  const allMonthIdentifiers = useMemo(() => {
    const identifiers: string[] = [];
    // Add current quarter months
    months.forEach(m => identifiers.push(m.identifier));
    // Add previous year months
    previousYearMonths.forEach(m => identifiers.push(m.identifier));
    // Add monthly trend periods if applicable
    if (isMonthlyTrendMode) {
      monthlyTrendPeriods.forEach(p => {
        if (p.type === 'month') {
          identifiers.push(p.identifier);
        }
      });
    }
    // Add quarter trend periods if applicable
    if (isQuarterTrendMode) {
      quarterTrendPeriods.forEach(qtr => {
        const quarterMonths = getQuarterMonthsForCalculation(qtr.quarter, qtr.year);
        quarterMonths.forEach(m => identifiers.push(m.identifier));
      });
    }
    return [...new Set(identifiers)]; // Remove duplicates
  }, [months, previousYearMonths, isMonthlyTrendMode, monthlyTrendPeriods, isQuarterTrendMode, quarterTrendPeriods]);
  
  // Fetch sub-metrics for the department
  const { 
    getSubMetricNames, 
    getSubMetricValue, 
    hasSubMetrics: checkHasSubMetrics,
    subMetrics: allSubMetrics,
    refetch: refetchSubMetrics,
    getSubMetricSum,
    getCalculatedSubMetricValue,
    saveSubMetricValue,
  } = useSubMetrics(departmentId, allMonthIdentifiers);
  
  // Fetch sub-metric targets
  const {
    getSubMetricTarget,
    saveSubMetricTarget,
  } = useSubMetricTargets(departmentId);
  
  // Fetch rock targets for visual emphasis - use all quarters to show rocks in monthly trend view
  const {
    hasRockForMetric,
    hasRockForSubMetric,
    getRockForMetric,
    getRockForSubMetric,
    refetch: refetchRocks,
  } = useRockTargets(departmentId, quarter > 0 ? quarter : currentQuarter, year, true);

  // Fetch forecast entries for use as fallback targets
  const {
    getForecastTarget,
    hasForecastTargets,
    refetch: refetchForecastTargets,
  } = useForecastTargets(departmentId, year);

  /**
   * Resolve target for a given metric+month. Priority:
   * 1. Manual quarterly target from financial_targets
   * 2. Forecast entry fallback
   */
  const getTargetForMonth = useCallback((metricKey: string, monthId: string, metricDef: { targetDirection: "above" | "below"; type: string }): { value: number; direction: "above" | "below"; source: "manual" | "forecast" } | null => {
    // Extract quarter from month identifier (e.g., "2025-03" → Q1)
    const monthNum = parseInt(monthId.split('-')[1], 10);
    const monthQuarter = Math.ceil(monthNum / 3);
    const monthYear = parseInt(monthId.split('-')[0], 10);

    // 1. Check manual quarterly targets (trend mode uses trendTargets, standard uses targets)
    const quarterYearKey = `Q${monthQuarter}-${monthYear}`;
    const trendTarget = trendTargets[metricKey]?.[quarterYearKey];
    if (trendTarget && trendTarget.value !== 0) {
      return { value: trendTarget.value, direction: trendTarget.direction, source: 'manual' };
    }
    // Also check standard quarter targets for the current quarter view
    if (!isQuarterTrendMode && !isMonthlyTrendMode && targets[metricKey] && targets[metricKey] !== 0) {
      return { value: targets[metricKey], direction: targetDirections[metricKey] || metricDef.targetDirection, source: 'manual' };
    }

    // 2. Fallback to forecast
    const forecastValue = getForecastTarget(metricKey, monthId);
    if (forecastValue !== null) {
      return { value: forecastValue, direction: metricDef.targetDirection, source: 'forecast' };
    }

    return null;
  }, [trendTargets, targets, targetDirections, getForecastTarget, isQuarterTrendMode, isMonthlyTrendMode]);
  
  // Toggle metric expansion
  const toggleMetricExpansion = useCallback((metricKey: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricKey)) {
        next.delete(metricKey);
      } else {
        next.add(metricKey);
      }
      return next;
    });
  }, []);
  const FINANCIAL_METRICS = useMemo(() => {
    const metrics = getMetricsForBrand(storeBrand);

    // Filter out semi fixed expense metrics for Stellantis Service/Parts departments
    const isStellantis = storeBrand?.toLowerCase().includes('stellantis') || false;
    const isKTRV = storeBrand?.toLowerCase().includes('ktrv') || false;
    const isServiceOrParts = departmentName ? ['service', 'parts'].some(d => departmentName.toLowerCase().includes(d)) : false;

    console.log('Financial metrics filtering:', {
      storeBrand,
      departmentName,
      isStellantis,
      isKTRV,
      isServiceOrParts,
      willFilter: (isStellantis || isKTRV) && isServiceOrParts
    });

    const filtered = ((isStellantis || isKTRV) && isServiceOrParts)
      ? metrics.filter(m => !['semi_fixed_expense', 'semi_fixed_expense_percent'].includes(m.key))
      : metrics;

    // Defensive: ensure we never render duplicate metric rows (same key) even if configs change.
    const seen = new Set<string>();
    return filtered.filter((m) => {
      if (seen.has(m.key)) return false;
      seen.add(m.key);
      return true;
    });
  }, [storeBrand, departmentName]);

  // Check if brand is Honda
  const isHondaBrand = useMemo(() => {
    return storeBrand?.toLowerCase().includes('honda') || false;
  }, [storeBrand]);

  // Helper to check if a calculated metric should use its standard calculation for a given month
  // For Honda legacy months (before Nov 2025): Semi Fixed Expense is manual, Total Direct Expenses is calculated
  // For Honda Nov 2025+: Total Direct Expenses is manual, Semi Fixed Expense is calculated
  const shouldUseCalculationForMonth = (metricKey: string, monthIdentifier: string): boolean => {
    if (!isHondaBrand) return true;
    
    const isLegacy = isHondaLegacyMonth(monthIdentifier);
    
    // For legacy months: Semi Fixed Expense is manual entry (no calculation)
    if (metricKey === 'semi_fixed_expense' && isLegacy) {
      return false;
    }
    
    // For Nov 2025+: Total Direct Expenses uses standard behavior (no special calculation needed, it's manual entry)
    // For legacy months: Total Direct Expenses = Sales Expense + Semi Fixed Expense (reverse calculation)
    // We handle the reverse calculation separately, so return false here to skip standard calculation
    if (metricKey === 'total_direct_expenses') {
      return false; // Total Direct Expenses doesn't have a standard calculation in HONDA_METRICS
    }
    
    return true;
  };

  // Helper to calculate Total Direct Expenses for Honda legacy months (Sales Expense + Semi Fixed Expense)
  const getHondaLegacyTotalDirectExpenses = (monthIdentifier: string, getValueFn: (key: string) => number | undefined): number | undefined => {
    if (!isHondaBrand || !isHondaLegacyMonth(monthIdentifier)) {
      return undefined;
    }
    
    const salesExpense = getValueFn('sales_expense');
    const semiFixedExpense = getValueFn('semi_fixed_expense');
    
    if (salesExpense !== undefined && semiFixedExpense !== undefined) {
      return salesExpense + semiFixedExpense;
    }
    
    return undefined;
  };

  // Helper to get a metric value, falling back to sub-metric sum if no manual entry exists
  // This is used for metrics like Total Sales, GP Net, Sales Expense that may have sub-metrics
  // IMPORTANT: For calculated metrics (like semi_fixed_expense for Nissan), we should NOT use 
  // sub-metric sums as fallback for the base metrics (like total_direct_expenses) because
  // those sub-metrics may represent only a portion of the total (e.g., just the expense items,
  // not the full total_direct_expenses which includes sales_expense).
  const getValueWithSubMetricFallback = useCallback((metricKey: string, monthIdentifier: string, skipSubMetricSum: boolean = false): number | undefined => {
    const entryKey = `${metricKey}-${monthIdentifier}`;
    const existingValue = entries[entryKey];
    
    // If value exists in entries, ALWAYS return it - stored values take precedence
    if (existingValue !== null && existingValue !== undefined) {
      return existingValue;
    }

    // Only try sub-metric sum if not explicitly skipped.
    // Additionally: never use sub-metric sum for Total Direct Expenses because its sub-metrics
    // typically represent only the semi-fixed portion (and exclude Sales Expense), which would
    // corrupt downstream calculations like Nissan Semi Fixed Expense.
    const shouldSkipSubMetricSum = skipSubMetricSum || metricKey === 'total_direct_expenses';

    if (!shouldSkipSubMetricSum) {
      const subMetricSum = getSubMetricSum(metricKey, monthIdentifier);
      if (subMetricSum !== null) {
        return subMetricSum;
      }
    }

    return undefined;
  }, [entries, getSubMetricSum]);

  // Calculate the month with highest department profit in current year
  const highestProfitMonth = useMemo(() => {
    // Generate all months for the current year, not just displayed ones
    const allCurrentYearMonths = Array.from({ length: 12 }, (_, i) => {
      const monthNum = String(i + 1).padStart(2, '0');
      return {
        identifier: `${year}-${monthNum}`,
        label: new Date(year, i).toLocaleString('default', { month: 'short' })
      };
    });
    if (allCurrentYearMonths.length === 0) return null;

    const departmentProfitMetric = FINANCIAL_METRICS.find(m => m.key === 'department_profit');
    if (!departmentProfitMetric) return null;

    const getValueForMetric = (metricKey: string, monthIdentifier: string): number | undefined => {
      const entryKey = `${metricKey}-${monthIdentifier}`;
      const existingValue = entries[entryKey];
      
      if (existingValue !== null && existingValue !== undefined) {
        return existingValue;
      }
      
      const sourceMetric = FINANCIAL_METRICS.find(m => m.key === metricKey);
      if (!sourceMetric || !sourceMetric.calculation) {
        return undefined;
      }
      
      if (sourceMetric.type === "dollar" && 'type' in sourceMetric.calculation && (sourceMetric.calculation.type === 'subtract' || sourceMetric.calculation.type === 'complex')) {
        const baseValue = getValueForMetric(sourceMetric.calculation.base, monthIdentifier);
        if (baseValue === null || baseValue === undefined) return undefined;
        
        let calculatedValue = baseValue;
        for (const deduction of sourceMetric.calculation.deductions) {
          const deductionValue = getValueForMetric(deduction, monthIdentifier);
          calculatedValue -= (deductionValue || 0);
        }
        
        if (sourceMetric.calculation.type === 'complex' && 'additions' in sourceMetric.calculation) {
          for (const addition of sourceMetric.calculation.additions) {
            const additionValue = getValueForMetric(addition, monthIdentifier);
            calculatedValue += (additionValue || 0);
          }
        }
        
        return calculatedValue;
      }
      
      return undefined;
    };

    let maxProfit = -Infinity;
    let maxMonth: string | null = null;

    for (const month of allCurrentYearMonths) {
      const profitValue = getValueForMetric('department_profit', month.identifier);
      if (profitValue !== null && profitValue !== undefined && profitValue > maxProfit) {
        maxProfit = profitValue;
        maxMonth = month.identifier;
      }
    }

    return maxMonth;
  }, [year, entries, FINANCIAL_METRICS]);

  // Calculate highest profit months per year for Monthly Trend view
  const highestProfitMonthsByYear = useMemo(() => {
    if (!isMonthlyTrendMode) return {};
    
    const result: { [year: number]: string } = {};
    const yearsToCheck = [year - 1, year];
    
    yearsToCheck.forEach(checkYear => {
      let maxProfit = -Infinity;
      let maxMonthKey: string | null = null;
      
      for (let m = 0; m < 12; m++) {
        const mKey = `department_profit-M${m + 1}-${checkYear}`;
        const val = precedingQuartersData[mKey];
        
        if (val !== null && val !== undefined && val > maxProfit) {
          maxProfit = val;
          maxMonthKey = `${checkYear}-${String(m + 1).padStart(2, '0')}`;
        }
      }
      
      if (maxMonthKey && maxProfit > -Infinity) {
        result[checkYear] = maxMonthKey;
      }
    });
    
    return result;
  }, [isMonthlyTrendMode, year, precedingQuartersData]);

  // Track current user ID for realtime filtering
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      await loadUserRole();
      await loadStoreBrand();
      loadFinancialData();
      loadTargets();
    };
    loadData();
  }, [departmentId, year, quarter]);

  // Real-time subscription for financial entries
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`financial-realtime-${departmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "financial_entries",
          filter: `department_id=eq.${departmentId}`,
        },
        async (payload) => {
          const rowNew = payload.eventType !== "DELETE" ? (payload.new as any) : null;
          const rowOld = payload.eventType === "DELETE" ? (payload.old as any) : null;

          // Identify the affected cell key
          const metricName = rowNew?.metric_name ?? rowOld?.metric_name;
          const monthId = rowNew?.month ?? rowOld?.month;
          if (!metricName || !monthId) return;

          const cellKey = `${metricName}-${monthId}`;

          // If the user is actively editing or saving this cell, do not overwrite.
          // Using ref instead of state to avoid recreating subscription on every focus/blur
          // Also check saveTimeoutRef - after Enter, focus moves to next cell but save is still in progress
          if (activeCellRef.current === cellKey || saveTimeoutRef.current[cellKey]) {
            return;
          }

          // Apply minimal in-place updates to avoid full reload flicker while editing.
          if (payload.eventType === "DELETE") {
            setEntries((prev) => {
              const next = { ...prev };
              delete next[cellKey];
              return next;
            });
            setNotes((prev) => {
              const next = { ...prev };
              delete next[cellKey];
              return next;
            });
          } else {
            const nextValue = rowNew?.value;
            setEntries((prev) => ({ ...prev, [cellKey]: nextValue ?? 0 }));

            const nextNotes = rowNew?.notes;
            setNotes((prev) => {
              const next = { ...prev };
              if (typeof nextNotes === "string" && nextNotes.length > 0) next[cellKey] = nextNotes;
              else delete next[cellKey];
              return next;
            });
          }

          // Debounce reload of quarter aggregates to prevent rapid-fire requests during imports
          if (precedingDataDebounceRef.current) {
            clearTimeout(precedingDataDebounceRef.current);
          }
          precedingDataDebounceRef.current = setTimeout(() => {
            loadPrecedingQuartersDataRef.current();
          }, 500);

          // Toast only for updates that are clearly from someone else
          if (
            currentUserId &&
            payload.eventType !== "DELETE" &&
            rowNew?.created_by &&
            rowNew.created_by !== currentUserId &&
            (payload.eventType === "UPDATE" || payload.eventType === "INSERT")
          ) {
            const metric = FINANCIAL_METRICS.find((m) => m.key === metricName);
            toast({
              title: "Financial data updated",
              description: `${metric?.name || metricName} was updated by another user`,
              duration: 3000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (precedingDataDebounceRef.current) {
        clearTimeout(precedingDataDebounceRef.current);
      }
    };
    // Note: activeCellRef is a ref (not state), so no need to include in dependencies
  }, [departmentId, currentUserId, FINANCIAL_METRICS]);

   // Keep ref in sync so the realtime handler always calls the latest version
  useEffect(() => {
    loadPrecedingQuartersDataRef.current = loadPrecedingQuartersData;
  });

  // Load preceding quarters data after FINANCIAL_METRICS is available
  useEffect(() => {
    if (storeBrand !== null) {
      loadPrecedingQuartersData();
    }
  }, [departmentId, year, quarter, storeBrand, FINANCIAL_METRICS]);

  useEffect(() => {
    loadTargets();
  }, [targetYear]);

  const loadUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First check user_roles table for actual roles
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (!roleError && roleData && roleData.length > 0) {
      // Prioritize roles: super_admin > store_gm > department_manager
      if (roleData.some(r => r.role === 'super_admin')) {
        setUserRole('super_admin');
        return;
      }
      if (roleData.some(r => r.role === 'store_gm')) {
        setUserRole('store_gm');
        return;
      }
      if (roleData.some(r => r.role === 'department_manager' || r.role === 'fixed_ops_manager')) {
        setUserRole('department_manager');
        return;
      }
    }

    // Fallback to profile role if no user_roles found
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setUserRole(data.role);
    }
  };

  const loadStoreBrand = async () => {
    if (!departmentId) return;

    const { data: department } = await supabase
      .from("departments")
      .select("name, store_id")
      .eq("id", departmentId)
      .single();

    if (department) {
      setDepartmentName(department.name);
      
      if (department.store_id) {
        setStoreId(department.store_id);
        const { data: store } = await supabase
          .from("stores")
          .select("brand, brand_id, brands(name)")
          .eq("id", department.store_id)
          .single();

        // Use brand from relationship if available, fallback to text field
        // Handle both array and object formats from Supabase relationship
        const brands = store?.brands;
        let brandName: string | null = null;
        if (Array.isArray(brands) && brands.length > 0) {
          brandName = brands[0].name;
        } else if (brands && typeof brands === 'object') {
          brandName = (brands as any).name;
        }
        if (!brandName) {
          brandName = store?.brand || null;
        }
        console.log('Loaded brand name:', brandName, 'for store:', store);
        setStoreBrand(brandName);
      }
    }
  };

  // Update local values when entries change - sync from database
  useEffect(() => {
    setLocalValues(prev => {
      const updated = { ...prev };
      // Sync entries to localValues, but keep values that have pending saves
      Object.entries(entries).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Only skip if there's an active save timeout for this key
          if (!saveTimeoutRef.current[key]) {
            updated[key] = value.toString();
          } else {
            console.log('[Sync] Skipping update for key (save in progress):', key);
          }
        }
      });
      // Clear localValues for keys that exist in localValues but NOT in entries
      // This handles the case where data was deleted or replaced by import
      Object.keys(prev).forEach(key => {
        if (entries[key] === undefined && !saveTimeoutRef.current[key]) {
          // Only clear if this is a metric-month key format (contains dash)
          // AND the localValue is not empty string (user might be actively deleting)
          if (key.includes('-') && prev[key] !== '') {
            console.log('[Sync] Clearing localValue for key (not in entries):', key, 'prev value:', prev[key]);
            delete updated[key];
          }
        }
      });
      return updated;
    });
  }, [entries]);

  const loadTargets = async () => {
    if (!departmentId) return;
    
    // For trend modes, load all targets for all quarters/years
    if (isQuarterTrendMode || isMonthlyTrendMode) {
      const { data, error } = await supabase
        .from("financial_targets")
        .select("*")
        .eq("department_id", departmentId);
      
      if (error) {
        console.error("Error loading trend targets:", error);
        return;
      }
      
      const trendTargetsMap: { [metricKey: string]: { [quarterYear: string]: { value: number; direction: "above" | "below" } } } = {};
      data?.forEach(target => {
        if (!trendTargetsMap[target.metric_name]) {
          trendTargetsMap[target.metric_name] = {};
        }
        trendTargetsMap[target.metric_name][`Q${target.quarter}-${target.year}`] = {
          value: target.target_value || 0,
          direction: (target.target_direction as "above" | "below") || "above"
        };
      });
      
      setTrendTargets(trendTargetsMap);
      
      // Also load targets for the Set Targets dialog (organized by targetYear)
      const editMapByQuarter: { [quarter: number]: { [key: string]: string } } = { 1: {}, 2: {}, 3: {}, 4: {} };
      const editDirectionsMapByQuarter: { [quarter: number]: { [key: string]: "above" | "below" } } = { 1: {}, 2: {}, 3: {}, 4: {} };
      
      data?.forEach(target => {
        if (target.year === targetYear) {
          editMapByQuarter[target.quarter][target.metric_name] = target.target_value?.toString() || "";
          editDirectionsMapByQuarter[target.quarter][target.metric_name] = (target.target_direction as "above" | "below") || "above";
        }
      });
      
      // Fill in default directions for metrics without saved targets
      [1, 2, 3, 4].forEach(q => {
        FINANCIAL_METRICS.forEach(metric => {
          if (!editDirectionsMapByQuarter[q][metric.key]) {
            editDirectionsMapByQuarter[q][metric.key] = metric.targetDirection;
          }
        });
      });
      
      setEditTargets(editMapByQuarter);
      setEditTargetDirections(editDirectionsMapByQuarter);
      return;
    }

    console.log(`Loading targets for department ${departmentId}, year ${year}, quarter ${quarter}`);

    // Load targets for current year display
    const { data, error } = await supabase
      .from("financial_targets")
      .select("*")
      .eq("department_id", departmentId)
      .eq("year", year);
    
    console.log("Loaded targets data:", data);

    if (error) {
      console.error("Error loading targets:", error);
      return;
    }

    // Targets for current quarter display
    const targetsMap: { [key: string]: number } = {};
    const directionsMap: { [key: string]: "above" | "below" } = {};
    
    data?.forEach(target => {
      // Set current quarter targets for display
      if (target.quarter === quarter) {
        targetsMap[target.metric_name] = target.target_value || 0;
        directionsMap[target.metric_name] = (target.target_direction as "above" | "below") || "above";
      }
    });
    
    console.log(`Targets for Q${quarter}:`, targetsMap);

    // Load targets for the previous year's same quarter
    const { data: precedingData, error: precedingError } = await supabase
      .from("financial_targets")
      .select("*")
      .eq("department_id", departmentId)
      .eq("year", year - 1)
      .eq("quarter", quarter);

    if (precedingError) {
      console.error("Error loading preceding quarter targets:", precedingError);
    }

    const precedingTargetsMap: { [key: string]: { value: number; direction: "above" | "below" } } = {};
    precedingData?.forEach(target => {
      const key = `${target.metric_name}-Q${target.quarter}-${target.year}`;
      precedingTargetsMap[key] = {
        value: target.target_value || 0,
        direction: (target.target_direction as "above" | "below") || "above"
      };
    });

    setPrecedingQuarterTargets(precedingTargetsMap);

    // Load targets for target year editing
    const { data: targetYearData, error: targetYearError } = await supabase
      .from("financial_targets")
      .select("*")
      .eq("department_id", departmentId)
      .eq("year", targetYear);

    if (targetYearError) {
      console.error("Error loading target year data:", targetYearError);
      return;
    }

    // Targets organized by quarter for editing
    const editMapByQuarter: { [quarter: number]: { [key: string]: string } } = { 1: {}, 2: {}, 3: {}, 4: {} };
    const editDirectionsMapByQuarter: { [quarter: number]: { [key: string]: "above" | "below" } } = { 1: {}, 2: {}, 3: {}, 4: {} };
    
    targetYearData?.forEach(target => {
      // Set all quarters' targets for editing
      editMapByQuarter[target.quarter][target.metric_name] = target.target_value?.toString() || "";
      editDirectionsMapByQuarter[target.quarter][target.metric_name] = (target.target_direction as "above" | "below") || "above";
    });

    // Fill in default directions for metrics without saved targets
    [1, 2, 3, 4].forEach(q => {
      FINANCIAL_METRICS.forEach(metric => {
        if (!editDirectionsMapByQuarter[q][metric.key]) {
          editDirectionsMapByQuarter[q][metric.key] = metric.targetDirection;
        }
        if (q === quarter && !directionsMap[metric.key]) {
          directionsMap[metric.key] = metric.targetDirection;
        }
      });
    });

    setTargets(targetsMap);
    setEditTargets(editMapByQuarter);
    setTargetDirections(directionsMap);
    setEditTargetDirections(editDirectionsMapByQuarter);
  };

  const handleSaveTargets = async () => {
    // First, delete all existing targets for this department and year
    const { error: deleteError } = await supabase
      .from("financial_targets")
      .delete()
      .eq("department_id", departmentId)
      .eq("year", targetYear);

    if (deleteError) {
      toast({ title: "Error", description: "Failed to clear existing targets", variant: "destructive" });
      return;
    }

    // Then insert only the non-zero targets
    const updates = [1, 2, 3, 4].flatMap(q => 
      FINANCIAL_METRICS.filter(metric => {
        const value = editTargets[q]?.[metric.key];
        // Only save if value exists, is not empty string, and is not zero
        return value !== undefined && value !== null && value !== "" && parseFloat(value) !== 0;
      }).map(metric => ({
        department_id: departmentId,
        metric_name: metric.key,
        target_value: parseFloat(editTargets[q]?.[metric.key]),
        target_direction: editTargetDirections[q]?.[metric.key] || metric.targetDirection,
        quarter: q,
        year: targetYear,
      }))
    );

    console.log("Saving targets:", updates);

    if (updates.length > 0) {
      const { error } = await supabase
        .from("financial_targets")
        .insert(updates);

      if (error) {
        toast({ title: "Error", description: "Failed to save targets", variant: "destructive" });
        return;
      }
    }

    toast({ title: "Success", description: "Targets saved successfully" });
    setTargetsDialogOpen(false);
    // Reload targets and preceding quarter data to refresh the display
    await loadTargets();
    await loadPrecedingQuartersData();
  };

  const loadPrecedingQuartersData = async () => {
    if (!departmentId) return;

    const requestId = ++precedingDataRequestIdRef.current;

    if (isMonthlyTrendMode) {
      // Load data for all months in the monthly trend in a single query
      const averages: { [key: string]: number } = {};
      
      // Get month identifiers from the trend periods
      const trendMonthIdentifiers = monthlyTrendPeriods
        .filter(m => m.type === 'month')
        .map(m => m.identifier);
      
      // Also include ALL 12 months of the previous year for full year averages/totals
      const prevYear = year - 1;
      const allPrevYearMonthIds: string[] = [];
      for (let m = 1; m <= 12; m++) {
        allPrevYearMonthIds.push(`${prevYear}-${String(m).padStart(2, '0')}`);
      }
      
      // Also include ALL 12 months of the current year for YTD calculations
      const allCurrentYearMonthIds: string[] = [];
      for (let m = 1; m <= 12; m++) {
        allCurrentYearMonthIds.push(`${year}-${String(m).padStart(2, '0')}`);
      }
      
      // Combine all month identifiers and dedupe
      const allMonthIdentifiers = [...new Set([...trendMonthIdentifiers, ...allPrevYearMonthIds, ...allCurrentYearMonthIds])];
      
      // Fetch all rows by paginating to avoid the 1000 row limit (sub-metrics create large datasets)
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error: pageError } = await supabase
          .from("financial_entries")
          .select("*")
          .eq("department_id", departmentId)
          .in("month", allMonthIdentifiers)
          .range(from, from + pageSize - 1);

        if (pageError) {
          throw pageError;
        }

        allRows.push(...(page || []));
        from += pageSize;
        hasMore = (page?.length || 0) === pageSize;
      }

      const data = allRows;
      const error = null as any;

      if (error) {
        console.error("Error loading monthly trend data:", error);
      } else {
        // Helper to get value from either raw data or already calculated values
        const getValueForMetricByIdentifier = (monthIdentifier: string, metricKey: string): number | undefined => {
          const entry = data?.find(e => e.month === monthIdentifier && e.metric_name === metricKey);
          return entry?.value;
        };
        
        // Process all 12 months for each year that we need summaries for
        const yearsToProcess = [prevYear, year];
        
        yearsToProcess.forEach(processYear => {
          for (let m = 0; m < 12; m++) {
            const monthIdentifier = `${processYear}-${String(m + 1).padStart(2, '0')}`;
            const monthData = data?.filter(e => e.month === monthIdentifier);
            
            // Create a month object for compatibility
            const monthObj = { month: m, year: processYear };
            
            // Helper to get value from raw data, sub-metric sum, or already calculated values
            const getValueForMetric = (mData: any[], mKey: string, mObj: any): number | undefined => {
              // First check if already calculated
              const calculatedKey = `${mKey}-M${mObj.month + 1}-${mObj.year}`;
              if (averages[calculatedKey] !== undefined) {
                return averages[calculatedKey];
              }
              // Check raw data entry
              const entry = mData?.find(e => e.metric_name === mKey);
              if (entry?.value !== null && entry?.value !== undefined) {
                return entry.value;
              }
              // Try to sum sub-metrics (e.g., sub:sales_expense:027:... + sub:sales_expense:028:... etc.)
              const subMetricPrefix = `sub:${mKey}:`;
              const subMetrics = mData?.filter(e => 
                e.metric_name.startsWith(subMetricPrefix) && 
                !e.metric_name.includes('_percent:')
              );
              if (subMetrics && subMetrics.length > 0) {
                const sum = subMetrics.reduce((acc: number, e: any) => acc + (e.value || 0), 0);
                return sum;
              }
              return undefined;
            };
            
            FINANCIAL_METRICS.forEach(metric => {
              const metricEntry = monthData?.find(e => e.metric_name === metric.key);
              
              if (metricEntry && metricEntry.value !== null && metricEntry.value !== undefined) {
                const mKey = `${metric.key}-M${monthObj.month + 1}-${monthObj.year}`;
                averages[mKey] = metricEntry.value;
              } else if (metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation) {
                // Calculate percentage metrics from underlying dollar amounts
                const { numerator, denominator } = metric.calculation;
                
                const numValue = getValueForMetric(monthData, numerator, monthObj);
                const denValue = getValueForMetric(monthData, denominator, monthObj);
                
                if (numValue !== undefined && denValue !== undefined && denValue > 0) {
                  const calculatedPercentage = (numValue / denValue) * 100;
                  const mKey = `${metric.key}-M${monthObj.month + 1}-${monthObj.year}`;
                  averages[mKey] = calculatedPercentage;
                }
              } else if (metric.calculation && 'type' in metric.calculation) {
                // Calculate dollar metrics (subtract or complex)
                const calc = metric.calculation;
                const baseValue = getValueForMetric(monthData, calc.base, monthObj);
                
                if (baseValue !== null && baseValue !== undefined) {
                  let calculatedValue = baseValue;
                  
                  for (const deduction of calc.deductions) {
                    const deductValue = getValueForMetric(monthData, deduction, monthObj);
                    if (deductValue !== null && deductValue !== undefined) {
                      calculatedValue -= deductValue;
                    }
                  }
                  
                  if (calc.type === 'complex' && 'additions' in calc) {
                    for (const addition of calc.additions) {
                      const addValue = getValueForMetric(monthData, addition, monthObj);
                      if (addValue !== null && addValue !== undefined) {
                        calculatedValue += addValue;
                      }
                    }
                  }
                  
                  const mKey = `${metric.key}-M${monthObj.month + 1}-${monthObj.year}`;
                  averages[mKey] = calculatedValue;
                }
              } else {
                // For non-calculated metrics without direct entries, try to sum sub-metrics
                const subMetricSum = getValueForMetric(monthData, metric.key, monthObj);
                if (subMetricSum !== undefined) {
                  const mKey = `${metric.key}-M${monthObj.month + 1}-${monthObj.year}`;
                  averages[mKey] = subMetricSum;
                }
              }
            });
            
            // Also store individual sub-metric entries for LY tooltip lookups
            // Key format: sub:{parent}:{name}-M{month}-{year}  (without order index, for simpler lookup)
            if (monthData) {
              for (const entry of monthData) {
                if (entry.metric_name?.startsWith('sub:') && entry.value !== null && entry.value !== undefined) {
                  // Extract parent and name from metric_name like "sub:total_sales:001:Civic"
                  const parts = entry.metric_name.split(':');
                  if (parts.length >= 4) {
                    const parentKey = parts[1];
                    const subName = parts.slice(3).join(':'); // Handle names with colons
                    const smKey = `sub:${parentKey}:${subName}-M${monthObj.month + 1}-${monthObj.year}`;
                    averages[smKey] = entry.value;
                  }
                }
              }
            }
            
            // Synthesize percentage sub-metrics from dollar sub-metrics when not stored directly
            // e.g., sub:gp_percent:NAME = (sub:gp_net:NAME / sub:total_sales:NAME) * 100
            FINANCIAL_METRICS.forEach(metric => {
              if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
                const { numerator, denominator } = metric.calculation;
                // Find all numerator sub-metric names stored for this month
                const prefix = `sub:${numerator}:`;
                const suffix = `-M${monthObj.month + 1}-${monthObj.year}`;
                for (const key of Object.keys(averages)) {
                  if (key.startsWith(prefix) && key.endsWith(suffix)) {
                    const subName = key.slice(prefix.length, key.length - suffix.length);
                    const pctKey = `sub:${metric.key}:${subName}${suffix}`;
                    // Only synthesize if not already stored
                    if (averages[pctKey] === undefined) {
                      const numVal = averages[key];
                      const denKey = `sub:${denominator}:${subName}${suffix}`;
                      const denVal = averages[denKey];
                      if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
                        averages[pctKey] = (numVal / denVal) * 100;
                      } else if (numVal !== undefined) {
                        const parentDenKey = `${denominator}${suffix}`;
                        const parentDenVal = averages[parentDenKey];
                        if (parentDenVal !== undefined && parentDenVal !== 0) {
                          averages[pctKey] = (numVal / parentDenVal) * 100;
                        }
                      }
                    }
                  }
                }
              }
            });
          }
        });
      }
      
      // Only apply if this is still the latest request
      if (requestId !== precedingDataRequestIdRef.current) {
        console.log('[loadPrecedingQuartersData] Monthly trend - stale request, discarding');
        return;
      }
      setPrecedingQuartersData(averages);
      return;
    }

    if (isQuarterTrendMode) {
      // Load data for all quarters in the trend in a single query
      const averages: { [key: string]: number } = {};
      
      // Collect all month identifiers for all quarters
      const allQuarterMonthIds: string[] = [];
      const quarterMonthsMap: { [key: string]: string[] } = {};
      
      quarterTrendPeriods.forEach(qtr => {
        const quarterMonths = getQuarterMonthsForCalculation(qtr.quarter, qtr.year);
        const monthIds = quarterMonths.map(m => m.identifier);
        const qKey = `Q${qtr.quarter}-${qtr.year}`;
        quarterMonthsMap[qKey] = monthIds;
        allQuarterMonthIds.push(...monthIds);
      });
      
      // Single query to fetch all data (paginate to avoid 1000 row limit)
      const allRows: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error: pageError } = await supabase
          .from("financial_entries")
          .select("*")
          .eq("department_id", departmentId)
          .in("month", allQuarterMonthIds)
          .range(from, from + pageSize - 1);

        if (pageError) {
          throw pageError;
        }

        allRows.push(...(page || []));
        from += pageSize;
        hasMore = (page?.length || 0) === pageSize;
      }

      const data = allRows;
      const error = null as any;

      if (error) {
        console.error("Error loading quarter trend data:", error);
      } else {
        // Process each quarter
        quarterTrendPeriods.forEach(qtr => {
          const qKey = `Q${qtr.quarter}-${qtr.year}`;
          const quarterMonthIds = quarterMonthsMap[qKey];
          
          // Helper functions to calculate month-aware metric values (Honda legacy logic included)
          const getDirectValueForMonth = (metricKey: string, monthId: string): number | undefined => {
            // Check raw data entry first
            const entry = data?.find(e => e.month === monthId && e.metric_name === metricKey);
            if (entry?.value !== null && entry?.value !== undefined) {
              return Number(entry.value);
            }
            // Try to sum sub-metrics (e.g., sub:sales_expense:027:... + sub:sales_expense:028:... etc.)
            const subMetricPrefix = `sub:${metricKey}:`;
            const subMetrics = data?.filter(e => 
              e.month === monthId && 
              e.metric_name.startsWith(subMetricPrefix) && 
              !e.metric_name.includes('_percent:')
            );
            if (subMetrics && subMetrics.length > 0) {
              const sum = subMetrics.reduce((acc: number, e: any) => acc + (e.value || 0), 0);
              return sum;
            }
            return undefined;
          };

          const getMonthValue = (metricKey: string, monthId: string): number | undefined => {
            // First, use direct DB value when present
            const direct = getDirectValueForMonth(metricKey, monthId);
            if (direct !== undefined) return direct;

            // Honda legacy rule: Total Direct Expenses = Sales Expense + Semi Fixed Expense (pre Nov 2025)
            if (isHondaBrand && metricKey === 'total_direct_expenses' && isHondaLegacyMonth(monthId)) {
              const sales = getMonthValue('sales_expense', monthId);
              const semiFixed = getMonthValue('semi_fixed_expense', monthId);
              if (sales !== undefined && semiFixed !== undefined) return sales + semiFixed;
              return undefined;
            }

            const metric = FINANCIAL_METRICS.find(m => m.key === metricKey);
            if (!metric || !metric.calculation) return undefined;

            // Honda legacy rule: Semi Fixed Expense is manual entry in legacy months
            if (isHondaBrand && metricKey === 'semi_fixed_expense' && isHondaLegacyMonth(monthId)) {
              return undefined;
            }

            if ('type' in metric.calculation) {
              const calc = metric.calculation;
              const base = getMonthValue(calc.base, monthId);
              if (base === undefined) return undefined;

              let value = base;
              for (const deduction of calc.deductions) {
                const d = getMonthValue(deduction, monthId);
                if (d !== undefined) value -= d;
              }

              if (calc.type === 'complex' && 'additions' in calc) {
                for (const addition of calc.additions) {
                  const a = getMonthValue(addition, monthId);
                  if (a !== undefined) value += a;
                }
              }

              return value;
            }

            // Percentage calculations are handled separately in Quarter Trend
            return undefined;
          };

          // Quarter total across months (used for quarter-average rendering)
          const getMetricTotal = (metricKey: string, monthIds: string[]): number => {
            return monthIds.reduce((sum, monthId) => {
              const v = getMonthValue(metricKey, monthId);
              return sum + (v ?? 0);
            }, 0);
          };

          // Count how many months have data in this quarter
          const monthsWithData = new Set<string>();
          data?.forEach(entry => {
            if (quarterMonthIds.includes(entry.month) && entry.value !== null) {
              monthsWithData.add(entry.month);
            }
          });
          const monthCount = monthsWithData.size || 1; // Avoid division by zero

          // Helper to count months with actual values for a specific metric (including calculated values)
          const getMonthsWithMetricData = (metricKey: string, monthIds: string[]): number => {
            let count = 0;
            for (const monthId of monthIds) {
              const val = getMonthValue(metricKey, monthId);
              if (val !== undefined) {
                count++;
              }
            }
            return count; // may be 0
          };

          // Calculate averages per metric for this quarter
          FINANCIAL_METRICS.forEach(metric => {
            // For percentage metrics, recalculate from underlying dollar amounts
            if (metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation) {
              const { numerator, denominator } = metric.calculation;
              
              const totalNumerator = getMetricTotal(numerator, quarterMonthIds);
              const totalDenominator = getMetricTotal(denominator, quarterMonthIds);
              
              if (totalDenominator > 0) {
                const calculatedPercentage = (totalNumerator / totalDenominator) * 100;
                averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = calculatedPercentage;
              }
            } else if (metric.calculation) {
              // For calculated dollar metrics
              const metricMonthCount = getMonthsWithMetricData(metric.key, quarterMonthIds);
              if (metricMonthCount > 0) {
                const total = getMetricTotal(metric.key, quarterMonthIds);
                const avg = total / metricMonthCount;
                averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
              }
            } else {
              // For direct database values - use getMonthValue which includes sub-metric sums
              const metricMonthCount = getMonthsWithMetricData(metric.key, quarterMonthIds);
              if (metricMonthCount > 0) {
                const total = getMetricTotal(metric.key, quarterMonthIds);
                const avg = total / metricMonthCount;
                averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
              }
            }
          });
          
          // Also store individual sub-metric quarter averages for LY tooltip lookups
          // Collect all sub-metric entries for this quarter, group by normalized name, and average
          const subMetricMonthlyValues: Record<string, number[]> = {};
          for (const monthId of quarterMonthIds) {
            const monthEntries = data?.filter(e => e.month === monthId && e.metric_name?.startsWith('sub:'));
            if (monthEntries) {
              for (const entry of monthEntries) {
                if (entry.value === null || entry.value === undefined) continue;
                const parts = entry.metric_name.split(':');
                if (parts.length >= 4) {
                  const parentKey = parts[1];
                  const subName = parts.slice(3).join(':');
                  const normalizedKey = `sub:${parentKey}:${subName}`;
                  if (!subMetricMonthlyValues[normalizedKey]) subMetricMonthlyValues[normalizedKey] = [];
                  subMetricMonthlyValues[normalizedKey].push(entry.value);
                }
              }
            }
          }
          for (const [normalizedKey, values] of Object.entries(subMetricMonthlyValues)) {
            if (values.length > 0) {
              const avg = values.reduce((s, v) => s + v, 0) / values.length;
              averages[`${normalizedKey}-Q${qtr.quarter}-${qtr.year}`] = avg;
            }
          }
          
          // Synthesize percentage sub-metric quarter averages from dollar sub-metrics
          FINANCIAL_METRICS.forEach(metric => {
            if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
              const { numerator, denominator } = metric.calculation;
              const prefix = `sub:${numerator}:`;
              const suffix = `-Q${qtr.quarter}-${qtr.year}`;
              for (const key of Object.keys(averages)) {
                if (key.startsWith(prefix) && key.endsWith(suffix)) {
                  const subName = key.slice(prefix.length, key.length - suffix.length);
                  const pctKey = `sub:${metric.key}:${subName}${suffix}`;
                  if (averages[pctKey] === undefined) {
                    const numVal = averages[key];
                    const denKey = `sub:${denominator}:${subName}${suffix}`;
                    const denVal = averages[denKey];
                    if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
                      averages[pctKey] = (numVal / denVal) * 100;
                    } else if (numVal !== undefined) {
                      const parentDenKey = `${denominator}${suffix}`;
                      const parentDenVal = averages[parentDenKey];
                      if (parentDenVal !== undefined && parentDenVal !== 0) {
                        averages[pctKey] = (numVal / parentDenVal) * 100;
                      }
                    }
                  }
                }
              }
            }
          });
        });
      }
      
      // Only apply if this is still the latest request
      if (requestId !== precedingDataRequestIdRef.current) {
        console.log('[loadPrecedingQuartersData] Quarter trend - stale request, discarding');
        return;
      }
      setPrecedingQuartersData(averages);
      return;
    }

    // Original logic for non-trend mode: Load both previous year and current year quarter
    const prevYearQuarter = { quarter, year: year - 1 };
    const currentYearQuarter = { quarter, year };
    
    const prevYearMonths = getQuarterMonthsForCalculation(prevYearQuarter.quarter, prevYearQuarter.year);
    const currentYearMonths = getQuarterMonthsForCalculation(currentYearQuarter.quarter, currentYearQuarter.year);
    const allMonthIds = [...prevYearMonths.map(m => m.identifier), ...currentYearMonths.map(m => m.identifier)];

    // Paginate to avoid the 1000 row limit when sub-metrics create large datasets
    const allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error: pageError } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", allMonthIds)
        .range(from, from + pageSize - 1);

      if (pageError) {
        console.error("Error loading preceding quarters data:", pageError);
        return;
      }

      allRows.push(...(page || []));
      from += pageSize;
      hasMore = (page?.length || 0) === pageSize;
    }

    const data = allRows;

    // Helper function to recursively calculate metric values
    const getMetricTotal = (metricKey: string, quarterMonthIds: string[]): number => {
      const metric = FINANCIAL_METRICS.find(m => m.key === metricKey);
      if (!metric) return 0;
      
      // If it's a calculated metric
      if (metric.calculation) {
        if ('numerator' in metric.calculation) {
          // Percentage calculation - not needed here as we handle percentages separately
          return 0;
        } else if ('type' in metric.calculation) {
          // Dollar calculation (subtract or complex)
          const calc = metric.calculation;
          let total = getMetricTotal(calc.base, quarterMonthIds);
          
          for (const deduction of calc.deductions) {
            total -= getMetricTotal(deduction, quarterMonthIds);
          }
          
          if (calc.type === 'complex' && 'additions' in calc) {
            for (const addition of calc.additions) {
              total += getMetricTotal(addition, quarterMonthIds);
            }
          }
          
          return total;
        }
      }
      
      // Direct value from database (Honda legacy support for Total Direct Expenses)
      if (isHondaBrand && metricKey === 'total_direct_expenses') {
        return quarterMonthIds.reduce((sum, monthId) => {
          const direct = data?.find(e => e.month === monthId && e.metric_name === 'total_direct_expenses')?.value;
          if (direct !== null && direct !== undefined) return sum + Number(direct);

          // Legacy months: Total Direct Expenses = Sales Expense + Semi Fixed Expense
          if (isHondaLegacyMonth(monthId)) {
            const sales = data?.find(e => e.month === monthId && e.metric_name === 'sales_expense')?.value;
            const semiFixed = data?.find(e => e.month === monthId && e.metric_name === 'semi_fixed_expense')?.value;
            if (sales !== null && sales !== undefined && semiFixed !== null && semiFixed !== undefined) {
              return sum + Number(sales) + Number(semiFixed);
            }
          }

          return sum;
        }, 0);
      }

      // For each month, get direct value or fall back to sub-metric sum
      let total = 0;
      for (const monthId of quarterMonthIds) {
        // First try direct value
        const directEntry = data?.find(e => e.month === monthId && e.metric_name === metricKey);
        if (directEntry?.value !== null && directEntry?.value !== undefined) {
          total += Number(directEntry.value);
        } else {
          // Fall back to sub-metric sum
          const subMetricPrefix = `sub:${metricKey}:`;
          const subMetrics = data?.filter(e => 
            e.month === monthId && 
            e.metric_name.startsWith(subMetricPrefix) && 
            e.value !== null && e.value !== undefined
          ) || [];
          if (subMetrics.length > 0) {
            total += subMetrics.reduce((sum, e) => sum + Number(e.value), 0);
          }
        }
      }
      
      return total;
    };

    // Calculate averages per metric per quarter
    const averages: { [key: string]: number } = {};
    const quarterMonths = getQuarterMonthsForCalculation(prevYearQuarter.quarter, prevYearQuarter.year);
    const quarterMonthIds = quarterMonths.map(m => m.identifier);
    
    // Count how many months have data in this quarter
    const monthsWithData = new Set<string>();
    data?.forEach(entry => {
      if (quarterMonthIds.includes(entry.month) && entry.value !== null) {
        monthsWithData.add(entry.month);
      }
    });
    const monthCount = monthsWithData.size || 1; // Avoid division by zero
    
    FINANCIAL_METRICS.forEach(metric => {
      // For percentage metrics, recalculate from underlying dollar amounts
      if (metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation) {
        const { numerator, denominator } = metric.calculation;
        
        const totalNumerator = getMetricTotal(numerator, quarterMonthIds);
        const totalDenominator = getMetricTotal(denominator, quarterMonthIds);
        
        if (totalDenominator > 0) {
          const calculatedPercentage = (totalNumerator / totalDenominator) * 100;
          averages[`${metric.key}-Q${prevYearQuarter.quarter}-${prevYearQuarter.year}`] = calculatedPercentage;
        }
      } else if (metric.calculation) {
        // For calculated dollar metrics
        const total = getMetricTotal(metric.key, quarterMonthIds);
        if (total !== 0) {
          // Divide by actual number of months with data
          const avg = total / monthCount;
          averages[`${metric.key}-Q${prevYearQuarter.quarter}-${prevYearQuarter.year}`] = avg;
        }
      } else {
        // For direct database values
        // Honda legacy support: Total Direct Expenses may not be stored in legacy months
        if (isHondaBrand && metric.key === 'total_direct_expenses') {
          const metricMonthCount = quarterMonthIds.reduce((count, monthId) => {
            const direct = data?.find(e => e.month === monthId && e.metric_name === 'total_direct_expenses')?.value;
            if (direct !== null && direct !== undefined) return count + 1;

            if (isHondaLegacyMonth(monthId)) {
              const sales = data?.find(e => e.month === monthId && e.metric_name === 'sales_expense')?.value;
              const semiFixed = data?.find(e => e.month === monthId && e.metric_name === 'semi_fixed_expense')?.value;
              if (sales !== null && sales !== undefined && semiFixed !== null && semiFixed !== undefined) {
                return count + 1;
              }
            }

            return count;
          }, 0);

          if (metricMonthCount > 0) {
            const total = getMetricTotal(metric.key, quarterMonthIds);
            const avg = total / metricMonthCount;
            averages[`${metric.key}-Q${prevYearQuarter.quarter}-${prevYearQuarter.year}`] = avg;
          }

          return;
        }

        // Count months with data (including sub-metrics)
        let metricMonthsWithData = 0;
        let total = 0;
        for (const monthId of quarterMonthIds) {
          // First try direct value
          const directEntry = data?.find(e => e.month === monthId && e.metric_name === metric.key);
          if (directEntry?.value !== null && directEntry?.value !== undefined) {
            total += Number(directEntry.value);
            metricMonthsWithData++;
          } else {
            // Fall back to sub-metric sum
            const subMetricPrefix = `sub:${metric.key}:`;
            const subMetrics = data?.filter(e => 
              e.month === monthId && 
              e.metric_name.startsWith(subMetricPrefix) && 
              e.value !== null && e.value !== undefined
            ) || [];
            if (subMetrics.length > 0) {
              total += subMetrics.reduce((sum, e) => sum + Number(e.value), 0);
              metricMonthsWithData++;
            }
          }
        }
        
        if (metricMonthsWithData > 0) {
          const avg = total / metricMonthsWithData;
          averages[`${metric.key}-Q${prevYearQuarter.quarter}-${prevYearQuarter.year}`] = avg;
        }
      }
    });

    // Now calculate current year quarter averages
    const currentQuarterMonths = getQuarterMonthsForCalculation(currentYearQuarter.quarter, currentYearQuarter.year);
    const currentQuarterMonthIds = currentQuarterMonths.map(m => m.identifier);
    
    // Count how many months have data in this quarter
    const currentMonthsWithData = new Set<string>();
    data?.forEach(entry => {
      if (currentQuarterMonthIds.includes(entry.month) && entry.value !== null) {
        currentMonthsWithData.add(entry.month);
      }
    });
    const currentMonthCount = currentMonthsWithData.size || 1;
    
    FINANCIAL_METRICS.forEach(metric => {
      // For percentage metrics, recalculate from underlying dollar amounts
      if (metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation) {
        const { numerator, denominator } = metric.calculation;
        
        const totalNumerator = getMetricTotal(numerator, currentQuarterMonthIds);
        const totalDenominator = getMetricTotal(denominator, currentQuarterMonthIds);
        
        if (totalDenominator > 0) {
          const calculatedPercentage = (totalNumerator / totalDenominator) * 100;
          averages[`${metric.key}-Q${currentYearQuarter.quarter}-${currentYearQuarter.year}`] = calculatedPercentage;
        }
      } else if (metric.calculation) {
        // For calculated dollar metrics
        const total = getMetricTotal(metric.key, currentQuarterMonthIds);
        if (total !== 0) {
          const avg = total / currentMonthCount;
          averages[`${metric.key}-Q${currentYearQuarter.quarter}-${currentYearQuarter.year}`] = avg;
        }
      } else {
        // For direct database values
        if (isHondaBrand && metric.key === 'total_direct_expenses') {
          const metricMonthCount = currentQuarterMonthIds.reduce((count, monthId) => {
            const direct = data?.find(e => e.month === monthId && e.metric_name === 'total_direct_expenses')?.value;
            if (direct !== null && direct !== undefined) return count + 1;

            if (isHondaLegacyMonth(monthId)) {
              const sales = data?.find(e => e.month === monthId && e.metric_name === 'sales_expense')?.value;
              const semiFixed = data?.find(e => e.month === monthId && e.metric_name === 'semi_fixed_expense')?.value;
              if (sales !== null && sales !== undefined && semiFixed !== null && semiFixed !== undefined) {
                return count + 1;
              }
            }

            return count;
          }, 0);

          if (metricMonthCount > 0) {
            const total = getMetricTotal(metric.key, currentQuarterMonthIds);
            const avg = total / metricMonthCount;
            averages[`${metric.key}-Q${currentYearQuarter.quarter}-${currentYearQuarter.year}`] = avg;
          }

          return;
        }

        // Count months with data (including sub-metrics)
        let metricMonthsWithData = 0;
        let total = 0;
        for (const monthId of currentQuarterMonthIds) {
          // First try direct value
          const directEntry = data?.find(e => e.month === monthId && e.metric_name === metric.key);
          if (directEntry?.value !== null && directEntry?.value !== undefined) {
            total += Number(directEntry.value);
            metricMonthsWithData++;
          } else {
            // Fall back to sub-metric sum
            const subMetricPrefix = `sub:${metric.key}:`;
            const subMetrics = data?.filter(e => 
              e.month === monthId && 
              e.metric_name.startsWith(subMetricPrefix) && 
              e.value !== null && e.value !== undefined
            ) || [];
            if (subMetrics.length > 0) {
              total += subMetrics.reduce((sum, e) => sum + Number(e.value), 0);
              metricMonthsWithData++;
            }
          }
        }
        
        if (metricMonthsWithData > 0) {
          const avg = total / metricMonthsWithData;
          averages[`${metric.key}-Q${currentYearQuarter.quarter}-${currentYearQuarter.year}`] = avg;
        }
      }
    });

    // Store individual parent metric M-format entries for tooltip lookups
    for (const monthId of allMonthIds) {
      const [yrStr, moStr] = monthId.split('-');
      const yr = parseInt(yrStr, 10);
      const mo = parseInt(moStr, 10);

      // First pass: dollar metrics (direct value or sub-metric sum)
      FINANCIAL_METRICS.forEach(metric => {
        if (metric.type === 'percentage') return; // Skip percentages in first pass
        const mKey = `${metric.key}-M${mo}-${yr}`;
        if (averages[mKey] !== undefined) return;

        const directEntry = data?.find(e => e.month === monthId && e.metric_name === metric.key);
        if (directEntry?.value !== null && directEntry?.value !== undefined) {
          averages[mKey] = Number(directEntry.value);
        } else {
          const subPrefix = `sub:${metric.key}:`;
          const subs = data?.filter(e =>
            e.month === monthId &&
            e.metric_name.startsWith(subPrefix) &&
            e.value !== null && e.value !== undefined
          ) || [];
          if (subs.length > 0) {
            averages[mKey] = subs.reduce((s, e) => s + Number(e.value), 0);
          }
        }
      });

      // Second pass: percentage metrics (derived from dollar values)
      FINANCIAL_METRICS.forEach(metric => {
        if (metric.type !== 'percentage' || !metric.calculation || !('numerator' in metric.calculation)) return;
        const mKey = `${metric.key}-M${mo}-${yr}`;
        if (averages[mKey] !== undefined) return;

        const { numerator, denominator } = metric.calculation as { numerator: string; denominator: string };
        const numVal = averages[`${numerator}-M${mo}-${yr}`];
        const denVal = averages[`${denominator}-M${mo}-${yr}`];
        if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
          averages[mKey] = (numVal / denVal) * 100;
        }
      });
    }

    // Store individual sub-metric M-format entries for LY tooltip lookups
    for (const monthId of allMonthIds) {
      const monthParts = monthId.split('-');
      const yr = parseInt(monthParts[0], 10);
      const mo = parseInt(monthParts[1], 10);
      const monthEntries = data.filter(e => e.month === monthId);

      for (const entry of monthEntries) {
        if (entry.metric_name?.startsWith('sub:') && entry.value != null) {
          const parts = entry.metric_name.split(':');
          if (parts.length >= 4) {
            const parentKey = parts[1];
            const subName = parts.slice(3).join(':');
            averages[`sub:${parentKey}:${subName}-M${mo}-${yr}`] = entry.value;
          }
        }
      }

      // Synthesize percentage sub-metrics
      FINANCIAL_METRICS.forEach(metric => {
        if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
          const { numerator, denominator } = metric.calculation as { numerator: string; denominator: string };
          const prefix = `sub:${numerator}:`;
          const suffix = `-M${mo}-${yr}`;
          for (const key of Object.keys(averages)) {
            if (key.startsWith(prefix) && key.endsWith(suffix)) {
              const subName = key.slice(prefix.length, key.length - suffix.length);
              const pctKey = `sub:${metric.key}:${subName}${suffix}`;
              if (averages[pctKey] === undefined) {
                const numVal = averages[key];
                const denKey = `sub:${denominator}:${subName}${suffix}`;
                const denVal = averages[denKey];
                if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
                  averages[pctKey] = (numVal / denVal) * 100;
                } else if (numVal !== undefined) {
                  const parentDenKey = `${denominator}${suffix}`;
                  const parentDenVal = averages[parentDenKey];
                  if (parentDenVal !== undefined && parentDenVal !== 0) {
                    averages[pctKey] = (numVal / parentDenVal) * 100;
                  }
                }
              }
            }
          }
        }
      });
    }

    // Only apply if this is still the latest request
    if (requestId !== precedingDataRequestIdRef.current) {
      console.log('[loadPrecedingQuartersData] Non-trend mode - stale request, discarding');
      return;
    }
    setPrecedingQuartersData(averages);
  };

  const loadFinancialData = async () => {
    if (!departmentId) {
      setLoading(false);
      return;
    }

    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    // Don't clear entries here - wait until new data is loaded
    // This prevents UI flicker during async load for high-volume departments
    
    // Skip loading individual month data in Quarter Trend or Monthly Trend mode
    if (isQuarterTrendMode || isMonthlyTrendMode) {
      setLoading(false);
      return;
    }
    
    const monthIds = months.map(m => m.identifier);
    const previousYearMonthIds = previousYearMonths.map(m => m.identifier);
    
    // Also load all months of current year to calculate highest profit month across the full year
    const allCurrentYearMonthIds = Array.from({ length: 12 }, (_, i) => 
      `${year}-${String(i + 1).padStart(2, '0')}`
    );
    
    const allMonthIds = [...new Set([...monthIds, ...previousYearMonthIds, ...allCurrentYearMonthIds])];

    // Paginate to avoid the 1000 row limit when sub-metrics create large datasets
    const allRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: page, error: pageError } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", allMonthIds)
        .range(from, from + pageSize - 1);

      if (pageError) {
        toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
        setLoading(false);
        return;
      }

      allRows.push(...(page || []));
      from += pageSize;
      hasMore = (page?.length || 0) === pageSize;
    }

    const data = allRows;

    const entriesMap: { [key: string]: number } = {};
    const notesMap: { [key: string]: string } = {};
    const duplicates: Array<{ key: string; metric: string; month: string }> = [];
    const seenKeys = new Set<string>();

    data?.forEach(entry => {
      const key = `${entry.metric_name}-${entry.month}`;

      // Detect duplicates
      if (seenKeys.has(key)) {
        duplicates.push({ key, metric: entry.metric_name, month: entry.month });
      }
      seenKeys.add(key);

      // IMPORTANT: don't coerce null/undefined to 0.
      // Missing values must remain undefined so calculated metrics can fall back to sub-metric sums.
      if (entry.value !== null && entry.value !== undefined) {
        entriesMap[key] = entry.value;
      }

      if (entry.notes) {
        notesMap[key] = entry.notes;
      }
    });

    if (duplicates.length > 0) {
      console.warn('[FinancialSummary] Duplicate financial_entries detected for department/month/metric', {
        departmentId,
        duplicates,
      });
    }

    // Only apply if this is still the latest request
    if (requestId !== loadRequestIdRef.current) {
      console.log('[loadFinancialData] Stale request, discarding');
      return;
    }

    // Replace entries atomically only after successful load
    setEntries(entriesMap);
    setNotes(notesMap);
    setLoading(false);
  };

  // Only updates local state - no autosave. Saves happen on Enter, Tab, or blur.
  const handleValueChange = (metricKey: string, monthId: string, value: string) => {
    const key = `${metricKey}-${monthId}`;
    setLocalValues(prev => ({ ...prev, [key]: value }));
  };

  // Save entry to database - called on Enter, Tab, or blur
  const saveEntry = async (metricKey: string, monthId: string) => {
    const key = `${metricKey}-${monthId}`;
    const value = localValues[key];
    
    console.log('[saveEntry] Called for:', key, 'localValue:', value, 'saveTimeoutRef exists:', !!saveTimeoutRef.current[key]);
    
    // If no local value exists, nothing to save
    if (value === undefined) {
      console.log('[saveEntry] Skipping - no local value');
      return;
    }
    
    // Prevent duplicate saves - if a save is already in progress for this key, skip
    // This happens when Enter triggers save and then blur also tries to save
    if (saveTimeoutRef.current[key]) {
      console.log('[saveEntry] Skipping - save already in progress');
      return;
    }
    
    // Mark cell as active to prevent realtime overwrites during save
    activeCellRef.current = key;
    
    // Mark as pending save to prevent sync effect from clearing localValues
    // and to prevent duplicate saves from blur after Enter/Tab
    saveTimeoutRef.current[key] = setTimeout(() => {}, 0);
    console.log('[saveEntry] Set saveTimeoutRef for:', key);
    
    // Accept pasted/formatted numbers like "$12,345" or "12,345".
    const cleaned = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
    let numValue = cleaned === "" ? null : Number.parseFloat(cleaned);
    if (Number.isNaN(numValue)) numValue = null;

    // Round all values to nearest whole number
    if (numValue !== null) {
      numValue = Math.round(numValue);
    }

    setSaving(prev => ({ ...prev, [key]: true }));

    try {
      // If value is empty/null, delete the entry
      if (numValue === null || value === '') {
        const { error } = await supabase
          .from("financial_entries")
          .delete()
          .eq("department_id", departmentId)
          .eq("month", monthId)
          .eq("metric_name", metricKey);

        if (error) {
          toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
        } else {
          setEntries(prev => {
            const newEntries = { ...prev };
            delete newEntries[key];
            return newEntries;
          });
          // Keep localValues[key] as empty string (don't delete it) to prevent
          // the old value from entries from flashing during the render cycle.
          // It will be cleaned up by the sync effect after entries is updated.
          setLocalValues(prev => ({ ...prev, [key]: '' }));
        }
      } else {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;

        const { error } = await supabase
          .from("financial_entries")
          .upsert({
            department_id: departmentId,
            month: monthId,
            metric_name: metricKey,
            value: numValue,
            created_by: userId,
          }, {
            onConflict: "department_id,month,metric_name"
          });

        if (error) {
          toast({ title: "Error", description: "Failed to save financial entry", variant: "destructive" });
        } else {
          setEntries(prev => ({ ...prev, [key]: numValue }));
          setLocalValues(prev => ({ ...prev, [key]: String(numValue) }));
        }
      }

      // Reload preceding quarters data in background
      loadPrecedingQuartersData();
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
      // Clear save timeout marker and active cell after a delay
      setTimeout(() => {
        if (saveTimeoutRef.current[key]) {
          clearTimeout(saveTimeoutRef.current[key]);
          delete saveTimeoutRef.current[key];
        }
        if (activeCellRef.current === key) {
          activeCellRef.current = null;
        }
      }, 150);
    }
  };

  const formatValue = (value: number | undefined, type: string) => {
    if (value === null || value === undefined) return "";
    if (type === "dollar") return Math.round(value).toLocaleString();
    if (type === "percentage") return Math.round(value).toString();
    return value.toString();
  };

  const formatTarget = (value: number | undefined, type: string) => {
    if (value === null || value === undefined) return "-";
    if (type === "dollar") return `$${Math.round(value).toLocaleString()}`;
    if (type === "percentage") return `${value.toFixed(1)}%`;
    return value.toString();
  };

  /**
   * Tooltip wrapper for trend cells showing Last Year and Forecast values.
   * Uses a monospace-like grid layout so dollar amounts align perfectly.
   */
  const TrendCellTooltip = ({ metricKey, metricType, monthIdentifier, children }: {
    metricKey: string;
    metricType: string;
    monthIdentifier: string; // e.g. "2025-03"
    children: React.ReactNode;
  }) => {
    const monthNum = parseInt(monthIdentifier.split('-')[1], 10);
    const yr = parseInt(monthIdentifier.split('-')[0], 10);
    const lyKey = `${metricKey}-M${monthNum}-${yr - 1}`;
    const lyValue = precedingQuartersData[lyKey];
    const forecastValue = getForecastTarget(metricKey, monthIdentifier);

    if (lyValue == null && forecastValue == null) return <>{children}</>;

    return (
      <TooltipProvider>
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side="top" className="p-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs font-mono whitespace-nowrap">
              {lyValue != null && (
                <>
                  <span className="text-muted-foreground">LY</span>
                  <span className="text-right">{formatTarget(lyValue, metricType)}</span>
                </>
              )}
              {forecastValue != null && (
                <>
                  <span className="text-muted-foreground">Forecast</span>
                  <span className="text-right">{formatTarget(forecastValue, metricType)}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  /**
   * Tooltip wrapper for quarter trend cells showing Last Year and Forecast values.
   */
  const QuarterTrendCellTooltip = ({ metricKey, metricType, quarter: qtr, qtrYear, children }: {
    metricKey: string;
    metricType: string;
    quarter: number;
    qtrYear: number;
    children: React.ReactNode;
  }) => {
    // Last year: same quarter, previous year
    const lyKey = `${metricKey}-Q${qtr}-${qtrYear - 1}`;
    const lyValue = precedingQuartersData[lyKey];

    // Forecast: average of the 3 monthly forecast values for this quarter
    const qtrMonthIds = getQuarterMonthsForCalculation(qtr, qtrYear).map(m => m.identifier);
    const forecastValues = qtrMonthIds.map(mid => getForecastTarget(metricKey, mid)).filter((v): v is number => v !== null);
    const forecastValue = forecastValues.length > 0 ? forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length : null;

    if (lyValue == null && forecastValue == null) return <>{children}</>;

    return (
      <TooltipProvider>
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent side="top" className="p-2">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs font-mono whitespace-nowrap">
              {lyValue != null && (
                <>
                  <span className="text-muted-foreground">LY</span>
                  <span className="text-right">{formatTarget(lyValue, metricType)}</span>
                </>
              )}
              {forecastValue != null && (
                <>
                  <span className="text-muted-foreground">Forecast</span>
                  <span className="text-right">{formatTarget(forecastValue, metricType)}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const canEditTargets = () => {
    return userRole === 'super_admin' || userRole === 'store_gm' || userRole === 'department_manager' || userRole === 'fixed_ops_manager';
  };

  const handlePasteDataChange = (value: string) => {
    setPasteData(value);
    
    // Parse the pasted data
    if (!value.trim() || !pasteMetric || !pasteMonth || !pasteYear) {
      setParsedPasteData([]);
      return;
    }

    // Split by tabs or spaces (supporting both tab-separated and space-separated)
    const values = value.trim().split(/[\t\s]+/).map(v => v.replace(/[,$]/g, ''));
    const parsed: { month: string; value: number }[] = [];
    
    // Start from the selected month and year
    let currentMonth = parseInt(pasteMonth);
    let currentYear = pasteYear;

    values.forEach((val) => {
      const numValue = parseFloat(val);
      if (!isNaN(numValue)) {
        const monthIdentifier = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        parsed.push({
          month: monthIdentifier,
          value: numValue
        });
        
        // Move to next month
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    });

    setParsedPasteData(parsed);
  };

  const handlePasteSave = async () => {
    if (!pasteMetric || parsedPasteData.length === 0) {
      toast({
        title: "No data to save",
        description: "Please select a metric and paste valid data",
        variant: "destructive"
      });
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Save each month's value
      for (const entry of parsedPasteData) {
        const { error } = await supabase
          .from("financial_entries")
          .upsert({
            department_id: departmentId,
            metric_name: pasteMetric,
            month: entry.month,
            value: entry.value,
            created_by: user.id
          }, {
            onConflict: 'department_id,metric_name,month'
          });

        if (error) throw error;
      }

      toast({
        title: "Data saved",
        description: `Successfully saved ${parsedPasteData.length} entries`
      });

      // Refresh data and close dialog
      await loadFinancialData();
      await loadPrecedingQuartersData();
      setPasteDialogOpen(false);
      setPasteData("");
      setPasteMetric("");
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

  const handleTargetEdit = (metricKey: string) => {
    if (!canEditTargets()) return;
    const currentTarget = targets[metricKey] || 0;
    setEditingTarget(metricKey);
    setTargetEditValue(currentTarget.toString());
  };

  // Helper function to create issue from financial cell
  const handleCreateIssueFromCell = (
    metric: FinancialMetric,
    actualValue: number | null | undefined,
    targetValue: number | null | undefined,
    monthLabel: string,
    monthIdentifier: string
  ) => {
    const formattedActual = actualValue !== null && actualValue !== undefined 
      ? formatTarget(actualValue, metric.type) 
      : 'N/A';
    const formattedTarget = targetValue !== null && targetValue !== undefined 
      ? formatTarget(targetValue, metric.type) 
      : 'N/A';
    
    const title = `${metric.name} - ${monthLabel}`;
    const description = `**Metric:** ${metric.name}
**Period:** ${monthLabel}
**Month:** ${monthIdentifier}
**Year:** ${year}
**Quarter:** Q${quarter}

**Current Value:** ${formattedActual}
**Target:** ${formattedTarget}

---
*Issue created from financial summary*`;

    // Determine severity based on variance
    let severity = 'medium';
    if (actualValue !== null && actualValue !== undefined && targetValue !== null && targetValue !== undefined && targetValue !== 0) {
      const variance = metric.type === "percentage" 
        ? actualValue - targetValue 
        : ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
      
      const targetDirection = metric.targetDirection || "above";
      const adjustedVariance = targetDirection === "below" ? -variance : variance;
      
      if (adjustedVariance < -10) {
        severity = 'high';
      } else if (adjustedVariance < 0) {
        severity = 'medium';
      } else {
        severity = 'low';
      }
    }

    setIssueContext({ 
      title, 
      description, 
      severity,
      sourceMetricName: metric.key,
      sourcePeriod: monthIdentifier
    });
    setIssueDialogOpen(true);
  };

  // Helper function to create issue from sub-metric cell
  const handleCreateIssueFromSubMetricCell = (
    parentMetricKey: string,
    subMetricName: string,
    value: number | null,
    periodLabel: string,
    periodIdentifier: string,
    periodType: 'month' | 'year-avg' | 'year-total' | 'quarter-avg'
  ) => {
    const parentMetric = FINANCIAL_METRICS.find(m => m.key === parentMetricKey);
    const formattedValue = value !== null 
      ? formatTarget(value, parentMetric?.type || 'dollar') 
      : 'N/A';
    
    // Format period type for display
    const periodTypeLabel = periodType === 'month' ? '' : 
      periodType === 'year-avg' ? ' (Year Average)' : 
      periodType === 'year-total' ? ' (Year Total)' : 
      periodType === 'quarter-avg' ? ' (Quarter Average)' : '';
    
    const title = `${subMetricName} - ${periodLabel}${periodTypeLabel}`;
    const description = `**Sub-Metric:** ${subMetricName}
**Parent Metric:** ${parentMetric?.name || parentMetricKey}
**Period:** ${periodLabel}
**Period Type:** ${periodType}
**Year:** ${year}
**Quarter:** Q${quarter}

**Current Value:** ${formattedValue}

---
*Issue created from financial sub-metric*`;

    // Default severity for sub-metrics
    const severity = 'medium';

    setIssueContext({ 
      title, 
      description, 
      severity,
      sourceMetricName: `sub:${parentMetricKey}:${subMetricName}`,
      sourcePeriod: periodIdentifier
    });
    setIssueDialogOpen(true);
  };

  // Helper function to create issue from summary column (year-avg, year-total)
  const handleCreateIssueFromSummaryCell = (
    metric: FinancialMetric,
    value: number | null | undefined,
    periodType: 'year-avg' | 'year-total',
    summaryYear: number
  ) => {
    const formattedValue = value !== null && value !== undefined 
      ? formatTarget(value, metric.type) 
      : 'N/A';
    
    const periodTypeLabel = periodType === 'year-avg' ? 'Year Average' : 'Year Total';
    const periodIdentifier = `${periodType.replace('-', '')}:${summaryYear}`;
    
    const title = `${metric.name} - ${periodTypeLabel} ${summaryYear}`;
    const description = `**Metric:** ${metric.name}
**Period Type:** ${periodTypeLabel}
**Year:** ${summaryYear}

**Current Value:** ${formattedValue}

---
*Issue created from financial summary column*`;

    setIssueContext({ 
      title, 
      description, 
      severity: 'medium',
      sourceMetricName: metric.key,
      sourcePeriod: periodIdentifier
    });
    setIssueDialogOpen(true);
  };

  const handleTargetSave = async (metricKey: string) => {
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

    const metric = FINANCIAL_METRICS.find(m => m.key === metricKey);
    if (!metric) return;

    const { error } = await supabase
      .from("financial_targets")
      .upsert({
        department_id: departmentId,
        metric_name: metricKey,
        quarter: quarter,
        year: year,
        target_value: newValue,
        target_direction: targetDirections[metricKey] || metric.targetDirection,
      }, {
        onConflict: "department_id,metric_name,quarter,year",
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
    
    // GP% targets no longer directly drive forecast calculations
    // The single growth slider now controls forecast scaling
    
    // Reload targets and financial data to recalculate statuses immediately
    await loadTargets();
    await loadPrecedingQuartersData();
    toast({
      title: "Success",
      description: "Target updated successfully",
    });
  };

  const handleCopyToQuarters = async (metricKey: string) => {
    console.log('Copy to quarters clicked for:', metricKey);
    const currentTarget = targets[metricKey];
    console.log('Current target value:', currentTarget);
    const metric = FINANCIAL_METRICS.find(m => m.key === metricKey);
    console.log('Metric found:', metric);
    
    if (currentTarget === undefined || currentTarget === null || !metric) {
      console.log('Validation failed - returning early');
      return;
    }

    const updates = [1, 2, 3, 4]
      .filter(q => q !== quarter)
      .map(q => ({
        department_id: departmentId,
        metric_name: metricKey,
        quarter: q,
        year: year,
        target_value: currentTarget,
        target_direction: targetDirections[metricKey] || metric.targetDirection,
      }));

    console.log('Updates to be sent:', updates);

    const { error } = await supabase
      .from("financial_targets")
      .upsert(updates, {
        onConflict: "department_id,metric_name,quarter,year",
      });

    if (error) {
      console.error('Copy error:', error);
      toast({
        title: "Error",
        description: "Failed to copy targets",
        variant: "destructive",
      });
      return;
    }

    console.log('Copy successful');
    await loadTargets();
    toast({
      title: "Success",
      description: `Target copied to all quarters in ${year}`,
    });
  };

  const handleOpenNoteDialog = (metricKey: string, monthId: string) => {
    const key = `${metricKey}-${monthId}`;
    setCurrentNoteCell({ metricKey, monthId });
    setCurrentNote(notes[key] || "");
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!currentNoteCell) return;

    const { metricKey, monthId } = currentNoteCell;
    const key = `${metricKey}-${monthId}`;

    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;

    // Get current entry to preserve value
    const { data: existingEntry } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("department_id", departmentId)
      .eq("month", monthId)
      .eq("metric_name", metricKey)
      .maybeSingle();

    const { error } = await supabase
      .from("financial_entries")
      .upsert({
        department_id: departmentId,
        month: monthId,
        metric_name: metricKey,
        value: existingEntry?.value || null,
        notes: currentNote || null,
        created_by: userId,
      }, {
        onConflict: "department_id,month,metric_name"
      });

    if (error) {
      toast({ title: "Error", description: "Failed to save note", variant: "destructive" });
      return;
    }

    // Update local state
    setNotes(prev => {
      const newNotes = { ...prev };
      if (currentNote) {
        newNotes[key] = currentNote;
      } else {
        delete newNotes[key];
      }
      return newNotes;
    });

    toast({ title: "Success", description: "Note saved successfully" });
    setNoteDialogOpen(false);
    setCurrentNoteCell(null);
    setCurrentNote("");
  };

  // Export monthly trend data to Excel
  const handleExportMonthlyTrend = () => {
    if (!isMonthlyTrendMode) return;

    const periods = monthlyTrendPeriods;
    
    // Build header row
    const headers = ["Metric", ...periods.map(p => p.label)];
    
    // Build data rows
    const dataRows = FINANCIAL_METRICS.map(metric => {
      const row: (string | number)[] = [metric.name];
      
      periods.forEach(period => {
        let value: number | undefined;
        
        if (period.type === 'month') {
          const mKey = `${metric.key}-M${period.month + 1}-${period.year}`;
          value = precedingQuartersData[mKey];
          
          // Handle calculated fields if direct value doesn't exist
          if (value === undefined && metric.calculation) {
            // For percentage calculations
            if (metric.type === 'percentage' && 'numerator' in metric.calculation) {
              const numKey = `${metric.calculation.numerator}-M${period.month + 1}-${period.year}`;
              const denKey = `${metric.calculation.denominator}-M${period.month + 1}-${period.year}`;
              const num = precedingQuartersData[numKey];
              const den = precedingQuartersData[denKey];
              if (num !== undefined && den !== undefined && den !== 0) {
                value = (num / den) * 100;
              }
            }
            // For dollar subtraction/complex calculations
            if (metric.type === 'dollar' && 'type' in metric.calculation) {
              const baseKey = `${metric.calculation.base}-M${period.month + 1}-${period.year}`;
              const baseVal = precedingQuartersData[baseKey];
              if (baseVal !== undefined) {
                let calcVal = baseVal;
                for (const ded of metric.calculation.deductions) {
                  const dedKey = `${ded}-M${period.month + 1}-${period.year}`;
                  calcVal -= (precedingQuartersData[dedKey] || 0);
                }
                if (metric.calculation.type === 'complex' && 'additions' in metric.calculation) {
                  for (const add of metric.calculation.additions) {
                    const addKey = `${add}-M${period.month + 1}-${period.year}`;
                    calcVal += (precedingQuartersData[addKey] || 0);
                  }
                }
                value = calcVal;
              }
            }
          }
        } else if (period.type === 'year-avg' && period.summaryYear) {
          // Calculate average for the year
          const monthCount = period.isYTD ? new Date().getMonth() + 1 : 12;
          let sum = 0;
          let count = 0;
          for (let m = 1; m <= monthCount; m++) {
            const mKey = `${metric.key}-M${m}-${period.summaryYear}`;
            const val = precedingQuartersData[mKey];
            if (val !== undefined) {
              sum += val;
              count++;
            }
          }
          value = count > 0 ? sum / count : undefined;
        } else if (period.type === 'year-total' && period.summaryYear) {
          // Calculate total for the year (skip percentage metrics)
          if (metric.type === 'percentage') {
            value = undefined;
          } else {
            const monthCount = period.isYTD ? new Date().getMonth() + 1 : 12;
            let sum = 0;
            let hasData = false;
            for (let m = 1; m <= monthCount; m++) {
              const mKey = `${metric.key}-M${m}-${period.summaryYear}`;
              const val = precedingQuartersData[mKey];
              if (val !== undefined) {
                sum += val;
                hasData = true;
              }
            }
            value = hasData ? sum : undefined;
          }
        }
        
        // Format the value for Excel
        if (value !== undefined) {
          if (metric.type === 'percentage') {
            row.push(Math.round(value * 100) / 100); // Keep as number for Excel, rounded
          } else {
            row.push(Math.round(value)); // Round dollars
          }
        } else {
          row.push("");
        }
      });
      
      return row;
    });
    
    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    
    // Set column widths
    const colWidths = [{ wch: 25 }, ...periods.map(() => ({ wch: 12 }))];
    ws['!cols'] = colWidths;
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Trend");
    
    // Generate filename
    const safeDeptName = departmentName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Financial';
    const filename = `${safeDeptName}_MonthlyTrend_${year}.xlsx`;
    
    XLSX.writeFile(wb, filename);
    
    toast({
      title: "Export Complete",
      description: `Downloaded ${filename}`,
    });
  };

  // Generate copy source options for a target month
  const getCopySourceOptions = useCallback((targetMonthIdentifier: string): import("./MonthDropZone").CopySourceOption[] => {
    // Parse target month
    const [targetYearStr, targetMonthStr] = targetMonthIdentifier.split('-');
    const targetYear = parseInt(targetYearStr);
    const targetMonth = parseInt(targetMonthStr);
    
    if (isNaN(targetYear) || isNaN(targetMonth)) return [];
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const options: import("./MonthDropZone").CopySourceOption[] = [];
    
    // Add YTD average option for the same year
    options.push({
      identifier: `avg-${targetYear}`,
      label: `Avg ${targetYear} YTD`,
      isAverage: true,
    });
    
    // Add all months from the same year that are before the target month
    for (let m = 1; m <= 12; m++) {
      const monthId = `${targetYear}-${String(m).padStart(2, '0')}`;
      // Don't include the target month itself
      if (monthId === targetMonthIdentifier) continue;
      
      options.push({
        identifier: monthId,
        label: `${monthNames[m - 1]} ${targetYear}`,
        isAverage: false,
      });
    }
    
    return options;
  }, []);

  // Handle copying financial data from one source to a target month
  const handleCopyFromSource = useCallback(async (targetMonthIdentifier: string, sourceIdentifier: string) => {
    if (!departmentId) return;
    
    setCopyingMonth(targetMonthIdentifier);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "Not authenticated",
          variant: "destructive",
        });
        return;
      }
      
      const isSourceAverage = sourceIdentifier.startsWith('avg-');
      const sourceYear = isSourceAverage ? parseInt(sourceIdentifier.split('-')[1]) : null;
      
      // Identify which metrics to copy (only those WITHOUT a calculation property)
      const metricsToСopy = FINANCIAL_METRICS.filter(m => !m.calculation);
      
      // Build the entries to insert
      const entriesToInsert: Array<{
        department_id: string;
        month: string;
        metric_name: string;
        value: number;
        created_by: string;
      }> = [];
      
      if (isSourceAverage && sourceYear) {
        // Calculate averages from all months of the source year
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const monthCount = sourceYear === currentYear ? currentMonth : 12;
        
        for (const metric of metricsToСopy) {
          let sum = 0;
          let count = 0;
          
          for (let m = 1; m <= monthCount; m++) {
            const mKey = `${metric.key}-M${m}-${sourceYear}`;
            const val = precedingQuartersData[mKey];
            if (val !== null && val !== undefined) {
              sum += val;
              count++;
            }
          }
          
          if (count > 0) {
            const average = Math.round(sum / count);
            entriesToInsert.push({
              department_id: departmentId,
              month: targetMonthIdentifier,
              metric_name: metric.key,
              value: average,
              created_by: user.id,
            });
          }
        }
        
        // Handle sub-metrics: calculate average for each sub-metric
        const subMetricsByParent = new Map<string, Map<string, { sum: number; count: number }>>();
        
        for (const subMetric of allSubMetrics) {
          if (!subMetric.monthIdentifier.startsWith(`${sourceYear}-`)) continue;
          const monthNum = parseInt(subMetric.monthIdentifier.split('-')[1]);
          if (monthNum > monthCount) continue;
          
          if (!subMetricsByParent.has(subMetric.parentMetricKey)) {
            subMetricsByParent.set(subMetric.parentMetricKey, new Map());
          }
          const parentMap = subMetricsByParent.get(subMetric.parentMetricKey)!;
          
          const key = subMetric.name;
          if (!parentMap.has(key)) {
            parentMap.set(key, { sum: 0, count: 0 });
          }
          const entry = parentMap.get(key)!;
          if (subMetric.value !== null) {
            entry.sum += subMetric.value;
            entry.count++;
          }
        }
        
        // Create average entries for sub-metrics
        subMetricsByParent.forEach((subMetricsMap, parentKey) => {
          subMetricsMap.forEach((data, subMetricName) => {
            if (data.count > 0) {
              const average = Math.round(data.sum / data.count);
              // Find order index from existing sub-metrics
              const existingSub = allSubMetrics.find(
                sm => sm.parentMetricKey === parentKey && sm.name === subMetricName
              );
              const orderIndex = existingSub?.orderIndex ?? 999;
              
              const metricName = `sub:${parentKey}:${String(orderIndex).padStart(3, '0')}:${subMetricName}`;
              entriesToInsert.push({
                department_id: departmentId,
                month: targetMonthIdentifier,
                metric_name: metricName,
                value: average,
                created_by: user.id,
              });
            }
          });
        });
        
      } else {
        // Copy from a specific month
        const [srcYear, srcMonth] = sourceIdentifier.split('-').map(Number);
        
        for (const metric of metricsToСopy) {
          const mKey = `${metric.key}-M${srcMonth}-${srcYear}`;
          const val = precedingQuartersData[mKey];
          if (val !== null && val !== undefined) {
            entriesToInsert.push({
              department_id: departmentId,
              month: targetMonthIdentifier,
              metric_name: metric.key,
              value: Math.round(val),
              created_by: user.id,
            });
          }
        }
        
        // Copy sub-metrics from the source month
        const sourceSubMetrics = allSubMetrics.filter(
          sm => sm.monthIdentifier === sourceIdentifier
        );
        
        for (const subMetric of sourceSubMetrics) {
          if (subMetric.value === null) continue;
          
          const metricName = `sub:${subMetric.parentMetricKey}:${String(subMetric.orderIndex).padStart(3, '0')}:${subMetric.name}`;
          entriesToInsert.push({
            department_id: departmentId,
            month: targetMonthIdentifier,
            metric_name: metricName,
            value: Math.round(subMetric.value),
            created_by: user.id,
          });
        }
      }
      
      if (entriesToInsert.length === 0) {
        toast({
          title: "No data to copy",
          description: "The source has no data to copy",
          variant: "destructive",
        });
        return;
      }
      
      // Upsert all entries
      const { error } = await supabase
        .from("financial_entries")
        .upsert(entriesToInsert, {
          onConflict: "department_id,month,metric_name"
        });
      
      if (error) {
        console.error('Error copying financial data:', error);
        toast({
          title: "Error",
          description: "Failed to copy financial data",
          variant: "destructive",
        });
        return;
      }
      
      // Reload data
      await loadFinancialData();
      await loadPrecedingQuartersData();
      await refetchSubMetrics();
      
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const sourceLabel = isSourceAverage 
        ? `Avg ${sourceYear} YTD` 
        : (() => {
            const [sYear, sMonth] = sourceIdentifier.split('-').map(Number);
            return `${monthNames[sMonth - 1]} ${sYear}`;
          })();
      const [tYear, tMonth] = targetMonthIdentifier.split('-').map(Number);
      const targetLabel = `${monthNames[tMonth - 1]} ${tYear}`;
      
      // Save copy metadata
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase
        .from('financial_copy_metadata')
        .upsert({
          department_id: departmentId,
          target_month: targetMonthIdentifier,
          source_identifier: sourceIdentifier,
          source_label: sourceLabel,
          copied_by: currentUser?.id,
        }, {
          onConflict: 'department_id,target_month'
        });
      
      // Refresh copy metadata
      await fetchCopyMetadata();
      
      // Count main metrics vs sub-metrics
      const mainMetricCount = entriesToInsert.filter(e => !e.metric_name.startsWith('sub:')).length;
      const subMetricCount = entriesToInsert.filter(e => e.metric_name.startsWith('sub:')).length;
      
      toast({
        title: "Data copied",
        description: `Copied ${mainMetricCount} metrics${subMetricCount > 0 ? ` and ${subMetricCount} sub-metrics` : ''} from ${sourceLabel} to ${targetLabel}`,
      });
      
    } catch (err) {
      console.error('Error in handleCopyFromSource:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setCopyingMonth(null);
    }
  }, [departmentId, FINANCIAL_METRICS, precedingQuartersData, allSubMetrics, toast, loadFinancialData, loadPrecedingQuartersData, refetchSubMetrics, currentYear, fetchCopyMetadata]);

  // Handle clearing all financial data for a month
  const handleClearMonthData = useCallback(async (monthIdentifier: string) => {
    if (!departmentId) return;
    
    try {
      // Delete all financial entries for this month and department
      const { error: entriesError } = await supabase
        .from('financial_entries')
        .delete()
        .eq('department_id', departmentId)
        .eq('month', monthIdentifier);
      
      if (entriesError) {
        console.error('Error deleting financial entries:', entriesError);
        toast({
          title: "Error",
          description: "Failed to clear financial entries",
          variant: "destructive",
        });
        return;
      }
      
      // Delete attachment record for this month
      const { error: attachmentError } = await supabase
        .from('financial_attachments')
        .delete()
        .eq('department_id', departmentId)
        .eq('month_identifier', monthIdentifier);
      
      if (attachmentError) {
        console.error('Error deleting attachment:', attachmentError);
        // Don't fail if attachment deletion fails - it might not exist
      }
      
      // Delete copy metadata for this month
      await supabase
        .from('financial_copy_metadata')
        .delete()
        .eq('department_id', departmentId)
        .eq('target_month', monthIdentifier);
      
      // Reload data
      await loadFinancialData();
      await loadPrecedingQuartersData();
      await refetchSubMetrics();
      await fetchAttachments();
      await fetchCopyMetadata();
      
      // Format month label for toast
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const [yearStr, monthStr] = monthIdentifier.split('-');
      const monthIndex = parseInt(monthStr) - 1;
      const monthLabel = `${monthNames[monthIndex]} ${yearStr}`;
      
      toast({
        title: "Month data cleared",
        description: `Cleared all financial data for ${monthLabel}`,
      });
      
    } catch (err) {
      console.error('Error in handleClearMonthData:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  }, [departmentId, toast, loadFinancialData, loadPrecedingQuartersData, refetchSubMetrics, fetchAttachments, fetchCopyMetadata]);

  // Open clear confirmation dialog
  const openClearMonthDialog = useCallback((monthIdentifier: string) => {
    setClearMonthTarget(monthIdentifier);
    setClearMonthDialogOpen(true);
  }, []);

  // Confirm and execute clear
  const confirmClearMonth = useCallback(async () => {
    if (clearMonthTarget) {
      await handleClearMonthData(clearMonthTarget);
    }
    setClearMonthDialogOpen(false);
    setClearMonthTarget(null);
  }, [clearMonthTarget, handleClearMonthData]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
                <CardDescription>
                  Monthly financial performance metrics for Q{quarter} {year}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {(userRole === 'super_admin' || userRole === 'store_gm') && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setPasteDialogOpen(true);
                      }}
                    >
                      <ClipboardPaste className="h-4 w-4 mr-2" />
                      Paste Row
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setImportDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import Data
                    </Button>
                  </>
                )}
                {isMonthlyTrendMode && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportMonthlyTrend();
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setForecastDrawerOpen(true);
                  }}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Forecast
                </Button>
                <Dialog open={targetsDialogOpen} onOpenChange={setTargetsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                      <Settings className="h-4 w-4 mr-2" />
                      Set Targets
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-6xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>Set Financial Targets</DialogTitle>
                      <DialogDescription>
                        Define target values for each financial metric by quarter
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mb-4">
                      <Label htmlFor="target-year">Target Year</Label>
                      <Select
                        value={targetYear.toString()}
                        onValueChange={(value) => setTargetYear(parseInt(value))}
                      >
                        <SelectTrigger id="target-year" className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={(year - 1).toString()}>{year - 1} (Last Year)</SelectItem>
                          <SelectItem value={year.toString()}>{year} (Current Year)</SelectItem>
                          <SelectItem value={(year + 1).toString()}>{year + 1} (Next Year)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="max-h-[50vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Metric</TableHead>
                            <TableHead className="text-center">Q1</TableHead>
                            <TableHead className="text-center">Q2</TableHead>
                            <TableHead className="text-center">Q3</TableHead>
                            <TableHead className="text-center">Q4</TableHead>
                            <TableHead className="w-[140px]">Direction</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {FINANCIAL_METRICS.map((metric) => {
                            const isDepartmentProfit = metric.key === 'department_profit';
                            return (
                              <TableRow 
                                key={metric.key}
                                className={cn(
                                  isDepartmentProfit && "border-y-2 border-primary/40 bg-primary/5"
                                )}
                              >
                                <TableCell className={cn(
                                  isDepartmentProfit ? "font-bold" : "font-medium"
                                )}>
                                  {metric.name}
                                </TableCell>
                              {[1, 2, 3, 4].map((q) => {
                                const rawValue = editTargets[q]?.[metric.key];
                                const numValue = rawValue !== undefined && rawValue !== "" ? parseFloat(rawValue) : null;
                                const displayValue = numValue !== null 
                                  ? metric.type === 'percentage' 
                                    ? `${numValue.toFixed(1)}%`
                                    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numValue)
                                  : "-";
                                return (
                                  <TableCell key={q}>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={rawValue || ""}
                                      onChange={(e) => {
                                        setEditTargets(prev => ({ 
                                          ...prev, 
                                          [q]: { ...prev[q], [metric.key]: e.target.value }
                                        }));
                                        // Keep direction consistent across all quarters
                                        const direction = editTargetDirections[q]?.[metric.key] || metric.targetDirection;
                                        [1, 2, 3, 4].forEach(quarter => {
                                          setEditTargetDirections(prev => ({ 
                                            ...prev, 
                                            [quarter]: { ...prev[quarter], [metric.key]: direction }
                                          }));
                                        });
                                      }}
                                      placeholder={displayValue}
                                      className="text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                  </TableCell>
                                );
                              })}
                              <TableCell>
                                <Select
                                  value={editTargetDirections[1]?.[metric.key] || metric.targetDirection}
                                  onValueChange={(value: "above" | "below") => {
                                    // Apply direction to all quarters
                                    [1, 2, 3, 4].forEach(q => {
                                      setEditTargetDirections(prev => ({ 
                                        ...prev, 
                                        [q]: { ...prev[q], [metric.key]: value }
                                      }));
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="above">Higher is Better</SelectItem>
                                    <SelectItem value="below">Lower is Better</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setTargetsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveTargets}>
                        Save All Targets
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div ref={scrollContainerRef} className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                     <TableHead className="sticky left-0 bg-muted z-40 w-[200px] min-w-[200px] max-w-[200px] font-bold py-[7.2px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]">
                       Financial Metric
                     </TableHead>
                     {isMonthlyTrendMode ? (
                       <>
                         <TableHead className="text-center min-w-[100px] max-w-[100px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10">
                           Trend
                         </TableHead>
                           {monthlyTrendPeriods.map((period, periodIndex) => (
                            <TableHead 
                              key={period.identifier}
                              ref={periodIndex === monthlyTrendPeriods.length - 1 ? lastMonthlyColumnRef : undefined}
                              className={cn(
                                "text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] sticky top-0 z-10",
                                period.type === 'year-avg' && "bg-primary/10 border-l-2 border-primary/30",
                                period.type === 'year-total' && "bg-primary/10 border-r-2 border-primary/30",
                                period.type === 'month' && "bg-muted/50"
                              )}
                            >
                              {period.type === 'month' ? (
                                <MonthDropZone
                                  monthIdentifier={period.identifier}
                                  departmentId={departmentId}
                                  storeId={storeId || undefined}
                                  storeBrand={storeBrand || undefined}
                                  attachment={attachments[period.identifier]}
                                  siblingAttachment={siblingAttachments[period.identifier]}
                                  onAttachmentChange={() => {
                                    fetchAttachments();
                                    loadFinancialData();
                                    refetchSubMetrics();
                                  }}
                                  copySourceOptions={getCopySourceOptions(period.identifier)}
                                  onCopyFromSource={(sourceId) => handleCopyFromSource(period.identifier, sourceId)}
                                  isCopying={copyingMonth === period.identifier}
                                  copiedFrom={copyMetadata[period.identifier]}
                                  onClearMonthData={() => openClearMonthDialog(period.identifier)}
                                >
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center justify-center gap-1">
                                      {period.label.split(' ')[0]}
                                      {highestProfitMonthsByYear[period.year] === period.identifier && (
                                        <Trophy className="h-3 w-3 text-yellow-500" />
                                      )}
                                    </div>
                                    <div className="text-xs font-normal text-muted-foreground">{period.year}</div>
                                  </div>
                                </MonthDropZone>
                              ) : (
                                <div className="flex flex-col items-center">
                                  <div>{period.type === 'year-avg' ? 'Avg' : 'Total'}</div>
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
                          className="text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10"
                        >
                          {qtr.label}
                        </TableHead>
                      ))
                    ) : (
                      <>
                        <TableHead className="text-center font-bold min-w-[100px] max-w-[100px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Avg</div>
                            <div className="text-xs font-normal text-muted-foreground">{year - 1}</div>
                          </div>
                        </TableHead>
                        {previousYearMonths.map((month) => (
                          <TableHead key={month.identifier} className="text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10">
                            <MonthDropZone
                              monthIdentifier={month.identifier}
                              departmentId={departmentId}
                              storeId={storeId || undefined}
                              storeBrand={storeBrand || undefined}
                              attachment={attachments[month.identifier]}
                              siblingAttachment={siblingAttachments[month.identifier]}
                              onAttachmentChange={() => {
                                fetchAttachments();
                                loadFinancialData();
                                refetchSubMetrics();
                              }}
                              copySourceOptions={getCopySourceOptions(month.identifier)}
                              onCopyFromSource={(sourceId) => handleCopyFromSource(month.identifier, sourceId)}
                              isCopying={copyingMonth === month.identifier}
                              copiedFrom={copyMetadata[month.identifier]}
                              onClearMonthData={() => openClearMonthDialog(month.identifier)}
                            >
                              <div className="flex flex-col items-center">
                                <div className="flex items-center justify-center gap-1">
                                  {month.label.replace(/\s\d{4}$/, '')}
                                </div>
                                <div className="text-xs font-normal text-muted-foreground">
                                  {month.identifier.split('-')[0]}
                                </div>
                              </div>
                            </MonthDropZone>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold min-w-[100px] max-w-[100px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                          <div className="flex flex-col items-center">
                            <div>Q{quarter} Target</div>
                            <div className="text-xs font-normal text-muted-foreground">{year}</div>
                          </div>
                        </TableHead>
                        {months.map((month) => (
                          <TableHead key={month.identifier} className="text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] bg-muted/50 sticky top-0 z-10">
                            <MonthDropZone
                              monthIdentifier={month.identifier}
                              departmentId={departmentId}
                              storeId={storeId || undefined}
                              storeBrand={storeBrand || undefined}
                              attachment={attachments[month.identifier]}
                              siblingAttachment={siblingAttachments[month.identifier]}
                              onAttachmentChange={() => {
                                fetchAttachments();
                                loadFinancialData();
                                refetchSubMetrics();
                              }}
                              copySourceOptions={getCopySourceOptions(month.identifier)}
                              onCopyFromSource={(sourceId) => handleCopyFromSource(month.identifier, sourceId)}
                              isCopying={copyingMonth === month.identifier}
                              copiedFrom={copyMetadata[month.identifier]}
                              onClearMonthData={() => openClearMonthDialog(month.identifier)}
                            >
                              <div className="flex flex-col items-center">
                                <div className="flex items-center justify-center gap-1">
                                  {month.label.replace(/\s\d{4}$/, '')}
                                  {highestProfitMonth === month.identifier && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Trophy className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Highest Department Profit</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                <div className="text-xs font-normal text-muted-foreground">
                                  {month.identifier.split('-')[0]}
                                </div>
                              </div>
                            </MonthDropZone>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold min-w-[100px] max-w-[100px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
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
                  {FINANCIAL_METRICS.map((metric) => {
                    const target = targets[metric.key];
                    const targetDirection = targetDirections[metric.key] || metric.targetDirection;
                    const isDepartmentProfit = metric.key === 'department_profit';
                    const isNetSellingGross = metric.key === 'net_selling_gross';
                    // For percentage metrics with calculation, check sub-metrics under the numerator key
                    const subMetricSourceKey = metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation
                      ? metric.calculation.numerator
                      : metric.key;
                    const metricHasSubMetrics = metric.hasSubMetrics || checkHasSubMetrics(subMetricSourceKey);
                    const isMetricExpanded = expandedMetrics.has(metric.key);
                    const subMetricNames = metricHasSubMetrics ? getSubMetricNames(subMetricSourceKey) : [];
                    const metricHasRock = hasRockForMetric(metric.key);
                    const metricRock = metricHasRock ? getRockForMetric(metric.key) : null;
                    
                    // Determine which months to show sub-metrics for
                    const displayMonthIds = isMonthlyTrendMode 
                      ? monthlyTrendPeriods.filter(p => p.type === 'month').map(p => p.identifier)
                      : [...previousYearMonths.map(m => m.identifier), ...months.map(m => m.identifier)];
                    
                    // Honda brand Total Direct Expenses is always shown (calculated for legacy, manual for Nov 2025+)
                    
                    return (
                      <React.Fragment key={metric.key}>
                      <TableRow 
                        className={cn(
                          "hover:bg-muted/30",
                          isDepartmentProfit && "border-y-2 border-primary/40 bg-primary/5",
                          isNetSellingGross && "border-y border-muted-foreground/20 bg-muted/30",
                          metricHasRock && "bg-amber-50/50 dark:bg-amber-950/20"
                        )}
                      >
                        <TableCell className={cn(
                          "sticky left-0 z-30 py-[7.2px] w-[200px] min-w-[200px] max-w-[200px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]",
                          isDepartmentProfit ? "bg-background border-y-2 border-primary/40" : "bg-background",
                          isNetSellingGross && "bg-muted border-y border-muted-foreground/20",
                          metricHasRock && "border-l-4 border-l-amber-500 bg-amber-100 dark:bg-amber-900/40"
                        )}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  {metricHasRock && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Mountain className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[250px]">
                                          <p className="font-medium text-sm">Rock Target</p>
                                          <p className="text-xs text-muted-foreground">{metricRock?.title}</p>
                                          <p className="text-xs mt-1">
                                            Direction: {metricRock?.target_direction === 'above' ? 'Above' : 'Below'} target
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                  <ExpandableMetricName
                                    metricName={metric.name}
                                    hasSubMetrics={metricHasSubMetrics}
                                    isExpanded={expandedMetrics.has(metric.key)}
                                    onToggle={() => toggleMetricExpansion(metric.key)}
                                    isDepartmentProfit={isDepartmentProfit}
                                    isNetSellingGross={isNetSellingGross}
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-[350px] max-h-[500px] overflow-y-auto">
                                <p className="font-medium">{metric.name}</p>
                                {metric.description && <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>}
                                {metric.key === 'sales_expense' && storeBrand?.toLowerCase().includes('stellantis') && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs font-medium mb-1">Includes:</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                      <li>• Salaries Vacation & Time Off</li>
                                      <li>• Training</li>
                                      <li>• Advertising</li>
                                      <li>• Supplies, Tools & Laundry</li>
                                      <li>• Service Vehicle Expense</li>
                                      <li>• Policy Expense</li>
                                      <li>• Depr, Maint, Repair and Rental</li>
                                    </ul>
                                  </div>
                                )}
                                {metric.key === 'sales_expense' && storeBrand?.toLowerCase().includes('ford') && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs font-medium mb-1">Includes:</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                      <li>• COMP. MGR.</li>
                                      <li>• SAL. OTHER</li>
                                      <li>• COMM. & INC OTHER</li>
                                      <li>• ADVER/PROMO</li>
                                      <li>• ADVERTISING REBATES</li>
                                      <li>• TRAINING</li>
                                      <li>• POLICY ADJ.</li>
                                      <li>• SERV. LOANER</li>
                                      <li>• TOOLS & SUPPLIES</li>
                                      <li>• FREIGHT</li>
                                      <li>• EQ & VEH MAINT</li>
                                      <li>• INV CNTRL & DP</li>
                                      <li>• VAC & TIME-OFF</li>
                                    </ul>
                                  </div>
                                )}
                                {(storeBrand?.toLowerCase().includes('honda')) && (metric.key === 'semi_fixed_expense' || metric.key === 'total_direct_expenses') && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs font-medium mb-1">Includes:</p>
                                    <ul className="text-xs text-muted-foreground space-y-0.5">
                                      <li>• Office Supplies</li>
                                      <li>• Shop Tools-Sundry Supplies</li>
                                      <li>• Courtesy Vehicle</li>
                                      <li>• Laundry-Uniforms</li>
                                      <li>• Janitor Services-Cleaning</li>
                                      <li>• Postage</li>
                                      <li>• Policy Adjustments</li>
                                      <li>• Advertising</li>
                                      <li>• Co-op Advertising Rebate</li>
                                      <li>• Donations</li>
                                      <li>• Company Vehicle</li>
                                      <li>• Inventory Maintenance</li>
                                      <li>• Data Processing</li>
                                      <li>• Training</li>
                                      <li>• Travel-Entertainment</li>
                                      <li>• Telephone-Fax</li>
                                      <li>• Membership Dues & Subscriptions</li>
                                      <li>• Freight-Express</li>
                                      <li>• Outside Services</li>
                                      <li>• Audit-Legal & Collection</li>
                                      <li>• Miscellaneous</li>
                                      <li>• Interest & Bank Charges</li>
                                      <li>• Floor Plan Interest</li>
                                    </ul>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                         </TableCell>
                         {isMonthlyTrendMode ? (
                           <>
                             <TableCell className={cn(
                               "px-1 py-0.5 min-w-[100px] max-w-[100px]",
                               isDepartmentProfit && "bg-primary/5",
                               isNetSellingGross && "bg-muted/30"
                             )}>
                               <Sparkline 
                                 data={monthlyTrendPeriods.filter(p => p.type === 'month').map(period => {
                                   const mKey = `${metric.key}-M${period.month + 1}-${period.year}`;
                                   return precedingQuartersData[mKey];
                                 })}
                               />
                             </TableCell>
                             {monthlyTrendPeriods.map((period, periodIndex) => {
                                 if (period.type === 'month') {
                                   const monthIdentifier = `${period.year}-${String(period.month + 1).padStart(2, '0')}`;
                                   const key = `${metric.key}-${monthIdentifier}`;

                                   const isFordServiceDept =
                                     (storeBrand?.toLowerCase().includes('ford') ?? false) &&
                                     (departmentName?.toLowerCase().includes('service') ?? false);

                                   // For Ford Service, certain metrics should come from the mapped total cell,
                                   // not by summing sub-metrics (which can include overlapping lines and inflate totals).
                                   const fordServiceNoSubMetricSum = ['total_sales', 'sales_expense', 'gp_net'];
                                   const precedingValue = precedingQuartersData[`${metric.key}-M${period.month + 1}-${period.year}`];
                                   // In Monthly Trend mode, entries is NOT populated (loadEntries returns early).
                                   // So we must prefer precedingValue (computed with parent-value-first logic)
                                   // over getValueWithSubMetricFallback (which would fall back to sub-metric sums).
                                   // This prevents showing incorrect sub-metric sums when parent values exist.
                                   const mValue =
                                     isFordServiceDept && fordServiceNoSubMetricSum.includes(metric.key)
                                       ? precedingValue
                                       : (precedingValue ?? getValueWithSubMetricFallback(metric.key, monthIdentifier));
                                   // Check if metric should use calculation for this month (Honda legacy handling)
                                   const isCalculated = !!metric.calculation && shouldUseCalculationForMonth(metric.key, monthIdentifier);
                                  
                                  // For Honda Total Direct Expenses in legacy months, calculate as Sales Expense + Semi Fixed Expense
                                  if (isHondaBrand && metric.key === 'total_direct_expenses' && isHondaLegacyMonth(monthIdentifier)) {
                                    const getVal = (k: string) => {
                                      return getValueWithSubMetricFallback(k, monthIdentifier) ?? precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`];
                                    };
                                    const salesExpense = getVal('sales_expense');
                                    const semiFixedExpense = getVal('semi_fixed_expense');
                                    const calculatedValue = (salesExpense !== undefined && semiFixedExpense !== undefined) 
                                      ? salesExpense + semiFixedExpense 
                                      : undefined;
                                    
                                    return (
                                      <TableCell key={period.identifier} className="px-1 py-0.5 text-center min-w-[125px] max-w-[125px] text-muted-foreground">
                                        {calculatedValue !== undefined ? formatTarget(calculatedValue, 'dollar') : "-"}
                                      </TableCell>
                                    );
                                  }
                                  
                                  // For calculated metrics, just display
                                  if (isCalculated) {
                                    // Calculate the value using the same logic as the standard view
                                    let calculatedValue: number | undefined;
                                    if (metric.calculation && 'numerator' in metric.calculation) {
                                      // For Ford Service, use direct entry values for metrics that would otherwise be inflated by sub-metric summing
                                      const getCalcVal = (k: string) => {
                                        if (isFordServiceDept && fordServiceNoSubMetricSum.includes(k)) {
                                          return precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`] ?? entries[`${k}-${monthIdentifier}`];
                                        }
                                        return getValueWithSubMetricFallback(k, monthIdentifier) ?? precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`];
                                      };
                                      const numVal = getCalcVal(metric.calculation.numerator);
                                      const denVal = getCalcVal(metric.calculation.denominator);
                                      
                                      if (numVal !== null && numVal !== undefined && denVal !== null && denVal !== undefined && denVal !== 0) {
                                        calculatedValue = (numVal / denVal) * 100;
                                      }
                                    } else if (metric.calculation && 'type' in metric.calculation) {
                                      const getVal = (k: string) => {
                                        // For Ford Service, use direct entry values for metrics that would otherwise be inflated by sub-metric summing
                                        if (isFordServiceDept && fordServiceNoSubMetricSum.includes(k)) {
                                          return precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`] ?? entries[`${k}-${monthIdentifier}`] ?? 0;
                                        }
                                       // IMPORTANT: Check precedingQuartersData first for direct DB values
                                       // This ensures stored parent values (e.g., gp_net) take precedence over sub-metric sums
                                       const directValue = precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`];
                                       if (directValue !== undefined && directValue !== null) {
                                         return directValue;
                                       }
                                       // Fall back to entries/sub-metric sum only if no direct value
                                       return getValueWithSubMetricFallback(k, monthIdentifier) ?? 0;
                                      };
                                      
                                      if (metric.calculation.type === 'subtract') {
                                        const base = getVal(metric.calculation.base);
                                        const deductions = metric.calculation.deductions.reduce((sum, key) => sum + getVal(key), 0);
                                        calculatedValue = base - deductions;
                                      } else if (metric.calculation.type === 'complex') {
                                        const base = getVal(metric.calculation.base);
                                        const deductions = metric.calculation.deductions.reduce((sum, key) => sum + getVal(key), 0);
                                        const additions = metric.calculation.additions.reduce((sum, key) => sum + getVal(key), 0);
                                        calculatedValue = base - deductions + additions;
                                      }
                                    }
                                    // Calculate status for calculated metrics using forecast-aware target resolution
                                    const resolvedTarget = getTargetForMonth(metric.key, monthIdentifier, metric);
                                    const targetValue = resolvedTarget?.value ?? null;
                                    const targetDirection = resolvedTarget?.direction ?? metric.targetDirection;
                                    const targetSource = resolvedTarget?.source ?? null;
                                    let status: "success" | "warning" | "destructive" | null = null;
                                    
                                    if (calculatedValue !== null && calculatedValue !== undefined && targetValue !== null) {
                                      const variance = metric.type === "percentage" 
                                        ? calculatedValue - targetValue 
                                        : ((calculatedValue - targetValue) / Math.abs(targetValue)) * 100;
                                      
                                      if (targetDirection === "above") {
                                        status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                                      } else {
                                        status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                                      }
                                    }
                                    
                                    return (
                                        <TableCell
                                          key={period.identifier}
                                          className={cn(
                                            "px-1 py-0.5 text-center min-w-[125px] max-w-[125px] relative",
                                            status === "success" && "bg-success/10",
                                            status === "warning" && "bg-warning/10",
                                            status === "destructive" && "bg-destructive/10",
                                            isDepartmentProfit && "bg-primary/5",
                                            isNetSellingGross && !status && "bg-muted/30"
                                          )}
                                        >
                                          <TrendCellTooltip metricKey={metric.key} metricType={metric.type} monthIdentifier={monthIdentifier}>
                                            <div className={cn(
                                              "w-full h-full flex items-center justify-center",
                                              status === "success" && "text-success font-medium",
                                              status === "warning" && "text-warning font-medium",
                                              status === "destructive" && "text-destructive font-medium"
                                            )}>
                                              {calculatedValue !== null && calculatedValue !== undefined ? formatTarget(calculatedValue, metric.type) : "-"}
                                            </div>
                                          </TrendCellTooltip>
                                        </TableCell>
                                    );
                                  }
                                  
                                  // Editable cells for non-calculated metrics
                                  const localValue = localValues[key];
                                  // If localValue is defined (including empty string for deletions), use it
                                  // Only fall back to mValue if localValue is truly undefined
                                  const displayValue =
                                    localValue !== undefined
                                      ? localValue
                                      : mValue !== null && mValue !== undefined
                                        ? String(mValue)
                                        : "";
                                  
                                  // Calculate status for non-calculated metrics using forecast-aware target resolution
                                  const resolvedTarget2 = getTargetForMonth(metric.key, monthIdentifier, metric);
                                  const targetValue = resolvedTarget2?.value ?? null;
                                  const targetDirection = resolvedTarget2?.direction ?? metric.targetDirection;
                                  const targetSource2 = resolvedTarget2?.source ?? null;
                                  let status: "success" | "warning" | "destructive" | null = null;
                                  
                                  if (mValue !== null && mValue !== undefined && targetValue !== null) {
                                    const variance = metric.type === "percentage" 
                                      ? mValue - targetValue 
                                      : ((mValue - targetValue) / Math.abs(targetValue)) * 100;
                                    
                                    if (targetDirection === "above") {
                                      status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                                    } else {
                                      status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                                    }
                                  }
                                  
                                  return (
                                      <ContextMenu key={period.identifier}>
                                        <ContextMenuTrigger asChild>
                                          <TableCell
                                            className={cn(
                                              "p-1 relative min-w-[125px] max-w-[125px]",
                                              status === "success" && "bg-success/10",
                                              status === "warning" && "bg-warning/10",
                                              status === "destructive" && "bg-destructive/10",
                                              isDepartmentProfit && "bg-primary/5",
                                              isNetSellingGross && !status && "bg-muted/30"
                                            )}
                                          >
                                          <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                                            {(() => {
                                              // Check localValues first (most current), then mValue from entries
                                              // If localValue is defined (even empty string), respect it - don't fall back to mValue
                                              let currentDisplayValue: number | undefined;
                                              if (localValues[key] !== undefined) {
                                                if (localValues[key] !== '') {
                                                  const parsed = parseFloat(localValues[key]);
                                                  if (!isNaN(parsed)) {
                                                    currentDisplayValue = parsed;
                                                  }
                                                }
                                                // Empty string = user deleted, so currentDisplayValue stays undefined (shows placeholder)
                                              } else if (mValue !== null && mValue !== undefined) {
                                                currentDisplayValue = mValue;
                                              }
                                              
                                              // Always render the display div (it sits behind the input)
                                              // This prevents flicker when Enter moves focus via setTimeout
                                              // because there's no gap between input becoming invisible and display div rendering
                                              if (currentDisplayValue !== null && currentDisplayValue !== undefined) {
                                                return (
                                                  <TrendCellTooltip metricKey={metric.key} metricType={metric.type} monthIdentifier={monthIdentifier}>
                                                    <div 
                                                      className={cn(
                                                        "h-full w-full flex items-center justify-center cursor-text",
                                                        status === "success" && "text-success font-medium",
                                                        status === "warning" && "text-warning font-medium",
                                                        status === "destructive" && "text-destructive font-medium"
                                                      )}
                                                      onClick={(e) => {
                                                        const input = (e.currentTarget.parentElement?.querySelector('input') || e.currentTarget.nextElementSibling) as HTMLInputElement;
                                                        input?.focus();
                                                        input?.select();
                                                      }}
                                                    >
                                                      {formatTarget(currentDisplayValue, metric.type)}
                                                    </div>
                                                  </TrendCellTooltip>
                                                );
                                              }
                                              
                                              return (
                                                <div 
                                                  className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                                                  onClick={(e) => {
                                                    const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                                    input?.focus();
                                                  }}
                                                >
                                                  {metric.type === "dollar" ? "$" : metric.type === "percentage" ? "%" : "-"}
                                                </div>
                                              );
                                            })()}
                                            <Input
                                              type="number"
                                              step="any"
                                              value={displayValue}
                                              onChange={(e) => handleValueChange(metric.key, monthIdentifier, e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  saveEntry(metric.key, monthIdentifier);
                                                  
                                                  // Move to the next row
                                                  setTimeout(() => {
                                                    const currentMetricIndex = FINANCIAL_METRICS.findIndex(m => m.key === metric.key);
                                                    if (currentMetricIndex < FINANCIAL_METRICS.length - 1) {
                                                      let nextIndex = currentMetricIndex + 1;
                                                      let nextInput: HTMLInputElement | null = null;
                                                      
                                                      while (nextIndex < FINANCIAL_METRICS.length && !nextInput) {
                                                        nextInput = document.querySelector(
                                                          `input[data-metric-index="${nextIndex}"][data-trend-period-index="${periodIndex}"]`
                                                        ) as HTMLInputElement;
                                                        if (!nextInput) nextIndex++;
                                                      }
                                                      
                                                      if (nextInput) {
                                                        nextInput.focus();
                                                        nextInput.select();
                                                      }
                                                    }
                                                  }, 0);
                                                }
                                                if (e.key === 'Tab') {
                                                  saveEntry(metric.key, monthIdentifier);
                                                }
                                              }}
                                              onFocus={() => {
                                                setFocusedCell(key);
                                                activeCellRef.current = key;
                                              }}
                                              onBlur={() => {
                                                setFocusedCell(null);
                                                saveEntry(metric.key, monthIdentifier);
                                              }}
                                              data-metric-index={FINANCIAL_METRICS.findIndex(m => m.key === metric.key)}
                                              data-trend-period-index={periodIndex}
                                              className={cn(
                                                "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 pointer-events-none focus:pointer-events-auto focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10"
                                              )}
                                              placeholder="-"
                                              disabled={saving[key]}
                                            />
                                            {saving[key] && (
                                              <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                                            )}
                                            {cellIssues.has(`${metric.key}-${monthIdentifier}`) && !saving[key] && (
                                              <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                            )}
                                          </div>
                                        </TableCell>
                                      </ContextMenuTrigger>
                                      <ContextMenuContent className="bg-background z-50">
                                        <ContextMenuItem 
                                          onClick={() => handleCreateIssueFromCell(
                                            metric,
                                            mValue,
                                            targets[metric.key],
                                            period.label,
                                            monthIdentifier
                                          )}
                                        >
                                          <AlertCircle className="h-4 w-4 mr-2" />
                                          Create Issue from Cell
                                        </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                  );
                                }
                               
                               // Year summary columns (avg or total)
                               const summaryYear = period.summaryYear!;
                               const isAvg = period.type === 'year-avg';
                               
                               // Collect all monthly values for the summary year
                               const yearMonthlyValues: number[] = [];
                               for (let m = 0; m < 12; m++) {
                                 const mKey = `${metric.key}-M${m + 1}-${summaryYear}`;
                                 const val = precedingQuartersData[mKey];
                                 if (val !== null && val !== undefined) {
                                   yearMonthlyValues.push(val);
                                 }
                               }
                               
                               let displayValue: number | undefined;
                               
                               if (yearMonthlyValues.length > 0) {
                                 if (metric.type === 'percentage') {
                                   // For percentage metrics, need to recalculate from dollar values
                                   if (metric.calculation && 'numerator' in metric.calculation) {
                                     // Get numerator and denominator totals
                                     const numKey = metric.calculation.numerator;
                                     const denKey = metric.calculation.denominator;
                                     let numTotal = 0;
                                     let denTotal = 0;
                                     let hasData = false;
                                     
                                     for (let m = 0; m < 12; m++) {
                                       const numMKey = `${numKey}-M${m + 1}-${summaryYear}`;
                                       const denMKey = `${denKey}-M${m + 1}-${summaryYear}`;
                                       const numVal = precedingQuartersData[numMKey];
                                       const denVal = precedingQuartersData[denMKey];
                                       
                                       if (numVal !== null && numVal !== undefined) {
                                         numTotal += numVal;
                                         hasData = true;
                                       }
                                       if (denVal !== null && denVal !== undefined) {
                                         denTotal += denVal;
                                       }
                                     }
                                     
                                     if (hasData && denTotal !== 0) {
                                       displayValue = (numTotal / denTotal) * 100;
                                     }
                                   } else {
                                     // Simple average for percentages without calculation
                                     displayValue = isAvg 
                                       ? yearMonthlyValues.reduce((a, b) => a + b, 0) / yearMonthlyValues.length
                                       : yearMonthlyValues.reduce((a, b) => a + b, 0) / yearMonthlyValues.length; // Use avg for non-calculated percentages
                                   }
                                 } else {
                                   // Dollar metrics: sum for total, average for avg
                                   const total = yearMonthlyValues.reduce((a, b) => a + b, 0);
                                   displayValue = isAvg ? total / yearMonthlyValues.length : total;
                                 }
                               }
                               
                               return (
                                 <ContextMenu key={period.identifier}>
                                   <ContextMenuTrigger asChild>
                                     <TableCell
                                       className={cn(
                                         "px-1 py-0.5 text-center min-w-[125px] max-w-[125px] font-medium relative",
                                         period.type === 'year-avg' && "bg-primary/10 border-l-2 border-primary/30",
                                         period.type === 'year-total' && "bg-primary/10 border-r-2 border-primary/30",
                                         isDepartmentProfit && "bg-primary/15",
                                         isNetSellingGross && "bg-muted/40"
                                       )}
                                     >
                                       {displayValue !== null && displayValue !== undefined ? formatTarget(displayValue, metric.type) : "-"}
                                       {cellIssues.has(`${metric.key}-${period.type.replace('-', '')}:${summaryYear}`) && (
                                         <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                       )}
                                     </TableCell>
                                   </ContextMenuTrigger>
                                   <ContextMenuContent className="bg-background z-50">
                                     <ContextMenuItem 
                                       onClick={() => handleCreateIssueFromSummaryCell(
                                         metric,
                                         displayValue,
                                         period.type as 'year-avg' | 'year-total',
                                         summaryYear
                                       )}
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
                            const qKey = `${metric.key}-Q${qtr.quarter}-${qtr.year}`;
                            const qValue = precedingQuartersData[qKey];
                            
                            // Get quarter-specific target from trendTargets, with forecast fallback
                            const quarterYearKey = `Q${qtr.quarter}-${qtr.year}`;
                            const trendTarget = trendTargets[metric.key]?.[quarterYearKey];
                            let targetValue = trendTarget?.value ?? null;
                            let qtrTargetDirection = trendTarget?.direction ?? targetDirections[metric.key] ?? metric.targetDirection;
                            let qtrTargetSource: 'manual' | 'forecast' | null = targetValue !== null && targetValue !== 0 ? 'manual' : null;
                            
                            // Fallback to quarterly average of forecast entries
                            if (!targetValue || targetValue === 0) {
                              const qtrMonthIds = getQuarterMonthsForCalculation(qtr.quarter, qtr.year).map(m => m.identifier);
                              const forecastValues = qtrMonthIds.map(mid => getForecastTarget(metric.key, mid)).filter((v): v is number => v !== null);
                              if (forecastValues.length > 0) {
                                targetValue = forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length;
                                qtrTargetDirection = metric.targetDirection;
                                qtrTargetSource = 'forecast';
                              }
                            }
                            
                            let status: "success" | "warning" | "destructive" | null = null;
                            
                            if (qValue !== null && qValue !== undefined && targetValue !== null && targetValue !== undefined && targetValue !== 0) {
                              const variance = metric.type === "percentage" 
                                ? qValue - targetValue 
                                : ((qValue - targetValue) / Math.abs(targetValue)) * 100;
                              
                              if (qtrTargetDirection === "above") {
                                status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                              } else {
                                status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                              }
                            }
                            
                            return (
                                <TableCell
                                  key={qtr.label}
                                  className={cn(
                                    "px-1 py-0.5 text-center min-w-[125px] max-w-[125px] relative",
                                    status === "success" && "bg-success/10",
                                    status === "warning" && "bg-warning/10",
                                    status === "destructive" && "bg-destructive/10",
                                    !status && "text-muted-foreground",
                                    isDepartmentProfit && "bg-primary/5",
                                    isNetSellingGross && !status && "bg-muted/30"
                                  )}
                                >
                                  <QuarterTrendCellTooltip metricKey={metric.key} metricType={metric.type} quarter={qtr.quarter} qtrYear={qtr.year}>
                                    <div className={cn(
                                      "w-full h-full flex items-center justify-center",
                                      status === "success" && "text-success font-medium",
                                      status === "warning" && "text-warning font-medium",
                                      status === "destructive" && "text-destructive font-medium"
                                    )}>
                                      {qValue !== null && qValue !== undefined ? formatTarget(qValue, metric.type) : "-"}
                                    </div>
                                  </QuarterTrendCellTooltip>
                                </TableCell>
                            );
                          })
                        ) : (
                          <>
                            {(() => {
                              // Previous Year Quarter Average
                              const prevYearQuarter = quarter;
                              const qKey = `${metric.key}-Q${prevYearQuarter}-${year - 1}`;
                              const qValue = precedingQuartersData[qKey];
                              const targetInfo = precedingQuarterTargets[qKey];
                              
                              let status: "success" | "warning" | "destructive" | null = null;
                              
                              if (qValue !== null && qValue !== undefined && targetInfo?.value) {
                                const target = targetInfo.value;
                                const targetDirection = targetInfo.direction || metric.targetDirection;
                                
                                const variance = metric.type === "percentage" 
                                  ? qValue - target 
                                  : ((qValue - target) / Math.abs(target)) * 100;
                                
                                if (targetDirection === "above") {
                                  status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                                } else {
                                  status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                                }
                              }
                              
                              return (
                                <TableCell 
                                  className={cn(
                                    "text-center py-[7.2px] min-w-[100px] max-w-[100px] bg-primary/10 border-x-2 border-primary/30",
                                    isDepartmentProfit && "z-10",
                                    status === "success" && "bg-success/10 text-success font-medium",
                                    status === "warning" && "bg-warning/10 text-warning font-medium",
                                    status === "destructive" && "bg-destructive/10 text-destructive font-medium",
                                    !status && "text-muted-foreground"
                                  )}
                                >
                                  {qValue !== null && qValue !== undefined ? formatTarget(qValue, metric.type) : "-"}
                                </TableCell>
                              );
                            })()}
                            {previousYearMonths.map((month) => {
                          const key = `${metric.key}-${month.identifier}`;
                          // Use sub-metric sum fallback if no manual entry exists
                          let value = getValueWithSubMetricFallback(metric.key, month.identifier);
                          
                          // Helper function to get value for a metric (handles calculated fields + sub-metric fallback)
                          // Note: For deductions like sales_expense, we MUST allow sub-metric sums because some stores
                          // only have sub-metrics without a parent total.
                          const getValueForMetric = (metricKey: string, isForCalculation: boolean = false): number | undefined => {
                            // Always try to get the value with sub-metric fallback for deductions
                            const fallbackValue = getValueWithSubMetricFallback(metricKey, month.identifier, false);
                            if (fallbackValue !== null && fallbackValue !== undefined) {
                              return fallbackValue;
                            }
                            
                            // Check if this metric is calculated
                            const sourceMetric = FINANCIAL_METRICS.find(m => m.key === metricKey);
                            // For Honda legacy months, skip calculation for semi_fixed_expense
                            if (!sourceMetric || !sourceMetric.calculation || !shouldUseCalculationForMonth(metricKey, month.identifier)) {
                              return undefined;
                            }
                            
                            // Handle dollar subtraction/complex calculations
                            if (sourceMetric.type === "dollar" && 'type' in sourceMetric.calculation && (sourceMetric.calculation.type === 'subtract' || sourceMetric.calculation.type === 'complex')) {
                              const baseValue = getValueForMetric(sourceMetric.calculation.base, true);
                              if (baseValue === null || baseValue === undefined) return undefined;
                              
                              let calculatedValue = baseValue;
                              for (const deduction of sourceMetric.calculation.deductions) {
                                // For deductions, allow sub-metric sums (pass false)
                                const deductionValue = getValueForMetric(deduction, false);
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (sourceMetric.calculation.type === 'complex' && 'additions' in sourceMetric.calculation) {
                                for (const addition of sourceMetric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition, false);
                                  calculatedValue += (additionValue || 0);
                                }
                              }
                              
                              return calculatedValue;
                            }
                            
                            return undefined;
                          };
                          
                          // Calculate percentage metrics automatically if calculation is defined
                          const isPercentageCalculated = metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation;
                          if (isPercentageCalculated && metric.calculation && 'numerator' in metric.calculation) {
                            const numeratorValue = getValueForMetric(metric.calculation.numerator);
                            const denominatorValue = getValueForMetric(metric.calculation.denominator);
                            
                            if (numeratorValue !== null && numeratorValue !== undefined && 
                                denominatorValue !== null && denominatorValue !== undefined && 
                                denominatorValue !== 0) {
                              value = (numeratorValue / denominatorValue) * 100;
                            } else {
                              value = undefined;
                            }
                          }
                          
                          // Calculate dollar subtraction/complex metrics automatically if calculation is defined
                          // For Honda, skip calculation for Semi Fixed Expense in legacy months (before Nov 2025)
                          const shouldCalculate = shouldUseCalculationForMonth(metric.key, month.identifier);
                          const isDollarCalculated = shouldCalculate && metric.type === "dollar" && metric.calculation && 'type' in metric.calculation && (metric.calculation.type === 'subtract' || metric.calculation.type === 'complex');
                          if (isDollarCalculated && metric.calculation && 'type' in metric.calculation) {
                            // Pass true to use stored values for base, but allow sub-metric sums for deductions
                            const baseValue = getValueForMetric(metric.calculation.base, true);
                            
                            if (baseValue !== null && baseValue !== undefined) {
                              let calculatedValue = baseValue;
                              for (const deduction of metric.calculation.deductions) {
                                // For deductions, allow sub-metric sums (pass false)
                                const deductionValue = getValueForMetric(deduction, false);
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (metric.calculation.type === 'complex' && 'additions' in metric.calculation) {
                                for (const addition of metric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition, false);
                                  calculatedValue += (additionValue || 0);
                                }
                              }
                              
                              value = calculatedValue;
                            } else {
                              value = undefined;
                            }
                          }
                          
                          // For Honda Total Direct Expenses in legacy months, calculate as Sales Expense + Semi Fixed Expense
                          if (isHondaBrand && metric.key === 'total_direct_expenses' && isHondaLegacyMonth(month.identifier)) {
                            const salesExpense = getValueForMetric('sales_expense');
                            const semiFixedExpense = getValueForMetric('semi_fixed_expense');
                            if (salesExpense !== undefined && semiFixedExpense !== undefined) {
                              value = salesExpense + semiFixedExpense;
                            }
                          }

                          // Get target from previous year quarter targets
                          const prevYearQuarterKey = `${metric.key}-Q${quarter}-${year - 1}`;
                          const targetInfo = precedingQuarterTargets[prevYearQuarterKey];
                          
                          let status: "success" | "warning" | "destructive" | null = null;
                          
                          if (value !== null && value !== undefined && targetInfo?.value) {
                            const target = targetInfo.value;
                            const targetDir = targetInfo.direction || metric.targetDirection;
                            
                            const variance = metric.type === "percentage" 
                              ? value - target 
                              : ((value - target) / Math.abs(target)) * 100;
                            
                            if (targetDir === "above") {
                              status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                            } else {
                              status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                            }
                          }

                          return (
                            <TableCell
                              key={month.identifier}
                              className={cn(
                                "text-center py-[7.2px] min-w-[125px] max-w-[125px]",
                                isDepartmentProfit && "z-10 bg-background",
                                status === "success" && "bg-success/10",
                                status === "warning" && "bg-warning/10",
                                status === "destructive" && "bg-destructive/10",
                                !status && "text-muted-foreground"
                              )}
                            >
                              <TrendCellTooltip metricKey={metric.key} metricType={metric.type} monthIdentifier={month.identifier}>
                                <span className={cn(
                                  "block w-full",
                                  status === "success" && "text-success font-medium",
                                  status === "warning" && "text-warning font-medium",
                                  status === "destructive" && "text-destructive font-medium"
                                )}>
                                  {value !== null && value !== undefined ? formatTarget(value, metric.type) : "-"}
                                </span>
                              </TrendCellTooltip>
                            </TableCell>
                          );
                          })}
                          <TableCell className={cn(
                            "text-center py-[7.2px] min-w-[100px] bg-background border-x-2 border-primary/30",
                            isDepartmentProfit && "z-10"
                          )}>
                            {canEditTargets() && editingTarget === metric.key ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                step="any"
                                value={targetEditValue}
                                onChange={(e) => setTargetEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleTargetSave(metric.key);
                                  if (e.key === 'Escape') setEditingTarget(null);
                                }}
                                className="w-20 h-7 text-center"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleTargetSave(metric.key)}
                                className="h-7 px-2"
                              >
                                ✓
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-2">
                              {(() => {
                                // Show manual target, or fall back to average forecast for the quarter
                                const hasManualTarget = target !== null && target !== undefined && target !== 0;
                                let displayTarget = target;
                                let isForecastTarget = false;
                                
                                if (!hasManualTarget && hasForecastTargets) {
                                  const qtrMonths = getQuarterMonthsForCalculation(quarter, year).map(m => m.identifier);
                                  const forecastVals = qtrMonths.map(mid => getForecastTarget(metric.key, mid)).filter((v): v is number => v !== null);
                                  if (forecastVals.length > 0) {
                                    displayTarget = forecastVals.reduce((s, v) => s + v, 0) / forecastVals.length;
                                    isForecastTarget = true;
                                  }
                                }
                                
                                return (
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      canEditTargets() && "cursor-pointer hover:text-foreground",
                                      isForecastTarget && "text-primary/70"
                                    )}
                                    onClick={() => canEditTargets() && handleTargetEdit(metric.key)}
                                    title={isForecastTarget ? "From forecast" : undefined}
                                  >
                                    {formatTarget(displayTarget, metric.type)}
                                  </span>
                                );
                              })()}
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
                                      onClick={() => handleCopyToQuarters(metric.key)}
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
                        {months.map((month, monthIndex) => {
                          const key = `${metric.key}-${month.identifier}`;
                          // Use sub-metric sum fallback if no manual entry exists
                          let value = getValueWithSubMetricFallback(metric.key, month.identifier);
                          const metricIndex = FINANCIAL_METRICS.findIndex(m => m.key === metric.key);
                          
                          // Helper function to get value for a metric (handles calculated fields + sub-metric fallback)
                          // Note: For deductions like sales_expense, we MUST allow sub-metric sums because some stores
                          // only have sub-metrics without a parent total. Only skip sub-metric sums for specific metrics
                          // like total_direct_expenses where sub-metrics represent only a portion.
                          const getValueForMetric = (metricKey: string, isForCalculation: boolean = false): number | undefined => {
                            // For calculation bases (like gp_net), we skip sub-metric sum fallback
                            // But for deductions (like sales_expense), we NEED the sub-metric sum if no direct entry exists
                            // The skipSubMetricSum logic in getValueWithSubMetricFallback already handles total_direct_expenses specially
                            const fallbackValue = getValueWithSubMetricFallback(metricKey, month.identifier, false);
                            if (fallbackValue !== null && fallbackValue !== undefined) {
                              return fallbackValue;
                            }
                            
                            // Check if this metric is calculated
                            const sourceMetric = FINANCIAL_METRICS.find(m => m.key === metricKey);
                            // For Honda legacy months, skip calculation for semi_fixed_expense
                            if (!sourceMetric || !sourceMetric.calculation || !shouldUseCalculationForMonth(metricKey, month.identifier)) {
                              return undefined;
                            }
                            
                            // Handle dollar subtraction/complex calculations
                            if (sourceMetric.type === "dollar" && 'type' in sourceMetric.calculation && (sourceMetric.calculation.type === 'subtract' || sourceMetric.calculation.type === 'complex')) {
                              const baseValue = getValueForMetric(sourceMetric.calculation.base, true);
                              if (baseValue === null || baseValue === undefined) return undefined;
                              
                              let calculatedValue = baseValue;
                              for (const deduction of sourceMetric.calculation.deductions) {
                                // For deductions, allow sub-metric sums (pass false)
                                const deductionValue = getValueForMetric(deduction, false);
                                // Treat missing deductions as 0 (no expense = 0)
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (sourceMetric.calculation.type === 'complex' && 'additions' in sourceMetric.calculation) {
                                for (const addition of sourceMetric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition, false);
                                  calculatedValue += (additionValue || 0);
                                }
                              }
                              
                              return calculatedValue;
                            }
                            
                            return undefined;
                          };
                          
                          // Calculate percentage metrics automatically if calculation is defined
                          const isPercentageCalculated = metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation;
                          if (isPercentageCalculated && metric.calculation && 'numerator' in metric.calculation) {
                            const numeratorValue = getValueForMetric(metric.calculation.numerator);
                            const denominatorValue = getValueForMetric(metric.calculation.denominator);
                            
                            if (numeratorValue !== null && numeratorValue !== undefined && 
                                denominatorValue !== null && denominatorValue !== undefined && 
                                denominatorValue !== 0) {
                              value = (numeratorValue / denominatorValue) * 100;
                            } else {
                              value = undefined;
                            }
                          }
                          
                          // Calculate dollar subtraction/complex metrics automatically if calculation is defined
                          // For Honda, skip calculation for Semi Fixed Expense in legacy months (before Nov 2025)
                          const shouldCalculate = shouldUseCalculationForMonth(metric.key, month.identifier);
                          const isDollarCalculated = shouldCalculate && metric.type === "dollar" && metric.calculation && 'type' in metric.calculation && (metric.calculation.type === 'subtract' || metric.calculation.type === 'complex');
                          if (isDollarCalculated && metric.calculation && 'type' in metric.calculation) {
                            // Pass true to use stored values for base, but allow sub-metric sums for deductions
                            const baseValue = getValueForMetric(metric.calculation.base, true);
                            
                            if (baseValue !== null && baseValue !== undefined) {
                              let calculatedValue = baseValue;
                              for (const deduction of metric.calculation.deductions) {
                                // For deductions, allow sub-metric sums (pass false)
                                const deductionValue = getValueForMetric(deduction, false);
                                // Treat missing deductions as 0 (no expense = 0)
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (metric.calculation.type === 'complex' && 'additions' in metric.calculation) {
                                for (const addition of metric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition, false);
                                  calculatedValue += (additionValue || 0);
                                }
                              }
                              
                              value = calculatedValue;
                            } else {
                              value = undefined;
                            }
                          }
                          
                          // For Honda Total Direct Expenses in legacy months, calculate as Sales Expense + Semi Fixed Expense
                          if (isHondaBrand && metric.key === 'total_direct_expenses' && isHondaLegacyMonth(month.identifier)) {
                            const salesExpense = getValueForMetric('sales_expense');
                            const semiFixedExpense = getValueForMetric('semi_fixed_expense');
                            if (salesExpense !== undefined && semiFixedExpense !== undefined) {
                              value = salesExpense + semiFixedExpense;
                            }
                          }
                          
                          // Determine if this is a calculated field (both percentage and dollar calculations)
                          // Also include Honda legacy Total Direct Expenses as calculated
                          const isHondaLegacyTotalDirect = isHondaBrand && metric.key === 'total_direct_expenses' && isHondaLegacyMonth(month.identifier);
                          const isCalculated = isPercentageCalculated || isDollarCalculated || isHondaLegacyTotalDirect;
                          
                          // Calculate status based on target and value, with forecast fallback
                          const resolvedMonthTarget = getTargetForMonth(metric.key, month.identifier, metric);
                          const effectiveTarget = resolvedMonthTarget?.value ?? target;
                          const effectiveDir = resolvedMonthTarget?.direction ?? targetDirection;
                          const monthTargetSource = resolvedMonthTarget?.source ?? (target ? 'manual' : null);
                          let status = "default";
                          if (value !== null && value !== undefined && effectiveTarget) {
                            const variance = metric.type === "percentage" 
                              ? value - effectiveTarget 
                              : ((value - effectiveTarget) / Math.abs(effectiveTarget)) * 100;
                            
                            if (effectiveDir === "above") {
                              // Higher is better
                              status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                            } else {
                              // Lower is better (invert the logic)
                              status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                            }
                          }
                          
                          return (
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <TableCell
                                  key={month.identifier}
                                  className={cn(
                                    "p-1 relative min-w-[125px] max-w-[125px]",
                                    isDepartmentProfit && "z-10 bg-background",
                                    status === "success" && "bg-success/10",
                                    status === "warning" && "bg-warning/10",
                                    status === "destructive" && "bg-destructive/10"
                                  )}
                                >
                                  <TrendCellTooltip metricKey={metric.key} metricType={metric.type} monthIdentifier={month.identifier}>
                                  <div className="w-full">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                                          {isCalculated ? (
                                            // Display calculated values as read-only
                                            <>
                                              <div className={cn(
                                                "text-center h-8 flex items-center justify-center flex-1 min-w-0 max-w-[105px]",
                                                status === "success" && "text-success font-medium",
                                                status === "warning" && "text-warning font-medium",
                                                status === "destructive" && "text-destructive font-medium",
                                                "text-muted-foreground"
                                              )}>
                                                {value !== null && value !== undefined ? formatTarget(value, metric.type) : "-"}
                                              </div>
                                              {notes[key] && !cellIssues.has(`${metric.key}-${month.identifier}`) && (
                                                <StickyNote className="h-3 w-3 absolute top-1 right-1 text-primary" />
                                              )}
                                              {cellIssues.has(`${metric.key}-${month.identifier}`) && (
                                                <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                              )}
                                            </>
                                          ) : (
                                             // Manual input for non-calculated metrics
                                             <>
                                              {(() => {
                                                 const isFocused = focusedCell === key;
                                                 
                                                 // Determine display value - check localValues first (most current), then entries
                                                 // If localValue is defined (even empty string), respect it - don't fall back to value
                                                 let displayValue: number | undefined;
                                                 if (localValues[key] !== undefined) {
                                                   if (localValues[key] !== '') {
                                                     const parsed = parseFloat(localValues[key]);
                                                     if (!isNaN(parsed)) {
                                                       displayValue = parsed;
                                                     }
                                                   }
                                                   // Empty string = user deleted, so displayValue stays undefined (shows placeholder)
                                                 } else if (value !== null && value !== undefined) {
                                                   displayValue = value;
                                                 }
                                                 
                                                 // Only show display div when not focused
                                                 if (isFocused) {
                                                   return null;
                                                 }
                                                 
                                                 // Show value if we have one
                                                 if (displayValue !== null && displayValue !== undefined) {
                                                   return (
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
                                                       {formatTarget(displayValue, metric.type)}
                                                     </div>
                                                   );
                                                 }
                                                 
                                                 // Empty state - show placeholder symbols
                                                 return (
                                                   <div className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                                                     onClick={(e) => {
                                                       const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                                       input?.focus();
                                                     }}
                                                   >
                                                     {metric.type === "dollar" ? "$" : metric.type === "percentage" ? "%" : "-"}
                                                   </div>
                                                 );
                                               })()}
                                                <Input
                                                  type="number"
                                                  step="any"
                                                  value={(() => {
                                                    const lv = localValues[key];
                                                    // If localValue is defined (including empty for deletions), use it
                                                    if (lv !== undefined) return lv;
                                                    return value !== null && value !== undefined ? String(value) : "";
                                                  })()}
                                                  onChange={(e) =>
                                                    handleValueChange(metric.key, month.identifier, e.target.value)
                                                  }
                                                 onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                      e.preventDefault();
                                                      saveEntry(metric.key, month.identifier);
                                                      
                                                      // Move to next input
                                                      setTimeout(() => {
                                                        if (metricIndex < FINANCIAL_METRICS.length - 1) {
                                                          let nextIndex = metricIndex + 1;
                                                          let nextInput: HTMLInputElement | null = null;
                                                          
                                                          while (nextIndex < FINANCIAL_METRICS.length && !nextInput) {
                                                            nextInput = document.querySelector(
                                                              `input[data-metric-index="${nextIndex}"][data-month-index="${monthIndex}"]`
                                                            ) as HTMLInputElement;
                                                            if (!nextInput) nextIndex++;
                                                          }
                                                          
                                                          if (nextInput) {
                                                            nextInput.focus();
                                                            nextInput.select();
                                                          }
                                                        }
                                                      }, 0);
                                                    }
                                                    if (e.key === 'Tab') {
                                                      saveEntry(metric.key, month.identifier);
                                                    }
                                                  }}
                                                  onFocus={() => {
                                                    setFocusedCell(key);
                                                    activeCellRef.current = key;
                                                  }}
                                                  onBlur={() => {
                                                    setFocusedCell(null);
                                                    saveEntry(metric.key, month.identifier);
                                                  }}
                                                 data-metric-index={metricIndex}
                                                 data-month-index={monthIndex}
                                                className={cn(
                                                  "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10",
                                                  status === "success" && "text-success font-medium",
                                                  status === "warning" && "text-warning font-medium",
                                                  status === "destructive" && "text-destructive font-medium",
                                                  saving[key] && "opacity-50"
                                                )}
                                                 disabled={saving[key]}
                                               />
                                              {saving[key] && (
                                                <Loader2 className="h-3 w-3 animate-spin absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground z-20" />
                                              )}
                                              {notes[key] && !cellIssues.has(`${metric.key}-${month.identifier}`) && (
                                                <StickyNote className="h-3 w-3 absolute top-1 right-1 text-primary z-20" />
                                              )}
                                              {cellIssues.has(`${metric.key}-${month.identifier}`) && !saving[key] && (
                                                <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      {notes[key] && (
                                        <TooltipContent className="max-w-xs bg-popover text-popover-foreground z-50">
                                          <div 
                                            className="text-sm prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md" 
                                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(notes[key]) }}
                                          />
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                  </div>
                                  </TrendCellTooltip>
                                </TableCell>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48 bg-popover z-50">
                                <ContextMenuItem onClick={() => handleOpenNoteDialog(metric.key, month.identifier)}>
                                  <StickyNote className="h-4 w-4 mr-2" />
                                  {notes[key] ? "Edit Note" : "Add Note"}
                                </ContextMenuItem>
                                <ContextMenuItem 
                                  onClick={() => handleCreateIssueFromCell(
                                    metric,
                                    value,
                                    target,
                                    month.label,
                                    month.identifier
                                  )}
                                >
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Create Issue from Cell
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
                        {/* Current Year Quarter Average */}
                        <TableCell 
                          className={cn(
                            "text-center py-0.5 min-w-[100px] max-w-[100px] bg-primary/10 border-x-2 border-primary/30",
                            isDepartmentProfit && "bg-primary/5"
                          )}
                        >
                          {(() => {
                            const qKey = `${metric.key}-Q${quarter}-${year}`;
                            const qValue = precedingQuartersData[qKey];
                            return qValue !== null && qValue !== undefined ? formatTarget(qValue, metric.type) : "-";
                          })()}
                        </TableCell>
                        </>
                      )}
                      </TableRow>
                      {/* Sub-metrics rows for expandable metrics */}
                      <SubMetricsRow
                        subMetrics={subMetricNames.map((name, idx) => {
                          // Find the order index from the raw sub-metrics data
                          // Use subMetricSourceKey (numerator for percentage metrics)
                          const subMetricEntry = allSubMetrics.find(
                            sm => sm.parentMetricKey === subMetricSourceKey && sm.name === name
                          );
                          return { 
                            name, 
                            value: null,
                            orderIndex: subMetricEntry?.orderIndex ?? idx 
                          };
                        })}
                        isExpanded={isMetricExpanded}
                        monthIdentifiers={displayMonthIds}
                        formatValue={(val) => val !== null ? formatTarget(val, metric.type) : "-"}
                        getSubMetricValue={(subMetricName, monthId) => {
                          // Use calculated value for gp_percent sub-metrics (e.g., Unapplied Time GP %)
                          if (metric.key === 'gp_percent') {
                            return getCalculatedSubMetricValue(
                              metric.key, 
                              subMetricName, 
                              monthId, 
                              (metricKey, mId) => getValueWithSubMetricFallback(metricKey, mId) ?? null
                            );
                          }
                          return getSubMetricValue(metric.key, subMetricName, monthId);
                        }}
                        periods={isMonthlyTrendMode 
                          ? monthlyTrendPeriods.map(p => ({ 
                              identifier: p.identifier, 
                              type: p.type,
                              year: p.type === 'month' ? p.year : p.summaryYear
                            })) 
                          : isQuarterTrendMode 
                            ? undefined 
                            : [
                                // Q Avg (previous year)
                                { identifier: `q${quarter}-avg-${year - 1}`, type: 'quarter-avg' as const, year: year - 1 },
                                // Previous year months
                                ...previousYearMonths.map(m => ({ identifier: m.identifier, type: 'month' as const, year: year - 1 })),
                                // Q Target (current year)
                                { identifier: `q${quarter}-target-${year}`, type: 'quarter-target' as const, year: year },
                                // Current year months
                                ...months.map(m => ({ identifier: m.identifier, type: 'month' as const, year: year })),
                                // Q Avg (current year)
                                { identifier: `q${quarter}-avg-${year}`, type: 'quarter-avg' as const, year: year },
                              ]
                        }
                        hasSparklineColumn={isMonthlyTrendMode}
                        parentTargetDirection={metric.targetDirection}
                        parentMetricKey={metric.key}
                        quarter={quarter}
                        currentYear={year}
                        getSubMetricTarget={(subMetricName, q, y) => 
                          getSubMetricTarget(metric.key, subMetricName, q, y)
                        }
                        onSaveSubMetricTarget={async (subMetricName, orderIndex, q, y, value) => {
                          const success = await saveSubMetricTarget(
                            metric.key, subMetricName, orderIndex, q, y, value
                          );
                          if (success) {
                            toast({
                              title: "Success",
                              description: "Sub-metric target saved",
                            });
                          } else {
                            toast({
                              title: "Error",
                              description: "Failed to save sub-metric target",
                              variant: "destructive",
                            });
                          }
                          return success;
                        }}
                        canEdit={canEditTargets()}
                        onSaveSubMetricValue={async (subMetricName, orderIndex, monthId, value) => {
                          const success = await saveSubMetricValue(
                            metric.key, subMetricName, monthId, value, orderIndex
                          );
                          if (success) {
                            // Refetch sub-metrics to update display
                            refetchSubMetrics();
                            // Reload preceding quarters data to update calculations
                            loadPrecedingQuartersData();
                          } else {
                            toast({
                              title: "Error",
                              description: "Failed to save sub-metric value",
                              variant: "destructive",
                            });
                          }
                          return success;
                        }}
                        isPercentageMetric={metric.type === 'percentage'}
                        percentageCalculation={
                          metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation
                            ? { numerator: metric.calculation.numerator, denominator: metric.calculation.denominator }
                            : undefined
                        }
                        getSubMetricValueForParent={(parentKey, subMetricName, monthId) => 
                          getSubMetricValue(parentKey, subMetricName, monthId)
                        }
                        getParentMetricTotal={(metricKey, monthIds) => {
                          // Sum up the parent metric's values across the given month IDs
                          const values = monthIds.map(monthId => 
                            getValueWithSubMetricFallback(metricKey, monthId) ?? null
                          );
                          const validValues = values.filter((v): v is number => v !== null);
                          if (validValues.length === 0) return null;
                          return validValues.reduce((sum, v) => sum + v, 0);
                        }}
                        quarterTrendPeriods={isQuarterTrendMode ? quarterTrendPeriods : undefined}
                        getQuarterMonths={(q, y) => {
                          const quarterMonths = getQuarterMonthsForCalculation(q, y);
                          return quarterMonths.map(m => m.identifier);
                        }}
                        departmentId={departmentId}
                        onCreateIssue={(subMetricName, value, periodLabel, periodIdentifier, periodType) => {
                          handleCreateIssueFromSubMetricCell(
                            metric.key,
                            subMetricName,
                            value,
                            periodLabel,
                            periodIdentifier,
                            periodType
                          );
                        }}
                        cellIssues={cellIssues}
                        hasRockForSubMetric={hasRockForSubMetric}
                        getRockForSubMetric={getRockForSubMetric}
                        getForecastTarget={(subMetricName, monthId) => {
                          // Build the forecast metric_name key matching how forecast entries store sub-metrics
                          // For percentage metrics, try the percentage parent key first (e.g. sub:gp_percent:001:NAME)
                          // to avoid returning dollar values formatted as percentages
                          const dollarParentKey = metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation
                            ? metric.calculation.numerator : metric.key;
                          const percentParentKey = metric.key;
                          
                          const subMetricEntry = allSubMetrics.find(
                            sm => sm.parentMetricKey === dollarParentKey && sm.name === subMetricName
                          );
                          if (subMetricEntry) {
                            const orderStr = String(subMetricEntry.orderIndex).padStart(3, '0');
                            
                            // For percentage metrics, try percentage key first
                            if (metric.type === 'percentage' && percentParentKey !== dollarParentKey) {
                              const pKey = `sub:${percentParentKey}:${orderStr}:${subMetricName}`;
                              const pVal = getForecastTarget(pKey, monthId);
                              if (pVal !== null) return pVal;
                              const pKey2 = `sub:${percentParentKey}:${subMetricEntry.orderIndex}:${subMetricName}`;
                              const pVal2 = getForecastTarget(pKey2, monthId);
                              if (pVal2 !== null) return pVal2;
                              // Don't fall back to dollar key for percentage metrics
                              return null;
                            }
                            
                            const fKey = `sub:${dollarParentKey}:${orderStr}:${subMetricName}`;
                            const val = getForecastTarget(fKey, monthId);
                            if (val !== null) return val;
                            const fKey2 = `sub:${dollarParentKey}:${subMetricEntry.orderIndex}:${subMetricName}`;
                            const val2 = getForecastTarget(fKey2, monthId);
                            if (val2 !== null) return val2;
                          }
                          return null;
                        }}
                        precedingQuartersData={precedingQuartersData}
                        formatTargetForTooltip={formatTarget}
                        metricType={metric.type}
                        subMetricSourceKey={subMetricSourceKey}
                      />
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-md bg-popover z-50">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription>
              Add a note to this cell. It will appear when you hover over it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Note</Label>
              <RichTextEditor
                value={currentNote}
                onChange={setCurrentNote}
                placeholder="Type or paste (Cmd+V) your notes and images here..."
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNote}>
                Save Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FinancialDataImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={() => {
          loadFinancialData();
          toast({ title: "Success", description: "Financial data imported successfully" });
        }}
      />

      <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste Financial Data</DialogTitle>
            <DialogDescription>
              Paste tab-separated values starting from a specific month and year
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paste-year">Starting Year</Label>
                <Select value={pasteYear.toString()} onValueChange={(value) => {
                  setPasteYear(parseInt(value));
                  handlePasteDataChange(pasteData);
                }}>
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
                <Select value={pasteMonth} onValueChange={(value) => {
                  setPasteMonth(value);
                  handlePasteDataChange(pasteData);
                }}>
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
                      { value: "12", label: "December" }
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
              <Label htmlFor="paste-metric">Select Metric</Label>
              <Select value={pasteMetric} onValueChange={(value) => {
                setPasteMetric(value);
                handlePasteDataChange(pasteData);
              }}>
                <SelectTrigger id="paste-metric">
                  <SelectValue placeholder="Choose a metric..." />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_METRICS.filter(m => !m.calculation).map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {metric.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paste-values">Paste Values</Label>
              <Input
                id="paste-values"
                placeholder="Paste tab-separated values here (e.g., 150000  160000  155000...)"
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
                        <TableHead>Month</TableHead>
                        <TableHead>Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedPasteData.map((entry, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{entry.month}</TableCell>
                          <TableCell>{entry.value.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setPasteDialogOpen(false);
              setPasteData("");
              setPasteMetric("");
              setPasteMonth("");
              setParsedPasteData([]);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handlePasteSave}
              disabled={parsedPasteData.length === 0}
            >
              Save {parsedPasteData.length} Entries
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Issue Creation Dialog - triggered from cell context menu */}
      <IssueManagementDialog
        departmentId={departmentId}
        onIssueAdded={() => {
          setIssueDialogOpen(false);
          // Refresh cell issues to show the new flag
          if (issueContext?.sourceMetricName && issueContext?.sourcePeriod) {
            setCellIssues(prev => new Set([...prev, `${issueContext.sourceMetricName}-${issueContext.sourcePeriod}`]));
          }
          setIssueContext(null);
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
        sourceType="financial"
        sourceMetricName={issueContext?.sourceMetricName}
        sourcePeriod={issueContext?.sourcePeriod}
      />
      
      <ForecastDrawer
        open={forecastDrawerOpen}
        onOpenChange={(open) => {
          setForecastDrawerOpen(open);
          if (!open) {
            refetchForecastTargets();
          }
        }}
        departmentId={departmentId}
        departmentName={departmentName || 'Department'}
        onTargetsPushed={loadTargets}
      />

      {/* Clear Month Data Confirmation Dialog */}
      <AlertDialog open={clearMonthDialogOpen} onOpenChange={setClearMonthDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Month Data</AlertDialogTitle>
            <AlertDialogDescription>
              {clearMonthTarget && (() => {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                                   'July', 'August', 'September', 'October', 'November', 'December'];
                const [yearStr, monthStr] = clearMonthTarget.split('-');
                const monthIndex = parseInt(monthStr) - 1;
                return `This will permanently delete all financial data for ${monthNames[monthIndex]} ${yearStr}. This action cannot be undone.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearMonthTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmClearMonth}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
