import { useState, useEffect, useRef, useMemo } from "react";
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
import { ChevronDown, ChevronUp, DollarSign, Loader2, Settings, StickyNote, Copy, Upload, ClipboardPaste, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getMetricsForBrand, type FinancialMetric } from "@/config/financialMetrics";
import { FinancialDataImport } from "./FinancialDataImport";
import { Sparkline } from "@/components/ui/sparkline";

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
}

const getMonthlyTrendPeriods = (currentYear: number): MonthlyTrendPeriod[] => {
  const periods: MonthlyTrendPeriod[] = [];
  const startYear = currentYear - 1;
  const currentMonth = new Date().getMonth(); // 0-11
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Add months from last year starting from the same month as current month
  for (let m = currentMonth; m < 12; m++) {
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
  
  return periods;
};

export const FinancialSummary = ({ departmentId, year, quarter }: FinancialSummaryProps) => {
  const [entries, setEntries] = useState<{ [key: string]: number }>({});
  const [targets, setTargets] = useState<{ [key: string]: number }>({});
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
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const isQuarterTrendMode = quarter === 0;
  const isMonthlyTrendMode = quarter === -1;
  const currentDate = new Date();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
  const currentYear = currentDate.getFullYear();
  const quarterTrendPeriods = isQuarterTrendMode ? getQuarterTrendPeriods(currentQuarter, currentYear) : [];
  const monthlyTrendPeriods = isMonthlyTrendMode ? getMonthlyTrendPeriods(currentYear) : [];
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

  useEffect(() => {
    const loadData = async () => {
      await loadUserRole();
      await loadStoreBrand();
      loadFinancialData();
      loadTargets();
    };
    loadData();
  }, [departmentId, year, quarter]);

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
    
    // Skip loading targets in Quarter Trend or Monthly Trend mode
    if (isQuarterTrendMode || isMonthlyTrendMode) return;

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
      const monthIdentifiers = monthlyTrendPeriods.map(m => m.identifier);
      
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", monthIdentifiers);

      if (error) {
        console.error("Error loading monthly trend data:", error);
      } else {
        // Helper to get value from either raw data or already calculated values
        const getValueForMetric = (monthData: any[], metricKey: string, month: any): number | undefined => {
          // First check if already calculated
          const calculatedKey = `${metricKey}-M${month.month + 1}-${month.year}`;
          if (averages[calculatedKey] !== undefined) {
            return averages[calculatedKey];
          }
          // Otherwise check raw data
          const entry = monthData?.find(e => e.metric_name === metricKey);
          return entry?.value;
        };

        // Process each metric for each month
        monthlyTrendPeriods.forEach(month => {
          const monthData = data?.filter(e => e.month === month.identifier);
          
          FINANCIAL_METRICS.forEach(metric => {
            const metricEntry = monthData?.find(e => e.metric_name === metric.key);
            
            if (metricEntry && metricEntry.value !== null && metricEntry.value !== undefined) {
              const mKey = `${metric.key}-M${month.month + 1}-${month.year}`;
              averages[mKey] = metricEntry.value;
            } else if (metric.type === "percentage" && metric.calculation && 'numerator' in metric.calculation) {
              // Calculate percentage metrics from underlying dollar amounts
              const { numerator, denominator } = metric.calculation;
              
              const numValue = getValueForMetric(monthData, numerator, month);
              const denValue = getValueForMetric(monthData, denominator, month);
              
              if (numValue !== undefined && denValue !== undefined && denValue > 0) {
                const calculatedPercentage = (numValue / denValue) * 100;
                const mKey = `${metric.key}-M${month.month + 1}-${month.year}`;
                averages[mKey] = calculatedPercentage;
              }
            } else if (metric.calculation && 'type' in metric.calculation) {
              // Calculate dollar metrics (subtract or complex)
              const calc = metric.calculation;
              const baseValue = getValueForMetric(monthData, calc.base, month);
              
              if (baseValue !== null && baseValue !== undefined) {
                let calculatedValue = baseValue;
                
                for (const deduction of calc.deductions) {
                  const deductValue = getValueForMetric(monthData, deduction, month);
                  if (deductValue !== null && deductValue !== undefined) {
                    calculatedValue -= deductValue;
                  }
                }
                
                if (calc.type === 'complex' && 'additions' in calc) {
                  for (const addition of calc.additions) {
                    const addValue = getValueForMetric(monthData, addition, month);
                    if (addValue !== null && addValue !== undefined) {
                      calculatedValue += addValue;
                    }
                  }
                }
                
                const mKey = `${metric.key}-M${month.month + 1}-${month.year}`;
                averages[mKey] = calculatedValue;
              }
            }
          });
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
          
          // Helper function to recursively calculate metric values
          const getMetricTotal = (metricKey: string, monthIds: string[]): number => {
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
                let total = getMetricTotal(calc.base, monthIds);
                
                for (const deduction of calc.deductions) {
                  total -= getMetricTotal(deduction, monthIds);
                }
                
                if (calc.type === 'complex' && 'additions' in calc) {
                  for (const addition of calc.additions) {
                    total += getMetricTotal(addition, monthIds);
                  }
                }
                
                return total;
              }
            }
            
            // Direct value from database
            const values = data
              ?.filter(entry => 
                entry.metric_name === metricKey && 
                monthIds.includes(entry.month)
              )
              .map(entry => entry.value || 0) || [];
            
            return values.reduce((sum, val) => sum + val, 0);
          };

          // Count how many months have data in this quarter
          const monthsWithData = new Set<string>();
          data?.forEach(entry => {
            if (quarterMonthIds.includes(entry.month) && entry.value !== null) {
              monthsWithData.add(entry.month);
            }
          });
          const monthCount = monthsWithData.size || 1; // Avoid division by zero

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
              const total = getMetricTotal(metric.key, quarterMonthIds);
              if (total !== 0) {
                // Divide by actual number of months with data
                const avg = total / monthCount;
                averages[`${metric.key}-Q${qtr.quarter}-${qtr.year}`] = avg;
              }
            } else {
              // For direct database values
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

    // Original logic for non-trend mode: Only load the same quarter from the previous year
    const prevYearQuarter = { quarter, year: year - 1 };
    const months = getQuarterMonthsForCalculation(prevYearQuarter.quarter, prevYearQuarter.year);
    const allMonthIds = months.map(m => m.identifier);

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
      
      // Direct value from database
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

    setPrecedingQuartersData(averages);
  };

  const loadFinancialData = async () => {
    if (!departmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Clear existing data to prevent stale data from showing
    setEntries({});
    setNotes({});
    setLocalValues({});
    
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
                     <TableHead className="sticky left-0 bg-muted z-40 min-w-[200px] font-bold py-[7.2px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
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
                                   <div>{period.label.split(' ')[0]}</div>
                                   <div className="text-xs font-normal text-muted-foreground">{period.year}</div>
                                 </>
                               ) : (
                                 <>
                                   <div>{period.type === 'year-avg' ? 'Avg' : 'Total'}</div>
                                   <div className="text-xs font-normal text-muted-foreground">{period.summaryYear}</div>
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
                        <TableHead className="text-center font-bold min-w-[100px] py-[7.2px] bg-muted/50 sticky top-0 z-10">
                          Q{quarter} {year - 1}
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
                        <TableHead className="text-center font-bold min-w-[100px] py-[7.2px] bg-primary/10 border-x-2 border-primary/30 sticky top-0 z-10">
                          Q{quarter} Target
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
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FINANCIAL_METRICS.map((metric) => {
                    const target = targets[metric.key];
                    const targetDirection = targetDirections[metric.key] || metric.targetDirection;
                    const isDepartmentProfit = metric.key === 'department_profit';
                    
                    return (
                      <TableRow 
                        key={metric.key} 
                        className={cn(
                          "hover:bg-muted/30",
                          isDepartmentProfit && "border-y-2 border-primary/40 bg-primary/5"
                        )}
                      >
                        <TableCell className={cn(
                          "sticky left-0 z-30 py-[7.2px] min-w-[200px] shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]",
                          isDepartmentProfit ? "bg-background border-y-2 border-primary/40" : "bg-background"
                        )}>
                          <div>
                            <p className={cn(
                              "text-sm",
                              isDepartmentProfit ? "font-bold text-base" : "font-medium"
                            )}>
                              {metric.name}
                            </p>
                            <p className="text-xs text-muted-foreground">{metric.description}</p>
                          </div>
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
                             {monthlyTrendPeriods.map((period) => {
                               if (period.type === 'month') {
                                 const mKey = `${metric.key}-M${period.month + 1}-${period.year}`;
                                 const mValue = precedingQuartersData[mKey];
                                 
                                 return (
                                   <TableCell
                                     key={period.identifier}
                                     className={cn(
                                       "px-1 py-0.5 text-center min-w-[125px] max-w-[125px]",
                                       isDepartmentProfit && "bg-primary/5"
                                     )}
                                   >
                                     {mValue !== null && mValue !== undefined ? formatTarget(mValue, metric.type) : "-"}
                                   </TableCell>
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
                            
                            return (
                              <TableCell
                                key={qtr.label}
                                className="px-1 py-0.5 text-center min-w-[125px] max-w-[125px] text-muted-foreground"
                              >
                                {qValue !== null && qValue !== undefined ? formatTarget(qValue, metric.type) : "-"}
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
                                    "text-center py-[7.2px] min-w-[100px]",
                                    isDepartmentProfit && "z-10 bg-background",
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
                            if (!sourceMetric || !sourceMetric.calculation) {
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
                          const isDollarCalculated = metric.type === "dollar" && metric.calculation && 'type' in metric.calculation && (metric.calculation.type === 'subtract' || metric.calculation.type === 'complex');
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
                            if (!sourceMetric || !sourceMetric.calculation) {
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
                          const isDollarCalculated = metric.type === "dollar" && metric.calculation && 'type' in metric.calculation && (metric.calculation.type === 'subtract' || metric.calculation.type === 'complex');
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
                          
                          // Determine if this is a calculated field (both percentage and dollar calculations)
                          const isCalculated = isPercentageCalculated || isDollarCalculated;
                          
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
                                              {notes[key] && (
                                                <StickyNote className="h-3 w-3 absolute top-1 right-1 text-primary" />
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
                                                 value={localValues[key] || ""}
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
                                              {notes[key] && (
                                                <StickyNote className="h-3 w-3 absolute top-1 right-1 text-primary z-20" />
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      {notes[key] && (
                                        <TooltipContent className="max-w-xs bg-popover text-popover-foreground z-50">
                                          <div 
                                            className="text-sm prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md" 
                                            dangerouslySetInnerHTML={{ __html: notes[key] }}
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
                              </ContextMenuContent>
                            </ContextMenu>
                          );
                        })}
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
                    {[year - 1, year, year + 1].map((y) => (
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
    </Card>
  );
};
