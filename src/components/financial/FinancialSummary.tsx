import React, { useState, useEffect, useRef, useMemo } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, ChevronUp, DollarSign, Loader2, Settings, StickyNote, Copy, Upload, ClipboardPaste, Trophy, AlertCircle, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getMetricsForBrand, isHondaLegacyMonth, type FinancialMetric } from "@/config/financialMetrics";
import { FinancialDataImport } from "./FinancialDataImport";
import { Sparkline } from "@/components/ui/sparkline";
import { IssueManagementDialog } from "@/components/issues/IssueManagementDialog";

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
  
  // Start from Q1 of last year
  for (let y = startYear; y <= currentYear; y++) {
    const startQ = y === startYear ? 1 : 1;
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

const getMonthlyTrendPeriods = (currentYear: number): MonthlyTrendPeriod[] => {
  const periods: MonthlyTrendPeriod[] = [];
  const startYear = currentYear - 1;
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Add ALL months from last year (January through December) for paste flexibility
  for (let m = 0; m < 12; m++) {
    periods.push({
      month: m,
      year: startYear,
      label: `${monthNames[m]} ${startYear}`,
      identifier: `${startYear}-${String(m + 1).padStart(2, '0')}`,
      type: 'month',
    });
  }
  
  // Add year-end summary columns for the previous year (after December)
  periods.push({
    month: -1,
    year: startYear,
    label: `Avg ${startYear}`,
    identifier: `avg-${startYear}`,
    type: 'year-avg',
    summaryYear: startYear,
  });
  periods.push({
    month: -1,
    year: startYear,
    label: `Total ${startYear}`,
    identifier: `total-${startYear}`,
    type: 'year-total',
    summaryYear: startYear,
  });
  
  // Add months from current year up to current month
  for (let m = 0; m <= currentMonth; m++) {
    periods.push({
      month: m,
      year: currentYear,
      label: `${monthNames[m]} ${currentYear}`,
      identifier: `${currentYear}-${String(m + 1).padStart(2, '0')}`,
      type: 'month',
    });
  }
  
  // Add YTD summary columns for the current year (after last month)
  periods.push({
    month: -1,
    year: currentYear,
    label: `Avg YTD`,
    identifier: `avg-${currentYear}`,
    type: 'year-avg',
    summaryYear: currentYear,
    isYTD: true,
  });
  periods.push({
    month: -1,
    year: currentYear,
    label: `Total YTD`,
    identifier: `total-${currentYear}`,
    type: 'year-total',
    summaryYear: currentYear,
    isYTD: true,
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
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueContext, setIssueContext] = useState<{
    title: string;
    description: string;
    severity: string;
    sourceMetricName?: string;
    sourcePeriod?: string;
  } | null>(null);
  const [cellIssues, setCellIssues] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

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
  const currentDate = new Date();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
  const currentYear = currentDate.getFullYear();
  // Use the year prop for trend views, not the current year
  const quarterTrendPeriods = isQuarterTrendMode ? getQuarterTrendPeriods(currentQuarter, year) : [];
  const monthlyTrendPeriods = isMonthlyTrendMode ? getMonthlyTrendPeriods(year) : [];
  const months = getMonthsForQuarter(quarter || 1, year);
  const previousYearMonths = getPreviousYearMonthsForQuarter(quarter || 1, year);
  const precedingQuarters = getPrecedingQuarters(quarter || 1, year, 4);
  const FINANCIAL_METRICS = useMemo(() => {
    const metrics = getMetricsForBrand(storeBrand);
    
    // Filter out semi fixed expense metrics for Stellantis Service/Parts departments
    const isStellantis = storeBrand?.toLowerCase().includes('stellantis') || false;
    const isServiceOrParts = departmentName ? ['service', 'parts'].some(d => departmentName.toLowerCase().includes(d)) : false;
    
    console.log('Financial metrics filtering:', { 
      storeBrand, 
      departmentName, 
      isStellantis, 
      isServiceOrParts,
      willFilter: isStellantis && isServiceOrParts 
    });
    
    if (isStellantis && isServiceOrParts) {
      return metrics.filter(m => !['semi_fixed_expense', 'semi_fixed_expense_percent'].includes(m.key));
    }
    
    return metrics;
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
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_entries',
          filter: `department_id=eq.${departmentId}`,
        },
        async (payload) => {
          // Skip if this was our own change (created_by matches current user)
          if (payload.eventType !== 'DELETE' && (payload.new as any)?.created_by === currentUserId) {
            return;
          }

          console.log('Realtime financial update received:', payload);
          
          // Reload data to get the latest
          await loadFinancialData();
          await loadPrecedingQuartersData();
          
          // Show toast notification for updates from other users
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const metricName = (payload.new as any)?.metric_name || 'A metric';
            const metric = FINANCIAL_METRICS.find(m => m.key === metricName);
            toast({
              title: "Financial data updated",
              description: `${metric?.name || metricName} was updated by another user`,
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId, currentUserId, FINANCIAL_METRICS]);

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
        const { data: store } = await supabase
          .from("stores")
          .select("brand, brand_id, brands(name)")
          .eq("id", department.store_id)
          .single();

        // Use brand from relationship if available, fallback to text field
        const brandName = (store?.brands as any)?.name || store?.brand || null;
        console.log('Loaded brand name:', brandName, 'for store:', store);
        setStoreBrand(brandName);
      }
    }
  };

  // Update local values when entries change
  useEffect(() => {
    const newLocalValues: { [key: string]: string } = {};
    Object.entries(entries).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        newLocalValues[key] = value.toString();
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
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", allMonthIdentifiers);

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
            
            // Helper to get value from either raw data or already calculated values
            const getValueForMetric = (mData: any[], mKey: string, mObj: any): number | undefined => {
              // First check if already calculated
              const calculatedKey = `${mKey}-M${mObj.month + 1}-${mObj.year}`;
              if (averages[calculatedKey] !== undefined) {
                return averages[calculatedKey];
              }
              // Otherwise check raw data
              const entry = mData?.find(e => e.metric_name === mKey);
              return entry?.value;
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
              }
            });
          }
        });
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
      
      // Single query to fetch all data
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", allQuarterMonthIds);

      if (error) {
        console.error("Error loading quarter trend data:", error);
      } else {
        // Process each quarter
        quarterTrendPeriods.forEach(qtr => {
          const qKey = `Q${qtr.quarter}-${qtr.year}`;
          const quarterMonthIds = quarterMonthsMap[qKey];
          
          // Helper functions to calculate month-aware metric values (Honda legacy logic included)
          const getDirectValueForMonth = (metricKey: string, monthId: string): number | undefined => {
            const entry = data?.find(e => e.month === monthId && e.metric_name === metricKey);
            return entry?.value === null || entry?.value === undefined ? undefined : Number(entry.value);
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
              // For direct database values
              // Honda special case: legacy months may not have stored Total Direct Expenses, so compute it
              if (isHondaBrand && metric.key === 'total_direct_expenses') {
                const metricMonthCount = getMonthsWithMetricData(metric.key, quarterMonthIds);
                if (metricMonthCount > 0) {
                  const total = getMetricTotal(metric.key, quarterMonthIds);
                  const avg = total / metricMonthCount;
                  averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
                }
                return;
              }

              const values = data
                ?.filter(entry => 
                  entry.metric_name === metric.key && 
                  quarterMonthIds.includes(entry.month)
                )
                .map(entry => entry.value || 0) || [];
              
              if (values.length > 0) {
                // For dollar metrics, sum all values and divide by actual months with data
                const total = values.reduce((sum, val) => sum + val, 0);
                const avg = total / monthCount;
                averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
              }
            }
          });
        });
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

    const { data, error } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("department_id", departmentId)
      .in("month", allMonthIds);

    if (error) {
      console.error("Error loading preceding quarters data:", error);
      return;
    }

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

      const values = data
        ?.filter(entry => 
          entry.metric_name === metricKey && 
          quarterMonthIds.includes(entry.month)
        )
        .map(entry => entry.value || 0) || [];
      
      return values.reduce((sum, val) => sum + val, 0);
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

        const values = data
          ?.filter(entry => 
            entry.metric_name === metric.key && 
            quarterMonthIds.includes(entry.month)
          )
          .map(entry => entry.value || 0) || [];
        
        if (values.length > 0) {
          // For dollar metrics, sum all values and divide by actual months with data
          const total = values.reduce((sum, val) => sum + val, 0);
          const avg = total / monthCount;
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

        const values = data
          ?.filter(entry => 
            entry.metric_name === metric.key && 
            currentQuarterMonthIds.includes(entry.month)
          )
          .map(entry => entry.value || 0) || [];
        
        if (values.length > 0) {
          const total = values.reduce((sum, val) => sum + val, 0);
          const avg = total / currentMonthCount;
          averages[`${metric.key}-Q${currentYearQuarter.quarter}-${currentYearQuarter.year}`] = avg;
        }
      }
    });

    setPrecedingQuartersData(averages);
  };

  const loadFinancialData = async () => {
    if (!departmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Clear existing data to prevent stale data from showing
    // Note: Do NOT clear localValues here - it causes race conditions where
    // pending user input is lost when realtime updates trigger a reload
    setEntries({});
    setNotes({});
    
    // Skip loading individual month data in Quarter Trend or Monthly Trend mode
    if (isQuarterTrendMode || isMonthlyTrendMode) {
      setLoading(false);
      return;
    }
    
    const monthIds = months.map(m => m.identifier);
    const previousYearMonthIds = previousYearMonths.map(m => m.identifier);
    
    const allMonthIds = [...new Set([...monthIds, ...previousYearMonthIds])];

    const { data, error } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("department_id", departmentId)
      .in("month", allMonthIds);

    if (error) {
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
      setLoading(false);
      return;
    }

    const entriesMap: { [key: string]: number } = {};
    const notesMap: { [key: string]: string } = {};
    data?.forEach(entry => {
      const key = `${entry.metric_name}-${entry.month}`;
      entriesMap[key] = entry.value || 0;
      if (entry.notes) {
        notesMap[key] = entry.notes;
      }
    });

    setEntries(entriesMap);
    setNotes(notesMap);
    setLoading(false);
  };

  const handleValueChange = (metricKey: string, monthId: string, value: string) => {
    const key = `${metricKey}-${monthId}`;
    
    // Update local state immediately for responsive UI
    setLocalValues(prev => ({ ...prev, [key]: value }));

    // Clear existing timeout for this field
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current[key] = setTimeout(async () => {
      let numValue = parseFloat(value) || null;
      
      // Round all values to nearest whole number
      const metric = FINANCIAL_METRICS.find(m => m.key === metricKey);
      if (numValue !== null) {
        numValue = Math.round(numValue);
      }

      setSaving(prev => ({ ...prev, [key]: true }));

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
          // Update local state directly without reloading
          setEntries(prev => {
            const newEntries = { ...prev };
            delete newEntries[key];
            return newEntries;
          });
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
          // Update local state directly without reloading
          setEntries(prev => ({
            ...prev,
            [key]: numValue
          }));
        }
      }

      // Reload preceding quarters data in background without blocking
      loadPrecedingQuartersData();
      setSaving(prev => ({ ...prev, [key]: false }));
      delete saveTimeoutRef.current[key];
    }, 1000);
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
    if (type === "percentage") return `${Math.round(value)}%`;
    return value.toString();
  };

  const canEditTargets = () => {
    return userRole === 'super_admin' || userRole === 'store_gm' || userRole === 'department_manager';
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
        : ((actualValue - targetValue) / targetValue) * 100;
      
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
                              {[1, 2, 3, 4].map((q) => (
                                <TableCell key={q}>
                                  <Input
                                    type="number"
                                    step="any"
                                    value={editTargets[q]?.[metric.key] || ""}
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
                                    placeholder="-"
                                    className="text-center"
                                  />
                                </TableCell>
                              ))}
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
            <div className="overflow-x-auto border rounded-lg">
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
                         {monthlyTrendPeriods.map((period) => (
                           <TableHead 
                             key={period.identifier} 
                             className={cn(
                               "text-center min-w-[125px] max-w-[125px] font-bold py-[7.2px] sticky top-0 z-10",
                               period.type === 'year-avg' && "bg-primary/10 border-l-2 border-primary/30",
                               period.type === 'year-total' && "bg-primary/10 border-r-2 border-primary/30",
                               period.type === 'month' && "bg-muted/50"
                             )}
                           >
                              <div className="flex flex-col items-center">
                                {period.type === 'month' ? (
                                  <>
                                    <div className="flex items-center justify-center gap-1">
                                      {period.label.split(' ')[0]}
                                      {highestProfitMonthsByYear[period.year] === period.identifier && (
                                        <Trophy className="h-3 w-3 text-yellow-500" />
                                      )}
                                    </div>
                                    <div className="text-xs font-normal text-muted-foreground">{period.year}</div>
                                  </>
                                ) : (
                                  <>
                                    <div>{period.type === 'year-avg' ? 'Avg' : 'Total'}</div>
                                    <div className="text-xs font-normal text-muted-foreground">
                                      {period.isYTD ? `${period.summaryYear} YTD` : period.summaryYear}
                                    </div>
                                  </>
                                )}
                              </div>
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
                            <div className="flex flex-col items-center">
                              <div className="flex items-center justify-center gap-1">
                                {month.label.replace(/\s\d{4}$/, '')}
                              </div>
                              <div className="text-xs font-normal text-muted-foreground">
                                {month.identifier.split('-')[0]}
                              </div>
                            </div>
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
                    
                    // Honda brand Total Direct Expenses is always shown (calculated for legacy, manual for Nov 2025+)
                    
                    return (
                      <TableRow 
                        key={metric.key} 
                        className={cn(
                          "hover:bg-muted/30",
                          isDepartmentProfit && "border-y-2 border-primary/40 bg-primary/5"
                        )}
                      >
                        <TableCell className={cn(
                          "sticky left-0 z-30 py-[7.2px] w-[200px] min-w-[200px] max-w-[200px] border-r shadow-[2px_0_4px_rgba(0,0,0,0.1)]",
                          isDepartmentProfit ? "bg-background border-y-2 border-primary/40" : "bg-background"
                        )}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate cursor-help">
                                  <p className={cn(
                                    "text-sm truncate",
                                    isDepartmentProfit ? "font-bold text-base" : "font-medium"
                                  )}>
                                    {metric.name}
                                  </p>
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
                               isDepartmentProfit && "bg-primary/5"
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
                                  const entryValue = entries[key];
                                  const mValue = entryValue ?? precedingQuartersData[`${metric.key}-M${period.month + 1}-${period.year}`];
                                  // Check if metric should use calculation for this month (Honda legacy handling)
                                  const isCalculated = !!metric.calculation && shouldUseCalculationForMonth(metric.key, monthIdentifier);
                                  
                                  // For Honda Total Direct Expenses in legacy months, calculate as Sales Expense + Semi Fixed Expense
                                  if (isHondaBrand && metric.key === 'total_direct_expenses' && isHondaLegacyMonth(monthIdentifier)) {
                                    const getVal = (k: string) => {
                                      const directKey = `${k}-${monthIdentifier}`;
                                      return entries[directKey] ?? precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`];
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
                                      const numKey = `${metric.calculation.numerator}-${monthIdentifier}`;
                                      const denKey = `${metric.calculation.denominator}-${monthIdentifier}`;
                                      const numVal = entries[numKey] ?? precedingQuartersData[`${metric.calculation.numerator}-M${period.month + 1}-${period.year}`];
                                      const denVal = entries[denKey] ?? precedingQuartersData[`${metric.calculation.denominator}-M${period.month + 1}-${period.year}`];
                                      
                                      if (numVal !== null && numVal !== undefined && denVal !== null && denVal !== undefined && denVal !== 0) {
                                        calculatedValue = (numVal / denVal) * 100;
                                      }
                                    } else if (metric.calculation && 'type' in metric.calculation) {
                                      const getVal = (k: string) => {
                                        const directKey = `${k}-${monthIdentifier}`;
                                        return entries[directKey] ?? precedingQuartersData[`${k}-M${period.month + 1}-${period.year}`] ?? 0;
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
                                    // Calculate status for calculated metrics using quarter-specific targets
                                    const monthQuarter = Math.floor(period.month / 3) + 1;
                                    const quarterYearKey = `Q${monthQuarter}-${period.year}`;
                                    const trendTarget = trendTargets[metric.key]?.[quarterYearKey];
                                    const rawTargetValue = trendTarget?.value ?? targets[metric.key];
                                    const targetValue = rawTargetValue !== null && rawTargetValue !== undefined && rawTargetValue !== 0 ? rawTargetValue : null;
                                    const targetDirection = trendTarget?.direction ?? targetDirections[metric.key] ?? metric.targetDirection;
                                    let status: "success" | "warning" | "destructive" | null = null;
                                    
                                    if (calculatedValue !== null && calculatedValue !== undefined && targetValue !== null) {
                                      const variance = metric.type === "percentage" 
                                        ? calculatedValue - targetValue 
                                        : ((calculatedValue - targetValue) / targetValue) * 100;
                                      
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
                                          "px-1 py-0.5 text-center min-w-[125px] max-w-[125px]",
                                          status === "success" && "bg-success/10",
                                          status === "warning" && "bg-warning/10",
                                          status === "destructive" && "bg-destructive/10",
                                          isDepartmentProfit && "bg-primary/5"
                                        )}
                                      >
                                        <span className={cn(
                                          status === "success" && "text-success font-medium",
                                          status === "warning" && "text-warning font-medium",
                                          status === "destructive" && "text-destructive font-medium"
                                        )}>
                                          {calculatedValue !== null && calculatedValue !== undefined ? formatTarget(calculatedValue, metric.type) : "-"}
                                        </span>
                                      </TableCell>
                                    );
                                  }
                                  
                                  // Editable cells for non-calculated metrics
                                  const displayValue = localValues[key] !== undefined ? localValues[key] : (mValue !== null && mValue !== undefined ? String(mValue) : "");
                                  
                                  // Calculate status for non-calculated metrics using quarter-specific targets
                                  const monthQuarter = Math.floor(period.month / 3) + 1;
                                  const quarterYearKey = `Q${monthQuarter}-${period.year}`;
                                  const trendTarget = trendTargets[metric.key]?.[quarterYearKey];
                                  const rawTargetValue = trendTarget?.value ?? targets[metric.key];
                                  const targetValue = rawTargetValue !== null && rawTargetValue !== undefined && rawTargetValue !== 0 ? rawTargetValue : null;
                                  const targetDirection = trendTarget?.direction ?? targetDirections[metric.key] ?? metric.targetDirection;
                                  let status: "success" | "warning" | "destructive" | null = null;
                                  
                                  if (mValue !== null && mValue !== undefined && targetValue !== null) {
                                    const variance = metric.type === "percentage" 
                                      ? mValue - targetValue 
                                      : ((mValue - targetValue) / targetValue) * 100;
                                    
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
                                            isDepartmentProfit && "bg-primary/5"
                                          )}
                                        >
                                          <div className="relative flex items-center justify-center gap-0 h-8 w-full">
                                            {focusedCell !== key && (mValue !== null && mValue !== undefined) ? (
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
                                                {formatTarget(mValue, metric.type)}
                                              </div>
                                            ) : focusedCell !== key ? (
                                              <div 
                                                className="h-full w-full flex items-center justify-center text-muted-foreground cursor-text"
                                                onClick={(e) => {
                                                  const input = e.currentTarget.nextElementSibling as HTMLInputElement;
                                                  input?.focus();
                                                }}
                                              >
                                                {metric.type === "dollar" ? "$" : metric.type === "percentage" ? "%" : "-"}
                                              </div>
                                            ) : null}
                                            <Input
                                              type="number"
                                              step="any"
                                              value={displayValue}
                                              onChange={(e) => handleValueChange(metric.key, monthIdentifier, e.target.value)}
                                              onKeyDown={async (e) => {
                                                if (e.key === 'Enter') {
                                                  e.preventDefault();
                                                  
                                                  // Clear debounce timeout and save immediately
                                                  if (saveTimeoutRef.current[key]) {
                                                    clearTimeout(saveTimeoutRef.current[key]);
                                                    delete saveTimeoutRef.current[key];
                                                  }
                                                  
                                                  // Get the value to save
                                                  const currentValue = localValues[key];
                                                  if (currentValue !== undefined && currentValue !== '') {
                                                    let numValue = parseFloat(currentValue);
                                                    if (!isNaN(numValue)) {
                                                      numValue = Math.round(numValue);
                                                      
                                                      // Update state immediately
                                                      setEntries(prev => ({ ...prev, [key]: numValue }));
                                                      setLocalValues(prev => ({ ...prev, [key]: String(numValue) }));
                                                      
                                                      // Save to database in background
                                                      setSaving(prev => ({ ...prev, [key]: true }));
                                                      
                                                      const { data: session } = await supabase.auth.getSession();
                                                      const userId = session.session?.user?.id;
                                                      
                                                      supabase
                                                        .from("financial_entries")
                                                        .upsert({
                                                          department_id: departmentId,
                                                          month: monthIdentifier,
                                                          metric_name: metric.key,
                                                          value: numValue,
                                                          created_by: userId,
                                                        }, {
                                                          onConflict: "department_id,month,metric_name"
                                                        })
                                                        .then(({ error }) => {
                                                          if (error) {
                                                            console.error('Save error:', error);
                                                          }
                                                          setSaving(prev => ({ ...prev, [key]: false }));
                                                        });
                                                    }
                                                  }
                                                  
                                                  // Move to the next row (same period column, next metric)
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
                                                }
                                              }}
                                              onFocus={() => setFocusedCell(key)}
                                              onBlur={() => {
                                                setFocusedCell(null);
                                              }}
                                              data-metric-index={FINANCIAL_METRICS.findIndex(m => m.key === metric.key)}
                                              data-trend-period-index={periodIndex}
                                              className={cn(
                                                "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:text-foreground focus:z-10"
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
                                 <TableCell
                                   key={period.identifier}
                                   className={cn(
                                     "px-1 py-0.5 text-center min-w-[125px] max-w-[125px] font-medium",
                                     period.type === 'year-avg' && "bg-primary/10 border-l-2 border-primary/30",
                                     period.type === 'year-total' && "bg-primary/10 border-r-2 border-primary/30",
                                     isDepartmentProfit && "bg-primary/15"
                                   )}
                                 >
                                   {displayValue !== null && displayValue !== undefined ? formatTarget(displayValue, metric.type) : "-"}
                                 </TableCell>
                               );
                             })}
                           </>
                         ) : isQuarterTrendMode ? (
                          quarterTrendPeriods.map((qtr) => {
                            const qKey = `${metric.key}-Q${qtr.quarter}-${qtr.year}`;
                            const qValue = precedingQuartersData[qKey];
                            
                            // Get quarter-specific target from trendTargets
                            const quarterYearKey = `Q${qtr.quarter}-${qtr.year}`;
                            const trendTarget = trendTargets[metric.key]?.[quarterYearKey];
                            const targetValue = trendTarget?.value ?? targets[metric.key];
                            const targetDirection = trendTarget?.direction ?? targetDirections[metric.key] ?? metric.targetDirection;
                            
                            let status: "success" | "warning" | "destructive" | null = null;
                            
                            if (qValue !== null && qValue !== undefined && targetValue !== null && targetValue !== undefined && targetValue !== 0) {
                              const variance = metric.type === "percentage" 
                                ? qValue - targetValue 
                                : ((qValue - targetValue) / targetValue) * 100;
                              
                              if (targetDirection === "above") {
                                status = variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
                              } else {
                                status = variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
                              }
                            }
                            
                            return (
                              <TableCell
                                key={qtr.label}
                                className={cn(
                                  "px-1 py-0.5 text-center min-w-[125px] max-w-[125px]",
                                  status === "success" && "bg-success/10",
                                  status === "warning" && "bg-warning/10",
                                  status === "destructive" && "bg-destructive/10",
                                  !status && "text-muted-foreground",
                                  isDepartmentProfit && "bg-primary/5"
                                )}
                              >
                                <span className={cn(
                                  status === "success" && "text-success font-medium",
                                  status === "warning" && "text-warning font-medium",
                                  status === "destructive" && "text-destructive font-medium"
                                )}>
                                  {qValue !== null && qValue !== undefined ? formatTarget(qValue, metric.type) : "-"}
                                </span>
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
                                  : ((qValue - target) / target) * 100;
                                
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
                          let value = entries[key];
                          
                          // Helper function to get value for a metric (handles calculated fields)
                          const getValueForMetric = (metricKey: string): number | undefined => {
                            const entryKey = `${metricKey}-${month.identifier}`;
                            const existingValue = entries[entryKey];
                            
                            // If value exists in entries, return it
                            if (existingValue !== null && existingValue !== undefined) {
                              return existingValue;
                            }
                            
                            // Check if this metric is calculated
                            const sourceMetric = FINANCIAL_METRICS.find(m => m.key === metricKey);
                            // For Honda legacy months, skip calculation for semi_fixed_expense
                            if (!sourceMetric || !sourceMetric.calculation || !shouldUseCalculationForMonth(metricKey, month.identifier)) {
                              return undefined;
                            }
                            
                            // Handle dollar subtraction/complex calculations
                            if (sourceMetric.type === "dollar" && 'type' in sourceMetric.calculation && (sourceMetric.calculation.type === 'subtract' || sourceMetric.calculation.type === 'complex')) {
                              const baseValue = getValueForMetric(sourceMetric.calculation.base);
                              if (baseValue === null || baseValue === undefined) return undefined;
                              
                              let calculatedValue = baseValue;
                              for (const deduction of sourceMetric.calculation.deductions) {
                                const deductionValue = getValueForMetric(deduction);
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (sourceMetric.calculation.type === 'complex' && 'additions' in sourceMetric.calculation) {
                                for (const addition of sourceMetric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition);
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
                            const baseValue = getValueForMetric(metric.calculation.base);
                            
                            if (baseValue !== null && baseValue !== undefined) {
                              let calculatedValue = baseValue;
                              for (const deduction of metric.calculation.deductions) {
                                const deductionValue = getValueForMetric(deduction);
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (metric.calculation.type === 'complex' && 'additions' in metric.calculation) {
                                for (const addition of metric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition);
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

                          return (
                            <TableCell
                              key={month.identifier}
                              className={cn(
                                "text-center py-[7.2px] min-w-[125px] max-w-[125px] text-muted-foreground",
                                isDepartmentProfit && "z-10 bg-background"
                              )}
                            >
                              {value !== null && value !== undefined ? formatTarget(value, metric.type) : "-"}
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
                              <span
                                className={cn(
                                  "font-semibold",
                                  canEditTargets() && "cursor-pointer hover:text-foreground"
                                )}
                                onClick={() => canEditTargets() && handleTargetEdit(metric.key)}
                              >
                                {formatTarget(target, metric.type)}
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
                          let value = entries[key];
                          const metricIndex = FINANCIAL_METRICS.findIndex(m => m.key === metric.key);
                          
                          // Helper function to get value for a metric (handles calculated fields)
                          const getValueForMetric = (metricKey: string): number | undefined => {
                            const entryKey = `${metricKey}-${month.identifier}`;
                            const existingValue = entries[entryKey];
                            
                            // If value exists in entries, return it
                            if (existingValue !== null && existingValue !== undefined) {
                              return existingValue;
                            }
                            
                            // Check if this metric is calculated
                            const sourceMetric = FINANCIAL_METRICS.find(m => m.key === metricKey);
                            // For Honda legacy months, skip calculation for semi_fixed_expense
                            if (!sourceMetric || !sourceMetric.calculation || !shouldUseCalculationForMonth(metricKey, month.identifier)) {
                              return undefined;
                            }
                            
                            // Handle dollar subtraction/complex calculations
                            if (sourceMetric.type === "dollar" && 'type' in sourceMetric.calculation && (sourceMetric.calculation.type === 'subtract' || sourceMetric.calculation.type === 'complex')) {
                              const baseValue = getValueForMetric(sourceMetric.calculation.base);
                              if (baseValue === null || baseValue === undefined) return undefined;
                              
                              let calculatedValue = baseValue;
                              for (const deduction of sourceMetric.calculation.deductions) {
                                const deductionValue = getValueForMetric(deduction);
                                // Treat missing deductions as 0 (no expense = 0)
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (sourceMetric.calculation.type === 'complex' && 'additions' in sourceMetric.calculation) {
                                for (const addition of sourceMetric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition);
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
                            const baseValue = getValueForMetric(metric.calculation.base);
                            
                            if (baseValue !== null && baseValue !== undefined) {
                              let calculatedValue = baseValue;
                              for (const deduction of metric.calculation.deductions) {
                                const deductionValue = getValueForMetric(deduction);
                                // Treat missing deductions as 0 (no expense = 0)
                                calculatedValue -= (deductionValue || 0);
                              }
                              
                              // Handle additions for complex calculations
                              if (metric.calculation.type === 'complex' && 'additions' in metric.calculation) {
                                for (const addition of metric.calculation.additions) {
                                  const additionValue = getValueForMetric(addition);
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
                          
                          // Calculate status based on target and value
                          let status = "default";
                          if (value !== null && value !== undefined && target) {
                            const variance = metric.type === "percentage" 
                              ? value - target 
                              : ((value - target) / target) * 100;
                            
                            if (targetDirection === "above") {
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
                                                 let displayValue: number | undefined;
                                                 if (localValues[key] !== undefined && localValues[key] !== '') {
                                                   const parsed = parseFloat(localValues[key]);
                                                   if (!isNaN(parsed)) {
                                                     displayValue = parsed;
                                                   }
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
                                                 value={localValues[key] !== undefined ? localValues[key] : (value !== null && value !== undefined ? String(value) : "")}
                                                 onChange={(e) =>
                                                   handleValueChange(metric.key, month.identifier, e.target.value)
                                                 }
                                                 onKeyDown={async (e) => {
                                                   if (e.key === 'Enter') {
                                                     e.preventDefault();
                                                     
                                                     // Clear debounce timeout
                                                     if (saveTimeoutRef.current[key]) {
                                                       clearTimeout(saveTimeoutRef.current[key]);
                                                       delete saveTimeoutRef.current[key];
                                                     }
                                                     
                                                     // Get the value to save
                                                     const currentValue = localValues[key];
                                                     if (currentValue !== undefined && currentValue !== '') {
                                                       let numValue = parseFloat(currentValue);
                                                       if (!isNaN(numValue)) {
                                                         numValue = Math.round(numValue);
                                                         
                                                         // Update state IMMEDIATELY for instant UI feedback
                                                         setEntries(prev => ({ ...prev, [key]: numValue }));
                                                         setLocalValues(prev => ({ ...prev, [key]: String(numValue) }));
                                                         
                                                         // Save to database in background
                                                         setSaving(prev => ({ ...prev, [key]: true }));
                                                         
                                                         const { data: session } = await supabase.auth.getSession();
                                                         const userId = session.session?.user?.id;
                                                         
                                                         supabase
                                                           .from("financial_entries")
                                                           .upsert({
                                                             department_id: departmentId,
                                                             month: month.identifier,
                                                             metric_name: metric.key,
                                                             value: numValue,
                                                             created_by: userId,
                                                           }, {
                                                             onConflict: "department_id,month,metric_name"
                                                           })
                                                           .then(({ error }) => {
                                                             if (error) {
                                                               console.error('Save error:', error);
                                                             }
                                                             setSaving(prev => ({ ...prev, [key]: false }));
                                                           });
                                                       }
                                                     }
                                                     
                                                     // Move to next input immediately (don't wait for save)
                                                     if (metricIndex < FINANCIAL_METRICS.length - 1) {
                                                       // Find next editable input
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
                                                   }
                                                 }}
                                                 onFocus={() => {
                                                   setFocusedCell(key);
                                                 }}
                                                 onBlur={() => {
                                                   setFocusedCell(null);
                                                 }}
                                                 data-metric-index={metricIndex}
                                                 data-month-index={monthIndex}
                                                 className={cn(
                                                   "h-full w-full text-center border-0 bg-transparent absolute inset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-0 focus:opacity-100 focus:bg-background focus:z-10",
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

      {/* Issue Creation Dialog */}
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
        initialTitle={issueContext?.title}
        initialDescription={issueContext?.description}
        initialSeverity={issueContext?.severity}
        sourceType="financial"
        sourceMetricName={issueContext?.sourceMetricName}
        sourcePeriod={issueContext?.sourcePeriod}
      />
    </Card>
  );
};
