import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, ChevronLeft, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface CalculationResult {
  month: string;
  metric_name: string;
  value: number;
  baseline_value: number;
  is_locked: boolean;
}

interface MetricDefinition {
  key: string;
  label: string;
  type: 'currency' | 'percent' | 'number';
  isDriver: boolean;
  isDerived: boolean;
  hasSubMetrics?: boolean;
  parentKey?: string;
}

interface SubMetricData {
  key: string;
  label: string;
  parentKey: string;
  monthlyValues: Map<string, number>; // forecast month -> calculated value
  quarterlyValues: Map<string, number>; // Q1, Q2, Q3, Q4 -> aggregated value
  annualValue: number;
  baselineAnnualValue: number;
  isOverridden?: boolean; // true if user has manually edited this sub-metric
}

interface ForecastResultsGridProps {
  view: 'monthly' | 'quarter' | 'annual';
  monthlyValues: Map<string, Map<string, CalculationResult>>;
  quarterlyValues: Record<string, Map<string, CalculationResult>>;
  annualValues: Map<string, CalculationResult>;
  metricDefinitions: MetricDefinition[];
  months: string[];
  subMetrics?: Map<string, SubMetricData[]>; // parent metric key -> sub-metrics
  visibleMonthStart?: number;
  forecastYear: number;
  priorYear: number;
  onCellEdit?: (month: string, metricName: string, value: number) => void;
  onToggleLock?: (month: string, metricName: string) => void;
  onMonthNavigate?: (direction: 'prev' | 'next') => void;
  onSubMetricEdit?: (subMetricKey: string, parentKey: string, newAnnualValue: number) => void;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatValue = (value: number, type: 'currency' | 'percent' | 'number') => {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') return formatCurrency(value);
  return value.toFixed(0);
};

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ForecastResultsGrid({
  view,
  monthlyValues,
  quarterlyValues,
  annualValues,
  metricDefinitions,
  months,
  subMetrics,
  visibleMonthStart = 0,
  forecastYear,
  priorYear,
  onCellEdit,
  onToggleLock,
  onMonthNavigate,
  onSubMetricEdit,
}: ForecastResultsGridProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingAnnualSubMetric, setEditingAnnualSubMetric] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());

  // Number of months to show at once
  const VISIBLE_MONTH_COUNT = 6;
  
  // Get columns based on view
  const getColumns = () => {
    if (view === 'monthly') {
      // Show 6 months at a time with navigation
      const endIndex = Math.min(visibleMonthStart + VISIBLE_MONTH_COUNT, 12);
      return months.slice(visibleMonthStart, endIndex).map((m) => ({
        key: m,
        label: MONTH_ABBREV[Number(m.slice(5, 7)) - 1] ?? m,
      }));
    }
    if (view === 'quarter') {
      return [
        { key: 'Q1', label: 'Q1' },
        { key: 'Q2', label: 'Q2' },
        { key: 'Q3', label: 'Q3' },
        { key: 'Q4', label: 'Q4' },
      ];
    }
    return [];
  };

  const columns = getColumns();
  
  const canNavigatePrev = view === 'monthly' && visibleMonthStart > 0;
  const canNavigateNext = view === 'monthly' && visibleMonthStart < (12 - VISIBLE_MONTH_COUNT);

  const getValue = (column: string, metricKey: string): CalculationResult | undefined => {
    if (view === 'monthly') {
      return monthlyValues.get(column)?.get(metricKey);
    }
    if (view === 'quarter') {
      return quarterlyValues[column]?.get(metricKey);
    }
    return undefined;
  };

  const handleCellClick = (columnKey: string, metricKey: string, currentValue: number, isLocked: boolean) => {
    if (isLocked) return; // Don't edit locked cells
    const cellKey = `${columnKey}:${metricKey}`;
    setEditingCell(cellKey);
    setEditValue(currentValue.toString());
  };

  const handleCellBlur = (columnKey: string, metricKey: string) => {
    if (editingCell === `${columnKey}:${metricKey}`) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && onCellEdit) {
        onCellEdit(columnKey, metricKey, newValue);
      }
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, columnKey: string, metricKey: string) => {
    if (e.key === 'Enter') {
      handleCellBlur(columnKey, metricKey);
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const toggleExpanded = (metricKey: string) => {
    setExpandedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metricKey)) {
        next.delete(metricKey);
      } else {
        next.add(metricKey);
      }
      return next;
    });
  };

  const handleLockClick = (e: React.MouseEvent, columnKey: string, metricKey: string) => {
    e.stopPropagation();
    onToggleLock?.(columnKey, metricKey);
  };

  const handleSubMetricAnnualClick = (subMetricKey: string, currentValue: number, metricType: 'currency' | 'percent' | 'number') => {
    setEditingAnnualSubMetric(subMetricKey);
    // Round to 1 decimal for percentages, whole number for currency
    if (metricType === 'percent') {
      setEditValue(currentValue.toFixed(1));
    } else {
      setEditValue(Math.round(currentValue).toString());
    }
  };

  const handleSubMetricAnnualBlur = (subMetricKey: string, parentKey: string) => {
    if (editingAnnualSubMetric === subMetricKey) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && onSubMetricEdit) {
        onSubMetricEdit(subMetricKey, parentKey, newValue);
      }
      setEditingAnnualSubMetric(null);
    }
  };

  const handleSubMetricAnnualKeyDown = (e: React.KeyboardEvent, subMetricKey: string, parentKey: string) => {
    if (e.key === 'Enter') {
      handleSubMetricAnnualBlur(subMetricKey, parentKey);
    }
    if (e.key === 'Escape') {
      setEditingAnnualSubMetric(null);
    }
  };

  const renderMetricRow = (metric: MetricDefinition, isSubMetric = false, subMetricData?: SubMetricData) => {
    const annualData = annualValues.get(metric.key);
    const hasChildren = subMetrics?.has(metric.key) && (subMetrics.get(metric.key)?.length ?? 0) > 0;
    const isExpanded = expandedMetrics.has(metric.key);
    
    // For sub-metrics, get annual value from sub-metric data
    const annualValue = isSubMetric && subMetricData ? subMetricData.annualValue : annualData?.value;
    const annualBaseline = isSubMetric && subMetricData ? subMetricData.baselineAnnualValue : annualData?.baseline_value;
    
    const isDeptProfit = metric.key === 'department_profit';
    
    return (
      <tr 
        key={metric.key} 
        className={cn(
          "border-b border-border/50 hover:bg-muted/30",
          metric.isDriver && "bg-primary/5",
          isSubMetric && "bg-muted/20",
          isDeptProfit && "bg-primary/10 border-t-2 border-t-primary/30"
        )}
      >
        <td className="py-2 pr-4 w-[160px]">
          <div className={cn("flex items-center gap-2", isSubMetric && "pl-6")}>
            {hasChildren && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={() => toggleExpanded(metric.key)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
            {!hasChildren && !isSubMetric && <span className="w-5" />}
            <span className={cn(
              metric.isDriver && "font-medium text-primary",
              isSubMetric && "text-muted-foreground text-xs",
              isDeptProfit && "font-semibold text-primary"
            )}>
              {metric.label}
            </span>
          </div>
        </td>
        
        {columns.map((col) => {
          // For sub-metrics, get calculated forecast value
          let cellValue: number | undefined;
          let isLocked = false;
          
          if (isSubMetric && subMetricData) {
            // Sub-metrics: use quarterly values in quarter view, monthly otherwise
            if (view === 'quarter') {
              cellValue = subMetricData.quarterlyValues?.get(col.key);
            } else {
              cellValue = subMetricData.monthlyValues.get(col.key);
            }
          } else {
            const data = getValue(col.key, metric.key);
            cellValue = data?.value;
            isLocked = data?.is_locked ?? false;
          }
          
          const cellKey = `${col.key}:${metric.key}`;
          const isEditing = editingCell === cellKey;
          
          return (
            <td 
              key={col.key} 
              className={cn(
                "text-right py-1 px-2 relative group/cell",
                isLocked && "bg-amber-50 dark:bg-amber-950/20",
                isSubMetric && "text-xs"
              )}
            >
              {isEditing && !isSubMetric ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleCellBlur(col.key, metric.key)}
                  onKeyDown={(e) => handleKeyDown(e, col.key, metric.key)}
                  className="h-6 w-20 text-right text-sm ml-auto"
                  autoFocus
                />
              ) : (
                <>
                  <span 
                    className={cn(
                      !isSubMetric && "cursor-pointer hover:underline",
                      isLocked && "cursor-not-allowed opacity-70",
                      isSubMetric && "text-muted-foreground"
                    )}
                    onClick={() => !isSubMetric && cellValue !== undefined && handleCellClick(col.key, metric.key, cellValue, isLocked)}
                  >
                    {cellValue !== undefined ? formatValue(cellValue, metric.type) : '-'}
                  </span>
                  {!isSubMetric && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100"
                      onClick={(e) => handleLockClick(e, col.key, metric.key)}
                    >
                      {isLocked ? (
                        <Lock className="h-3 w-3 text-amber-500" />
                      ) : (
                        <Unlock className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      )}
                    </Button>
                  )}
                </>
              )}
            </td>
          );
        })}
        
        <td className={cn(
          "text-right py-2 px-2 font-medium bg-muted/50",
          isSubMetric && "text-xs font-normal",
          isSubMetric && subMetricData?.isOverridden && "bg-blue-50 dark:bg-blue-950/30"
        )}>
          {isSubMetric && subMetricData && editingAnnualSubMetric === subMetricData.key ? (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => handleSubMetricAnnualBlur(subMetricData.key, subMetricData.parentKey)}
              onKeyDown={(e) => handleSubMetricAnnualKeyDown(e, subMetricData.key, subMetricData.parentKey)}
              className="h-6 w-20 text-right text-xs ml-auto"
              autoFocus
            />
          ) : isSubMetric && subMetricData && annualValue !== undefined ? (
            <span 
              className={cn(
                "cursor-pointer hover:underline",
                subMetricData.isOverridden && "text-blue-600 dark:text-blue-400"
              )}
              onClick={() => handleSubMetricAnnualClick(subMetricData.key, annualValue, metric.type)}
              title="Click to edit this sub-metric's annual target"
            >
              {formatValue(annualValue, metric.type)}
            </span>
          ) : (
            annualValue !== undefined ? formatValue(annualValue, metric.type) : '-'
          )}
        </td>
        {view === 'monthly' && (
          <td className={cn(
            "text-right py-2 px-2 font-medium bg-muted/30",
            isSubMetric && "text-xs font-normal text-muted-foreground"
          )}>
            {annualValue !== undefined ? formatValue(annualValue / 12, metric.type) : '-'}
          </td>
        )}
        <td className={cn(
          "text-right py-2 px-2 font-medium bg-primary/10",
          isSubMetric && "text-xs font-normal"
        )}>
          {annualValue !== undefined && annualBaseline !== undefined ? (
            <span className={cn(
              metric.type === 'percent' 
                ? (annualValue - annualBaseline) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                : (annualValue - annualBaseline) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
              {metric.type === 'percent' 
                ? `${(annualValue - annualBaseline) >= 0 ? '+' : ''}${(annualValue - annualBaseline).toFixed(1)}%`
                : `${(annualValue - annualBaseline) >= 0 ? '+' : ''}${formatCurrency(annualValue - annualBaseline)}`
              }
            </span>
          ) : '-'}
        </td>
        <td className={cn(
          "text-right py-2 pl-2 font-medium bg-muted/30",
          isSubMetric && "text-xs font-normal text-muted-foreground"
        )}>
          {annualBaseline !== undefined ? formatValue(annualBaseline, metric.type) : '-'}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Forecast Results</h3>
        {view === 'monthly' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMonthNavigate?.('prev')}
              disabled={!canNavigatePrev}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              {MONTH_ABBREV[visibleMonthStart]} - {MONTH_ABBREV[Math.min(visibleMonthStart + VISIBLE_MONTH_COUNT - 1, 11)]}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onMonthNavigate?.('next')}
              disabled={!canNavigateNext}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium w-[160px]">Metric</th>
              {columns.map((col) => (
                <th key={col.key} className="text-right py-2 px-2 font-medium w-[80px]">
                  {col.label}
                </th>
              ))}
              <th className="text-right py-2 px-2 font-medium bg-muted/50 w-[90px]">{forecastYear}</th>
              {view === 'monthly' && (
                <th className="text-right py-2 px-2 font-medium bg-muted/30 w-[90px]">Avg Mo</th>
              )}
              <th className="text-right py-2 px-2 font-medium bg-primary/10 w-[90px]">Var</th>
              <th className="text-right py-2 pl-2 font-medium bg-muted/30 w-[90px]">{priorYear}</th>
            </tr>
          </thead>
          <tbody className="[&_tr]:group">
            {metricDefinitions.map((metric) => {
              const rows = [renderMetricRow(metric)];
              
              // Render sub-metrics if expanded
              if (expandedMetrics.has(metric.key) && subMetrics?.has(metric.key)) {
                const children = subMetrics.get(metric.key) || [];
                children.forEach(sub => {
                  rows.push(
                    renderMetricRow({
                      key: sub.key,
                      label: sub.label,
                      // Inherit type from parent metric (percent vs currency)
                      type: metric.type,
                      isDriver: false,
                      isDerived: false,
                      parentKey: metric.key,
                    }, true, sub)
                  );
                });
              }
              
              return rows;
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Click values to edit • Click sub-metric annual values to set individual targets • Click lock icon to freeze cells
      </p>
    </div>
  );
}
