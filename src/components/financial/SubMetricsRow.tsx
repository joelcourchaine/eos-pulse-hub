import React, { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Target } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
}) => {
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [valueEditValue, setValueEditValue] = useState<string>("");

  if (!isExpanded) return null;
  
  // Calculate total column count for colSpan
  const extraColumns = (hasSparklineColumn ? 1 : 0) + (periods ? periods.filter(p => p.type !== 'month').length : 0);
  const totalDataColumns = monthIdentifiers.length + extraColumns;
  
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
              const targetValue = getSubMetricTarget && quarter && currentYear
                ? getSubMetricTarget(subMetric.name, quarter, currentYear)
                : null;
              
              if (period.type === 'month') {
                const value = getSubMetricValue(subMetric.name, period.identifier);
                // Only apply variance coloring for current year months
                const periodYear = parseInt(period.identifier.split('-')[0]);
                const isCurrentYear = periodYear === currentYear;
                const status = isCurrentYear && targetValue !== null 
                  ? getVarianceStatus(value, targetValue, 'above') 
                  : null;
                
                const valueKey = `${subMetric.name}-${period.identifier}`;
                const isEditingThisValue = editingValue === valueKey;
                const orderIndex = subMetric.orderIndex ?? idx;
                
                return (
                  <TableCell 
                    key={period.identifier} 
                    className={cn(
                      "text-center py-1 text-xs min-w-[125px] max-w-[125px]",
                      status === 'success' && "bg-success/10",
                      status === 'warning' && "bg-warning/10",
                      status === 'destructive' && "bg-destructive/10",
                      !status && "text-muted-foreground",
                      canEdit && onSaveSubMetricValue && "cursor-pointer hover:bg-muted/40"
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
                      <span className={cn(
                        status === 'success' && "text-success font-medium",
                        status === 'warning' && "text-warning font-medium",
                        status === 'destructive' && "text-destructive font-medium"
                      )}>
                        {value !== null ? formatValue(value) : "-"}
                      </span>
                    )}
                  </TableCell>
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
                    onClick={() => !isEditing && handleTargetClick(subMetric.name, targetValue)}
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
                      targetValue !== null ? formatValue(targetValue) : "-"
                    )}
                  </TableCell>
                );
              }
              
              // Calculate summary value for year-avg, year-total, quarter-avg
              const summaryValue = getSummaryValue(subMetric.name, period.type, period.year);
              
              return (
                <TableCell 
                  key={period.identifier} 
                  className={cn(
                    "text-center py-1 text-xs text-muted-foreground",
                    period.type === 'year-avg' && "bg-primary/5 border-l-2 border-primary/30 min-w-[125px] max-w-[125px]",
                    period.type === 'year-total' && "bg-primary/5 border-r-2 border-primary/30 min-w-[125px] max-w-[125px]",
                    period.type === 'quarter-avg' && "bg-primary/5 border-x-2 border-primary/30 min-w-[100px] max-w-[100px]"
                  )}
                >
                  {summaryValue !== null ? formatValue(summaryValue) : "-"}
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
            const value = getSubMetricValue(subMetric.name, monthId);
            const targetValue = getSubMetricTarget && quarter && currentYear
              ? getSubMetricTarget(subMetric.name, quarter, currentYear)
              : null;
            // Only apply variance coloring for current year months
            const periodYear = parseInt(monthId.split('-')[0]);
            const isCurrentYear = periodYear === currentYear;
            const status = isCurrentYear && targetValue !== null 
              ? getVarianceStatus(value, targetValue, 'above') 
              : null;
            
            const valueKey = `${subMetric.name}-${monthId}`;
            const isEditingThisValue = editingValue === valueKey;
            const orderIndex = subMetric.orderIndex ?? idx;
            
            return (
              <TableCell 
                key={monthId} 
                className={cn(
                  "text-center py-1 text-xs min-w-[125px] max-w-[125px]",
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
              </TableCell>
            );
          })}
        </TableRow>
      ))}
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