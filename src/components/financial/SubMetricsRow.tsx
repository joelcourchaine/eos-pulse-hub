import React, { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Target, AlertCircle, Flag, Mountain } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useSubMetricQuestions } from "@/hooks/useSubMetricQuestions";
import { SubMetricQuestionTooltip } from "./SubMetricQuestionTooltip";

interface SubMetricEntry {
  name: string;
  value: number | null;
  orderIndex?: number;
}

interface MonthlyPeriod {
  identifier: string;
  type: 'month' | 'year-avg' | 'year-total' | 'quarter-avg' | 'quarter-target';
  year?: number;
}

interface QuarterTrendPeriod {
  quarter: number;
  year: number;
  label: string;
}

interface SubMetricsRowProps {
  subMetrics: SubMetricEntry[];
  isExpanded: boolean;
  monthIdentifiers: string[];
  formatValue: (value: number | null) => string;
  // Callback to get sub-metric values by name and month
  getSubMetricValue: (subMetricName: string, monthId: string) => number | null;
  // For monthly trend mode: full period list including summary columns
  periods?: MonthlyPeriod[];
  // Whether to include sparkline column
  hasSparklineColumn?: boolean;
  // Parent metric key for target management
  parentMetricKey?: string;
  // Quarter and year for target context
  quarter?: number;
  currentYear?: number;
  // Target management callbacks
  getSubMetricTarget?: (subMetricName: string, quarter: number, year: number) => number | null;
  onSaveSubMetricTarget?: (subMetricName: string, orderIndex: number, quarter: number, year: number, value: number) => Promise<boolean>;
  // Value editing callbacks
  onSaveSubMetricValue?: (subMetricName: string, orderIndex: number, monthId: string, value: number | null) => Promise<boolean>;
  // Whether editing is allowed
  canEdit?: boolean;
  // Whether the parent metric is a percentage type
  isPercentageMetric?: boolean;
  // For percentage metrics: the calculation config (numerator/denominator keys)
  percentageCalculation?: {
    numerator: string;  // e.g., "gp_net"
    denominator: string; // e.g., "total_sales"
  };
  // Function to get sub-metric value from a different parent metric
  getSubMetricValueForParent?: (parentKey: string, subMetricName: string, monthId: string) => number | null;
  // Function to get the total YTD value for a parent-level metric (e.g., GP Net Total YTD)
  getParentMetricTotal?: (metricKey: string, monthIds: string[]) => number | null;
  // Quarter trend mode support
  quarterTrendPeriods?: QuarterTrendPeriod[];
  // Function to get all month identifiers for a quarter (for aggregation)
  getQuarterMonths?: (quarter: number, year: number) => string[];
  // Department ID for fetching related questions
  departmentId?: string;
  // Issue creation callback
  onCreateIssue?: (
    subMetricName: string,
    value: number | null,
    periodLabel: string,
    periodIdentifier: string,
    periodType: 'month' | 'year-avg' | 'year-total' | 'quarter-avg'
  ) => void;
  // Set of cell keys that have issues (for flag indicator)
  cellIssues?: Set<string>;
  // Rock target functions for visual emphasis
  hasRockForSubMetric?: (parentKey: string, subMetricName: string) => boolean;
  getRockForSubMetric?: (parentKey: string, subMetricName: string) => {
    id: string;
    title: string;
    target_direction: "above" | "below";
    monthly_targets: { month: string; target_value: number }[];
  } | null;
  // Forecast target fallback for sub-metrics
  getForecastTarget?: (subMetricName: string, monthId: string) => number | null;
  // Preceding quarters data for Last Year lookups in tooltips
  precedingQuartersData?: Record<string, number | undefined>;
  // Format function for tooltip values (uses parent's formatting)
  formatTargetForTooltip?: (value: number, metricType: string) => string;
  // Metric type for tooltip formatting
  metricType?: string;
  // The actual DB parent key for sub-metrics (e.g., 'gp_net' when parentMetricKey is 'gp_percent')
  subMetricSourceKey?: string;
}

// Helper to calculate average from values
const calculateAverage = (values: (number | null)[]): number | null => {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
};

// Helper to calculate total from values
const calculateTotal = (values: (number | null)[]): number | null => {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0);
};

// Helper to get variance status (same logic as parent financial metrics)
const getVarianceStatus = (
  value: number | null, 
  targetValue: number | null, 
  targetDirection: 'above' | 'below' = 'above'
): 'success' | 'warning' | 'destructive' | null => {
  if (value === null || targetValue === null || targetValue === 0) return null;
  
  const variance = ((value - targetValue) / Math.abs(targetValue)) * 100;
  
  if (targetDirection === 'above') {
    return variance >= 0 ? 'success' : variance >= -10 ? 'warning' : 'destructive';
  } else {
    return variance <= 0 ? 'success' : variance <= 10 ? 'warning' : 'destructive';
  }
};

export const SubMetricsRow: React.FC<SubMetricsRowProps> = ({
  subMetrics,
  isExpanded,
  monthIdentifiers,
  formatValue,
  getSubMetricValue,
  periods,
  hasSparklineColumn = false,
  parentMetricKey,
  quarter,
  currentYear,
  getSubMetricTarget,
  onSaveSubMetricTarget,
  onSaveSubMetricValue,
  canEdit = false,
  isPercentageMetric = false,
  percentageCalculation,
  getSubMetricValueForParent,
  getParentMetricTotal,
  quarterTrendPeriods,
  getQuarterMonths,
  departmentId,
  onCreateIssue,
  cellIssues,
  hasRockForSubMetric,
  getRockForSubMetric,
  getForecastTarget,
  precedingQuartersData,
  formatTargetForTooltip,
  metricType,
  subMetricSourceKey,
}) => {
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [valueEditValue, setValueEditValue] = useState<string>("");
  
  // Get question data for sub-metric tooltips
  const { getQuestionsForSubMetric, hasQuestionsForSubMetric } = useSubMetricQuestions(departmentId);
  
  // Helper to get period label for display
  const getPeriodLabel = (period: MonthlyPeriod): string => {
    if (period.type === 'month') {
      const [year, month] = period.identifier.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    }
    if (period.type === 'year-avg') return `Avg ${period.year}`;
    if (period.type === 'year-total') return `Total ${period.year}`;
    if (period.type === 'quarter-avg') return `Q${quarter} Avg ${period.year}`;
    return period.identifier;
  };
  
  // Helper to check if a cell has an issue
  const hasCellIssue = (subMetricName: string, periodIdentifier: string): boolean => {
    if (!cellIssues || !parentMetricKey) return false;
    return cellIssues.has(`sub:${parentMetricKey}:${subMetricName}-${periodIdentifier}`);
  };

  // Helper: LY/Forecast tooltip for sub-metric cells (mirrors parent TrendCellTooltip)
  const SubMetricLYTooltip = ({ subMetricName, monthIdentifier, children }: {
    subMetricName: string;
    monthIdentifier: string;
    children: React.ReactNode;
  }) => {
    if (!precedingQuartersData || !formatTargetForTooltip || !metricType || !parentMetricKey) return <>{children}</>;
    const monthNum = parseInt(monthIdentifier.split('-')[1], 10);
    const yr = parseInt(monthIdentifier.split('-')[0], 10);
    // Try percentage key first (e.g. sub:gp_percent:NAME), fall back to dollar source key (e.g. sub:gp_net:NAME)
    // but only for non-percentage metrics to avoid showing dollar values as percentages
    const lyKeyPrimary = `sub:${parentMetricKey}:${subMetricName}-M${monthNum}-${yr - 1}`;
    let lyValue = precedingQuartersData[lyKeyPrimary];
    if (lyValue == null && subMetricSourceKey && subMetricSourceKey !== parentMetricKey && metricType !== 'percentage') {
      const lyKeyFallback = `sub:${subMetricSourceKey}:${subMetricName}-M${monthNum}-${yr - 1}`;
      lyValue = precedingQuartersData[lyKeyFallback];
    }
    const forecastValue = getForecastTarget ? getForecastTarget(subMetricName, monthIdentifier) : null;
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
                  <span className="text-right">{formatTargetForTooltip(lyValue, metricType)}</span>
                </>
              )}
              {forecastValue != null && (
                <>
                  <span className="text-muted-foreground">Forecast</span>
                  <span className="text-right">{formatTargetForTooltip(forecastValue, metricType)}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Helper: LY/Forecast tooltip for quarter trend sub-metric cells
  const SubMetricQtrLYTooltip = ({ subMetricName, qtr, qtrYear, children }: {
    subMetricName: string;
    qtr: number;
    qtrYear: number;
    children: React.ReactNode;
  }) => {
    if (!precedingQuartersData || !formatTargetForTooltip || !metricType || !parentMetricKey) return <>{children}</>;
    const lyKeyPrimary = `sub:${parentMetricKey}:${subMetricName}-Q${qtr}-${qtrYear - 1}`;
    let lyValue = precedingQuartersData[lyKeyPrimary];
    if (lyValue == null && subMetricSourceKey && subMetricSourceKey !== parentMetricKey && metricType !== 'percentage') {
      const lyKeyFallback = `sub:${subMetricSourceKey}:${subMetricName}-Q${qtr}-${qtrYear - 1}`;
      lyValue = precedingQuartersData[lyKeyFallback];
    }
    // Forecast: average monthly forecast for the quarter
    let forecastValue: number | null = null;
    if (getForecastTarget && getQuarterMonths) {
      const qtrMonthIds = getQuarterMonths(qtr, qtrYear);
      const fVals = qtrMonthIds.map(mid => getForecastTarget(subMetricName, mid)).filter((v): v is number => v !== null);
      if (fVals.length > 0) forecastValue = fVals.reduce((s, v) => s + v, 0) / fVals.length;
    }
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
                  <span className="text-right">{formatTargetForTooltip(lyValue, metricType)}</span>
                </>
              )}
              {forecastValue != null && (
                <>
                  <span className="text-muted-foreground">Forecast</span>
                  <span className="text-right">{formatTargetForTooltip(forecastValue, metricType)}</span>
                </>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  if (!isExpanded) return null;
  
  // Calculate total column count for colSpan
  const extraColumns = (hasSparklineColumn ? 1 : 0) + (periods ? periods.filter(p => p.type !== 'month').length : 0);
  const quarterTrendColumns = quarterTrendPeriods?.length ?? 0;
  const totalDataColumns = monthIdentifiers.length + extraColumns + quarterTrendColumns;
  
  // Show placeholder when expanded but no sub-metrics data yet
  if (subMetrics.length === 0) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell 
          colSpan={totalDataColumns + 1} 
          className="sticky left-0 z-30 py-2 pl-8 text-xs text-muted-foreground italic"
        >
          No sub-metric data imported yet. Upload an Excel file with sub-metrics to see breakdown.
        </TableCell>
      </TableRow>
    );
  }

  // Helper to get summary value for a sub-metric
  const getSummaryValue = (subMetricName: string, periodType: MonthlyPeriod['type'], year?: number): number | null => {
    if (!periods) return null;
    
    // Get all month periods for the relevant year
    const monthPeriods = periods.filter(p => {
      if (p.type !== 'month') return false;
      if (year !== undefined) {
        // Extract year from month identifier (format: "2025-01")
        const periodYear = parseInt(p.identifier.split('-')[0]);
        return periodYear === year;
      }
      return true;
    });
    
    const monthIds = monthPeriods.map(p => p.identifier);
    
    // For percentage metrics with calculation config, we need to determine the right calculation strategy:
    // 1. GP% type: denominator has matching sub-metrics (e.g., "Warranty" exists under both gp_net and total_sales)
    //    -> Calculate: sum(numerator sub-metric) / sum(denominator sub-metric) * 100
    // 2. Sales Expense % type: denominator does NOT have matching sub-metrics
    //    -> Calculate: sum(numerator sub-metric) / parent denominator total * 100
    if (isPercentageMetric && percentageCalculation && getSubMetricValueForParent) {
      const { numerator, denominator } = percentageCalculation;
      
      // Sum up this sub-metric's values under the numerator parent
      const numeratorValues = monthPeriods.map(p => 
        getSubMetricValueForParent(numerator, subMetricName, p.identifier)
      );
      const totalNumerator = calculateTotal(numeratorValues);
      
      // Check if denominator has matching sub-metrics by trying to get values
      const denominatorValues = monthPeriods.map(p => 
        getSubMetricValueForParent(denominator, subMetricName, p.identifier)
      );
      const totalDenominator = calculateTotal(denominatorValues);
      
      // If denominator has matching sub-metrics (like GP%), use sub-metric to sub-metric calculation
      if (totalDenominator !== null && totalDenominator !== 0) {
        if (totalNumerator !== null) {
          return (totalNumerator / totalDenominator) * 100;
        }
        return null;
      }
      
      // Otherwise (like Sales Expense %), use parent denominator total
      if (getParentMetricTotal) {
        const parentDenominatorTotal = getParentMetricTotal(denominator, monthIds);
        if (totalNumerator !== null && parentDenominatorTotal !== null && parentDenominatorTotal !== 0) {
          return (totalNumerator / parentDenominatorTotal) * 100;
        }
      }
      return null;
    }
    
    // Non-percentage metrics: use existing logic
    const values = monthPeriods.map(p => getSubMetricValue(subMetricName, p.identifier));
    
    if (periodType === 'year-avg' || periodType === 'quarter-avg') {
      return calculateAverage(values);
    } else if (periodType === 'year-total') {
      return calculateTotal(values);
    }
    
    return null;
  };

  const handleTargetClick = (subMetricName: string, currentValue: number | null) => {
    const key = subMetricName;
    setEditingTarget(key);
    setEditValue(currentValue !== null ? currentValue.toString() : "");
  };

  const handleTargetSave = async (subMetricName: string, orderIndex: number) => {
    if (!onSaveSubMetricTarget || !quarter || !currentYear) {
      setEditingTarget(null);
      return;
    }

    const newValue = parseFloat(editValue);
    if (!isNaN(newValue)) {
      await onSaveSubMetricTarget(subMetricName, orderIndex, quarter, currentYear, newValue);
    }
    setEditingTarget(null);
  };

  const handleTargetKeyDown = (e: React.KeyboardEvent, subMetricName: string, orderIndex: number) => {
    if (e.key === 'Enter') {
      handleTargetSave(subMetricName, orderIndex);
    } else if (e.key === 'Escape') {
      setEditingTarget(null);
    }
  };

  // Value editing handlers
  const handleValueClick = (subMetricName: string, monthId: string, currentValue: number | null) => {
    if (!canEdit || !onSaveSubMetricValue) return;
    const key = `${subMetricName}-${monthId}`;
    setEditingValue(key);
    setValueEditValue(currentValue !== null ? currentValue.toString() : "");
  };

  const handleValueSave = async (subMetricName: string, orderIndex: number, monthId: string) => {
    if (!onSaveSubMetricValue) {
      setEditingValue(null);
      return;
    }

    const cleaned = valueEditValue.replace(/[$,%\s]/g, "").replace(/,/g, "");
    let numValue = cleaned === "" ? null : parseFloat(cleaned);
    if (numValue !== null && !isNaN(numValue)) {
      numValue = Math.round(numValue);
      await onSaveSubMetricValue(subMetricName, orderIndex, monthId, numValue);
    } else if (cleaned === "") {
      await onSaveSubMetricValue(subMetricName, orderIndex, monthId, null);
    }
    setEditingValue(null);
  };

  const handleValueKeyDown = (e: React.KeyboardEvent, subMetricName: string, orderIndex: number, monthId: string) => {
    if (e.key === 'Enter') {
      handleValueSave(subMetricName, orderIndex, monthId);
    } else if (e.key === 'Escape') {
      setEditingValue(null);
    }
  };

  // If we have periods, render columns matching the parent row structure
  if (periods && periods.length > 0) {
    return (
      <>
        {subMetrics.map((subMetric, idx) => {
          const subMetricHasRock = hasRockForSubMetric && parentMetricKey 
            ? hasRockForSubMetric(parentMetricKey, subMetric.name) 
            : false;
          const subMetricRock = subMetricHasRock && getRockForSubMetric && parentMetricKey
            ? getRockForSubMetric(parentMetricKey, subMetric.name)
            : null;
          
          return (
          <TableRow 
            key={`sub-${subMetric.name}-${idx}`}
            className={cn(
              "bg-muted/20 hover:bg-muted/30",
              subMetricHasRock && "bg-amber-50/50 dark:bg-amber-950/20"
            )}
          >
            <TableCell className={cn(
              "sticky left-0 z-30 py-1 pl-6 w-[200px] min-w-[200px] max-w-[200px] border-r bg-background shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
              subMetricHasRock && "border-l-4 border-l-amber-500 bg-amber-100 dark:bg-amber-900/40"
            )}>
              <div className="flex items-center gap-1.5">
                {subMetricHasRock ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Mountain className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[250px]">
                        <p className="font-medium text-sm">Rock Target</p>
                        <p className="text-xs text-muted-foreground">{subMetricRock?.title}</p>
                        <p className="text-xs mt-1">
                          Direction: {subMetricRock?.target_direction === 'above' ? 'Above' : 'Below'} target
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <svg 
                    width="12" 
                    height="12" 
                    viewBox="0 0 12 12" 
                    className="text-muted-foreground/60 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M2 0 L2 6 L10 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {hasQuestionsForSubMetric(subMetric.name) ? (
                  <SubMetricQuestionTooltip
                    subMetricName={subMetric.name}
                    questions={getQuestionsForSubMetric(subMetric.name)}
                  >
                    <p className="text-[10px] leading-tight text-muted-foreground truncate" title={subMetric.name}>
                      {subMetric.name}
                    </p>
                  </SubMetricQuestionTooltip>
                ) : (
                  <p className="text-[10px] leading-tight text-muted-foreground truncate" title={subMetric.name}>
                    {subMetric.name}
                  </p>
                )}
                {/* Show target indicator if target is set */}
                {getSubMetricTarget && quarter && currentYear && 
                  getSubMetricTarget(subMetric.name, quarter, currentYear) !== null && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 flex-shrink-0">
                          <Target className="h-2.5 w-2.5 text-primary" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Target: {getSubMetricTarget(subMetric.name, quarter, currentYear)} (Q{quarter})</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </TableCell>
            {/* Sparkline column placeholder */}
            {hasSparklineColumn && (
              <TableCell className="px-1 py-0.5 min-w-[100px] max-w-[100px]" />
            )}
            {/* Render cells for each period, matching parent row structure */}
            {periods.map((period) => {
              // Get target for this sub-metric (for the current quarter/year context)
              const quarterlyTargetValue = getSubMetricTarget && quarter && currentYear
                ? getSubMetricTarget(subMetric.name, quarter, currentYear)
                : null;
              
              // Check for rock monthly target for this specific period
              const rockMonthlyTarget = subMetricRock?.monthly_targets?.find(
                t => t.month === period.identifier
              );
              const rockTargetValue = rockMonthlyTarget?.target_value ?? null;
              const rockDirection = subMetricRock?.target_direction ?? 'above';
              
              if (period.type === 'month') {
                const monthId = period.identifier;

                // For percentage metrics, compute % from underlying numerator/denominator data
                const value = ((): number | null => {
                  if (isPercentageMetric && percentageCalculation && getSubMetricValueForParent) {
                    const { numerator, denominator } = percentageCalculation;

                    const numeratorValue = getSubMetricValueForParent(numerator, subMetric.name, monthId);
                    const denominatorSubValue = getSubMetricValueForParent(denominator, subMetric.name, monthId);

                    // If denominator has matching sub-metric (GP% style)
                    if (denominatorSubValue !== null && denominatorSubValue !== 0) {
                      return numeratorValue !== null ? (numeratorValue / denominatorSubValue) * 100 : null;
                    }

                    // Otherwise (Sales Expense % style), use parent denominator total for this month
                    if (getParentMetricTotal) {
                      const parentDenominator = getParentMetricTotal(denominator, [monthId]);
                      if (numeratorValue !== null && parentDenominator !== null && parentDenominator !== 0) {
                        return (numeratorValue / parentDenominator) * 100;
                      }
                    }

                    return null;
                  }

                  return getSubMetricValue(subMetric.name, monthId);
                })();
                const periodYear = parseInt(period.identifier.split('-')[0]);
                const isCurrentYear = periodYear === currentYear;
                
                // Use rock target if available, then quarterly target, then forecast fallback
                const forecastVal = getForecastTarget ? getForecastTarget(subMetric.name, period.identifier) : null;
                const effectiveTarget = rockTargetValue ?? quarterlyTargetValue ?? forecastVal;
                const effectiveDirection = rockTargetValue !== null ? rockDirection : 'above';
                const subTargetSource = rockTargetValue !== null ? 'rock' : quarterlyTargetValue !== null ? 'manual' : forecastVal !== null ? 'forecast' : null;
                
                const status = isCurrentYear && effectiveTarget !== null 
                  ? getVarianceStatus(value, effectiveTarget, effectiveDirection) 
                  : null;
                
                const valueKey = `${subMetric.name}-${period.identifier}`;
                const isEditingThisValue = editingValue === valueKey;
                const orderIndex = subMetric.orderIndex ?? idx;
                
                const cellContent = (
                  <TableCell 
                    className={cn(
                      "text-center py-1 text-xs min-w-[125px] max-w-[125px] relative",
                      status === 'success' && "bg-success/10",
                      status === 'warning' && "bg-warning/10",
                      status === 'destructive' && "bg-destructive/10",
                      !status && "text-muted-foreground",
                      canEdit && onSaveSubMetricValue && "cursor-pointer hover:bg-muted/40",
                      // Add subtle indicator for rock target cells
                      rockTargetValue !== null && "ring-1 ring-inset ring-amber-400/50"
                    )}
                    onClick={() => !isEditingThisValue && handleValueClick(subMetric.name, period.identifier, value)}
                  >
                    {isEditingThisValue ? (
                      <Input
                        type="text"
                        value={valueEditValue}
                        onChange={(e) => setValueEditValue(e.target.value)}
                        onBlur={() => handleValueSave(subMetric.name, orderIndex, period.identifier)}
                        onKeyDown={(e) => handleValueKeyDown(e, subMetric.name, orderIndex, period.identifier)}
                        className="h-6 text-xs text-center w-full"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <SubMetricLYTooltip subMetricName={subMetric.name} monthIdentifier={period.identifier}>
                        <span className={cn(
                          status === 'success' && "text-success font-medium",
                          status === 'warning' && "text-warning font-medium",
                          status === 'destructive' && "text-destructive font-medium"
                        )}>
                          {value !== null ? formatValue(value) : "-"}
                        </span>
                      </SubMetricLYTooltip>
                    )}
                    {hasCellIssue(subMetric.name, period.identifier) && (
                      <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                    )}
                  </TableCell>
                );

                return (
                  <ContextMenu key={period.identifier}>
                    <ContextMenuTrigger asChild>
                      {rockTargetValue !== null ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {cellContent}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                              <p className="text-xs font-medium">Rock Target: {formatValue(rockTargetValue)}</p>
                              <p className="text-xs text-muted-foreground">
                                {effectiveDirection === 'above' ? 'Above' : 'Below'} target
                              </p>
                              {value !== null && (
                                <p className="text-xs mt-1">
                                  Actual: {formatValue(value)} 
                                  {status === 'success' && ' ✓'}
                                  {status === 'warning' && ' (close)'}
                                  {status === 'destructive' && ' ✗'}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        cellContent
                      )}
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-background z-50">
                      <ContextMenuItem 
                        onClick={() => onCreateIssue?.(
                          subMetric.name,
                          value,
                          getPeriodLabel(period),
                          period.identifier,
                          'month'
                        )}
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Create Issue from Cell
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                );
              }
              
              // Quarter target - now editable
              if (period.type === 'quarter-target') {
                const isEditing = editingTarget === subMetric.name;
                const orderIndex = subMetric.orderIndex ?? idx;

                return (
                  <TableCell 
                    key={period.identifier} 
                    className={cn(
                      "text-center py-1 text-xs text-muted-foreground min-w-[100px] max-w-[100px]",
                      "bg-primary/5 border-x-2 border-primary/30 cursor-pointer hover:bg-primary/10"
                    )}
                    onClick={() => !isEditing && handleTargetClick(subMetric.name, quarterlyTargetValue)}
                  >
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => handleTargetSave(subMetric.name, orderIndex)}
                        onKeyDown={(e) => handleTargetKeyDown(e, subMetric.name, orderIndex)}
                        className="h-6 text-xs text-center w-full"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      quarterlyTargetValue !== null ? formatValue(quarterlyTargetValue) : "-"
                    )}
                  </TableCell>
                );
              }
              
              // Calculate summary value for year-avg, year-total, quarter-avg
              const summaryValue = getSummaryValue(subMetric.name, period.type, period.year);
              
              return (
                <ContextMenu key={period.identifier}>
                  <ContextMenuTrigger asChild>
                    <TableCell 
                      className={cn(
                        "text-center py-1 text-xs text-muted-foreground relative",
                        period.type === 'year-avg' && "bg-primary/5 border-l-2 border-primary/30 min-w-[125px] max-w-[125px]",
                        period.type === 'year-total' && "bg-primary/5 border-r-2 border-primary/30 min-w-[125px] max-w-[125px]",
                        period.type === 'quarter-avg' && "bg-primary/5 border-x-2 border-primary/30 min-w-[100px] max-w-[100px]"
                      )}
                    >
                      {summaryValue !== null ? formatValue(summaryValue) : "-"}
                      {hasCellIssue(subMetric.name, period.identifier) && (
                        <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                      )}
                    </TableCell>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-background z-50">
                    <ContextMenuItem 
                      onClick={() => onCreateIssue?.(
                        subMetric.name,
                        summaryValue,
                        getPeriodLabel(period),
                        period.identifier,
                        period.type as 'year-avg' | 'year-total' | 'quarter-avg'
                      )}
                    >
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Create Issue from Cell
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </TableRow>
          );
        })}
      </>
    );
  }

  // Quarter trend mode: aggregate sub-metric values by quarter
  if (quarterTrendPeriods && quarterTrendPeriods.length > 0 && getQuarterMonths) {
    // Helper to get quarter aggregate value for a sub-metric
    const getQuarterSubMetricValue = (subMetricName: string, qtr: { quarter: number; year: number }): number | null => {
      const quarterMonthIds = getQuarterMonths(qtr.quarter, qtr.year);
      
      // For percentage metrics with calculation config
      if (isPercentageMetric && percentageCalculation && getSubMetricValueForParent) {
        const { numerator, denominator } = percentageCalculation;
        
        // Sum up numerator sub-metric values across the quarter
        const numeratorValues = quarterMonthIds.map(monthId => 
          getSubMetricValueForParent(numerator, subMetricName, monthId)
        );
        const totalNumerator = calculateTotal(numeratorValues);
        
        // Check if denominator has matching sub-metrics
        const denominatorValues = quarterMonthIds.map(monthId => 
          getSubMetricValueForParent(denominator, subMetricName, monthId)
        );
        const totalDenominator = calculateTotal(denominatorValues);
        
        // If denominator has matching sub-metrics (like GP%), use sub-metric to sub-metric calculation
        if (totalDenominator !== null && totalDenominator !== 0) {
          if (totalNumerator !== null) {
            return (totalNumerator / totalDenominator) * 100;
          }
          return null;
        }
        
        // Otherwise (like Sales Expense %), use parent denominator total
        if (getParentMetricTotal) {
          const parentDenominatorTotal = getParentMetricTotal(denominator, quarterMonthIds);
          if (totalNumerator !== null && parentDenominatorTotal !== null && parentDenominatorTotal !== 0) {
            return (totalNumerator / parentDenominatorTotal) * 100;
          }
        }
        return null;
      }
      
      // Non-percentage metrics: average the values across the quarter
      const values = quarterMonthIds.map(monthId => getSubMetricValue(subMetricName, monthId));
      return calculateAverage(values);
    };

    return (
      <>
        {subMetrics.map((subMetric, idx) => (
          <TableRow 
            key={`sub-${subMetric.name}-${idx}`}
            className="bg-muted/20 hover:bg-muted/30"
          >
            <TableCell className="sticky left-0 z-30 py-1 pl-6 w-[200px] min-w-[200px] max-w-[200px] border-r bg-background shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-1.5">
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  className="text-muted-foreground/60 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M2 0 L2 6 L10 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-[10px] leading-tight text-muted-foreground truncate" title={subMetric.name}>
                  {subMetric.name}
                </p>
              </div>
            </TableCell>
            {/* Render a cell for each quarter */}
            {quarterTrendPeriods.map((qtr) => {
              const quarterValue = getQuarterSubMetricValue(subMetric.name, qtr);
              
              // Get forecast target for this quarter by averaging monthly forecast values
              let qtrForecastTarget: number | null = null;
              if (getForecastTarget && getQuarterMonths) {
                const qtrMonthIds = getQuarterMonths(qtr.quarter, qtr.year);
                const forecastValues = qtrMonthIds.map(mid => getForecastTarget(subMetric.name, mid)).filter((v): v is number => v !== null);
                if (forecastValues.length > 0) {
                  qtrForecastTarget = forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length;
                }
              }
              
              // Get quarterly manual target
              const quarterlyTargetValue = getSubMetricTarget && currentYear
                ? getSubMetricTarget(subMetric.name, qtr.quarter, qtr.year)
                : null;
              
              const effectiveTarget = quarterlyTargetValue ?? qtrForecastTarget;
              const status = effectiveTarget !== null 
                ? getVarianceStatus(quarterValue, effectiveTarget, 'above') 
                : null;
              
              return (
                <TableCell 
                  key={qtr.label} 
                  className={cn(
                    "text-center py-1 text-xs min-w-[125px] max-w-[125px]",
                    status === 'success' && "bg-success/10",
                    status === 'warning' && "bg-warning/10",
                    status === 'destructive' && "bg-destructive/10",
                    !status && "text-muted-foreground"
                  )}
                >
                  <SubMetricQtrLYTooltip subMetricName={subMetric.name} qtr={qtr.quarter} qtrYear={qtr.year}>
                    <span className={cn(
                      status === 'success' && "text-success font-medium",
                      status === 'warning' && "text-warning font-medium",
                      status === 'destructive' && "text-destructive font-medium"
                    )}>
                      {quarterValue !== null ? formatValue(quarterValue) : "-"}
                    </span>
                  </SubMetricQtrLYTooltip>
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </>
    );
  }

  // Default rendering for non-monthly-trend modes
  return (
    <>
      {subMetrics.map((subMetric, idx) => {
        const subMetricHasRock = hasRockForSubMetric && parentMetricKey 
          ? hasRockForSubMetric(parentMetricKey, subMetric.name) 
          : false;
        const subMetricRock = subMetricHasRock && getRockForSubMetric && parentMetricKey
          ? getRockForSubMetric(parentMetricKey, subMetric.name)
          : null;
        
        return (
        <TableRow 
          key={`sub-${subMetric.name}-${idx}`}
          className={cn(
            "bg-muted/20 hover:bg-muted/30",
            subMetricHasRock && "bg-amber-50/50 dark:bg-amber-950/20"
          )}
        >
          <TableCell className={cn(
            "sticky left-0 z-30 py-1 pl-6 w-[200px] min-w-[200px] max-w-[200px] border-r bg-background shadow-[2px_0_4px_rgba(0,0,0,0.05)]",
            subMetricHasRock && "border-l-4 border-l-amber-500 bg-amber-100 dark:bg-amber-900/40"
          )}>
            <div className="flex items-center gap-1.5">
              {subMetricHasRock ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Mountain className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[250px]">
                      <p className="font-medium text-sm">Rock Target</p>
                      <p className="text-xs text-muted-foreground">{subMetricRock?.title}</p>
                      <p className="text-xs mt-1">
                        Direction: {subMetricRock?.target_direction === 'above' ? 'Above' : 'Below'} target
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <svg 
                  width="12" 
                  height="12" 
                  viewBox="0 0 12 12" 
                  className="text-muted-foreground/60 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M2 0 L2 6 L10 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {hasQuestionsForSubMetric(subMetric.name) ? (
                <SubMetricQuestionTooltip
                  subMetricName={subMetric.name}
                  questions={getQuestionsForSubMetric(subMetric.name)}
                >
                  <p className="text-[10px] leading-tight text-muted-foreground truncate" title={subMetric.name}>
                    {subMetric.name}
                  </p>
                </SubMetricQuestionTooltip>
              ) : (
                <p className="text-[10px] leading-tight text-muted-foreground truncate" title={subMetric.name}>
                  {subMetric.name}
                </p>
              )}
              {/* Show target indicator if target is set */}
              {getSubMetricTarget && quarter && currentYear && 
                getSubMetricTarget(subMetric.name, quarter, currentYear) !== null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center justify-center h-4 w-4 rounded-full bg-primary/20 flex-shrink-0">
                        <Target className="h-2.5 w-2.5 text-primary" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Target: {getSubMetricTarget(subMetric.name, quarter, currentYear)} (Q{quarter})</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </TableCell>
          {monthIdentifiers.map((monthId) => {
            // For percentage metrics, compute % from underlying numerator/denominator data
            const value = ((): number | null => {
              if (isPercentageMetric && percentageCalculation && getSubMetricValueForParent) {
                const { numerator, denominator } = percentageCalculation;

                const numeratorValue = getSubMetricValueForParent(numerator, subMetric.name, monthId);
                const denominatorSubValue = getSubMetricValueForParent(denominator, subMetric.name, monthId);

                if (denominatorSubValue !== null && denominatorSubValue !== 0) {
                  return numeratorValue !== null ? (numeratorValue / denominatorSubValue) * 100 : null;
                }

                if (getParentMetricTotal) {
                  const parentDenominator = getParentMetricTotal(denominator, [monthId]);
                  if (numeratorValue !== null && parentDenominator !== null && parentDenominator !== 0) {
                    return (numeratorValue / parentDenominator) * 100;
                  }
                }

                return null;
              }

              return getSubMetricValue(subMetric.name, monthId);
            })();

            const quarterlyTargetValue = getSubMetricTarget && quarter && currentYear
              ? getSubMetricTarget(subMetric.name, quarter, currentYear)
              : null;
              
            // Check for rock monthly target for this specific month
            const rockMonthlyTarget = subMetricRock?.monthly_targets?.find(
              t => t.month === monthId
            );
            const rockTargetValue = rockMonthlyTarget?.target_value ?? null;
            const rockDirection = subMetricRock?.target_direction ?? 'above';
            
            // Only apply variance coloring for current year months
            const periodYear = parseInt(monthId.split('-')[0]);
            const isCurrentYear = periodYear === currentYear;
            
            // Use rock target if available, then quarterly target, then forecast fallback
            const forecastVal2 = getForecastTarget ? getForecastTarget(subMetric.name, monthId) : null;
            const effectiveTarget = rockTargetValue ?? quarterlyTargetValue ?? forecastVal2;
            const effectiveDirection = rockTargetValue !== null ? rockDirection : 'above';
            const subTargetSource2 = rockTargetValue !== null ? 'rock' : quarterlyTargetValue !== null ? 'manual' : forecastVal2 !== null ? 'forecast' : null;
            
            const status = isCurrentYear && effectiveTarget !== null 
              ? getVarianceStatus(value, effectiveTarget, effectiveDirection) 
              : null;
            
            const valueKey = `${subMetric.name}-${monthId}`;
            const isEditingThisValue = editingValue === valueKey;
            const orderIndex = subMetric.orderIndex ?? idx;
            
            return (
              <ContextMenu key={monthId}>
                <ContextMenuTrigger asChild>
                  <TableCell 
                    className={cn(
                      "text-center py-1 text-xs min-w-[125px] max-w-[125px] relative",
                      status === 'success' && "bg-success/10",
                      status === 'warning' && "bg-warning/10",
                      status === 'destructive' && "bg-destructive/10",
                      !status && "text-muted-foreground",
                      canEdit && onSaveSubMetricValue && "cursor-pointer hover:bg-muted/40"
                    )}
                    onClick={() => !isEditingThisValue && handleValueClick(subMetric.name, monthId, value)}
                  >
                    {isEditingThisValue ? (
                      <Input
                        type="text"
                        value={valueEditValue}
                        onChange={(e) => setValueEditValue(e.target.value)}
                        onBlur={() => handleValueSave(subMetric.name, orderIndex, monthId)}
                        onKeyDown={(e) => handleValueKeyDown(e, subMetric.name, orderIndex, monthId)}
                        className="h-6 text-xs text-center w-full"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={cn(
                        status === 'success' && "text-success font-medium",
                        status === 'warning' && "text-warning font-medium",
                        status === 'destructive' && "text-destructive font-medium"
                      )}>
                        {value !== null ? formatValue(value) : "-"}
                      </span>
                    )}
                    {hasCellIssue(subMetric.name, monthId) && (
                      <Flag className="h-3 w-3 absolute right-1 top-1/2 -translate-y-1/2 text-destructive z-20" />
                    )}
                  </TableCell>
                </ContextMenuTrigger>
                <ContextMenuContent className="bg-background z-50">
                  <ContextMenuItem 
                    onClick={() => {
                      const [year, month] = monthId.split('-');
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      const periodLabel = `${monthNames[parseInt(month) - 1]} ${year}`;
                      onCreateIssue?.(
                        subMetric.name,
                        value,
                        periodLabel,
                        monthId,
                        'month'
                      );
                    }}
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Create Issue from Cell
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </TableRow>
        );
      })}
    </>
  );
};

// Expandable trigger button for parent metric rows
interface ExpandableMetricNameProps {
  metricName: string;
  hasSubMetrics: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isDepartmentProfit?: boolean;
  isNetSellingGross?: boolean;
}

export const ExpandableMetricName: React.FC<ExpandableMetricNameProps> = ({
  metricName,
  hasSubMetrics,
  isExpanded,
  onToggle,
  isDepartmentProfit = false,
  isNetSellingGross = false,
}) => {
  const getTextStyle = () => {
    if (isDepartmentProfit) return "font-bold text-base";
    if (isNetSellingGross) return "font-semibold";
    return "font-medium";
  };

  if (!hasSubMetrics) {
    return (
      <p className={cn("text-sm truncate", getTextStyle())}>
        {metricName}
      </p>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex items-center gap-1 w-full text-left hover:text-primary transition-colors"
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-primary" />
      ) : (
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      )}
      <p className={cn("text-sm truncate", getTextStyle())}>
        {metricName}
      </p>
    </button>
  );
};