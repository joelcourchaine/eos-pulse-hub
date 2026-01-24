import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, ChevronLeft, Lock, Unlock, Flag, StickyNote, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from '@/components/ui/context-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import { useSubMetricQuestions } from '@/hooks/useSubMetricQuestions';
import { SubMetricQuestionTooltip } from '../SubMetricQuestionTooltip';
import { useForecastSubMetricNotes } from '@/hooks/useForecastSubMetricNotes';
import { IssueManagementDialog } from '@/components/issues/IssueManagementDialog';
import { supabase } from '@/integrations/supabase/client';
import { FormattedCurrency, formatCurrency, formatFullCurrency } from '@/components/ui/formatted-currency';

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
  onLockRow?: (metricName: string, lock: boolean) => void;
  onMonthNavigate?: (direction: 'prev' | 'next') => void;
  onSubMetricEdit?: (subMetricKey: string, parentKey: string, newAnnualValue: number) => void;
  onMainMetricAnnualEdit?: (metricKey: string, newAnnualValue: number) => void;
  departmentId?: string;
}

const formatValue = (value: number, type: 'currency' | 'percent' | 'number') => {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') return formatCurrency(value);
  return value.toFixed(0);
};

const formatFullValue = (value: number, type: 'currency' | 'percent' | 'number') => {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') return formatFullCurrency(value);
  return value.toFixed(0);
};

// Format value with full currency in annual view
const formatValueForView = (value: number, type: 'currency' | 'percent' | 'number', isAnnualView: boolean) => {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') {
    return isAnnualView ? formatFullCurrency(value) : formatCurrency(value);
  }
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
  onLockRow,
  onMonthNavigate,
  onSubMetricEdit,
  onMainMetricAnnualEdit,
  departmentId,
}: ForecastResultsGridProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editingAnnualSubMetric, setEditingAnnualSubMetric] = useState<string | null>(null);
  const [editingAnnualMainMetric, setEditingAnnualMainMetric] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedMetrics, setExpandedMetrics] = useState<Set<string>>(new Set());
  
  // Note dialog state
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [currentNoteSubMetric, setCurrentNoteSubMetric] = useState<{ key: string; parentKey: string; label: string } | null>(null);
  const [currentNoteText, setCurrentNoteText] = useState('');
  
  // Issue creation state
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueContext, setIssueContext] = useState<{
    subMetricKey: string;
    parentKey: string;
    label: string;
    forecastValue: number;
    baselineValue: number;
    note: string;
  } | null>(null);
  
  // Get question data for sub-metric tooltips
  const { getQuestionsForSubMetric, hasQuestionsForSubMetric } = useSubMetricQuestions(departmentId);
  
  // Get forecast sub-metric notes
  const { saveNote, resolveNote, getNote, hasActiveNote, hasLinkedIssue, linkIssueToNote } = useForecastSubMetricNotes(departmentId, forecastYear);

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

  const handleCellClick = (columnKey: string, metricKey: string, currentValue: number, isLocked: boolean, metricType: 'currency' | 'percent' | 'number') => {
    if (isLocked) return; // Don't edit locked cells
    const cellKey = `${columnKey}:${metricKey}`;
    setEditingCell(cellKey);
    // Round to appropriate precision based on type to avoid floating-point artifacts
    if (metricType === 'percent') {
      setEditValue(currentValue.toFixed(1));
    } else {
      // Currency and number types - round to whole number for easier editing
      setEditValue(Math.round(currentValue).toString());
    }
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

  // Note handlers
  const handleOpenNoteDialog = (subMetricKey: string, parentKey: string, label: string) => {
    const existingNote = getNote(subMetricKey);
    setCurrentNoteSubMetric({ key: subMetricKey, parentKey, label });
    setCurrentNoteText(existingNote?.note || '');
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!currentNoteSubMetric) return;
    
    const success = await saveNote(
      currentNoteSubMetric.key,
      currentNoteSubMetric.parentKey,
      currentNoteText
    );
    
    if (success) {
      setNoteDialogOpen(false);
      setCurrentNoteSubMetric(null);
      setCurrentNoteText('');
    }
  };

  const handleResolveNote = async (subMetricKey: string) => {
    await resolveNote(subMetricKey);
  };

  // Main metric annual value editing (for metrics without sub-metrics)
  const handleMainMetricAnnualClick = (metricKey: string, currentValue: number, metricType: 'currency' | 'percent' | 'number') => {
    setEditingAnnualMainMetric(metricKey);
    if (metricType === 'percent') {
      setEditValue(currentValue.toFixed(1));
    } else {
      setEditValue(Math.round(currentValue).toString());
    }
  };

  const handleMainMetricAnnualBlur = (metricKey: string) => {
    if (editingAnnualMainMetric === metricKey) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && onMainMetricAnnualEdit) {
        onMainMetricAnnualEdit(metricKey, newValue);
      }
      setEditingAnnualMainMetric(null);
    }
  };

  const handleMainMetricAnnualKeyDown = (e: React.KeyboardEvent, metricKey: string) => {
    if (e.key === 'Enter') {
      handleMainMetricAnnualBlur(metricKey);
    }
    if (e.key === 'Escape') {
      setEditingAnnualMainMetric(null);
    }
  };

  // Issue creation handler
  const handleCreateIssue = (
    subMetricKey: string,
    parentKey: string,
    label: string,
    forecastValue: number,
    baselineValue: number
  ) => {
    const note = getNote(subMetricKey);
    setIssueContext({
      subMetricKey,
      parentKey,
      label,
      forecastValue,
      baselineValue,
      note: note?.note || '',
    });
    setIssueDialogOpen(true);
  };

  const handleIssueCreated = async () => {
    if (!issueContext || !departmentId) return;
    
    // Find the newly created issue (most recent for this department)
    const { data: issues } = await supabase
      .from('issues')
      .select('id')
      .eq('department_id', departmentId)
      .eq('source_type', 'forecast')
      .eq('source_metric_name', issueContext.subMetricKey)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (issues && issues.length > 0) {
      // If no note exists yet, create one first
      const existingNote = getNote(issueContext.subMetricKey);
      if (!existingNote) {
        await saveNote(issueContext.subMetricKey, issueContext.parentKey, issueContext.note || 'Issue created from forecast');
      }
      await linkIssueToNote(issueContext.subMetricKey, issues[0].id);
    }
    
    setIssueDialogOpen(false);
    setIssueContext(null);
  };

  const renderMetricRow = (metric: MetricDefinition, isSubMetric = false, subMetricData?: SubMetricData) => {
    const annualData = annualValues.get(metric.key);
    const hasChildren = subMetrics?.has(metric.key) && (subMetrics.get(metric.key)?.length ?? 0) > 0;
    const isExpanded = expandedMetrics.has(metric.key);
    
    // For sub-metrics, get annual value from sub-metric data
    const annualValue = isSubMetric && subMetricData ? subMetricData.annualValue : annualData?.value;
    const annualBaseline = isSubMetric && subMetricData ? subMetricData.baselineAnnualValue : annualData?.baseline_value;
    
    const isDeptProfit = metric.key === 'department_profit';
    
    // Check if all months for this metric are locked (for row lock indicator)
    const allMonthsLocked = !isSubMetric && months.every(month => {
      const monthData = monthlyValues.get(month);
      const metricData = monthData?.get(metric.key);
      return metricData?.is_locked ?? false;
    });
    
    const someMonthsLocked = !isSubMetric && months.some(month => {
      const monthData = monthlyValues.get(month);
      const metricData = monthData?.get(metric.key);
      return metricData?.is_locked ?? false;
    });
    
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
        <td className="py-2 pr-4 w-[200px]">
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
            {isSubMetric && hasQuestionsForSubMetric(metric.label) ? (
              <SubMetricQuestionTooltip
                subMetricName={metric.label}
                questions={getQuestionsForSubMetric(metric.label)}
              >
                <span className={cn(
                  "text-muted-foreground text-xs"
                )}>
                  {metric.label}
                </span>
              </SubMetricQuestionTooltip>
            ) : (
              <span className={cn(
                "flex-1",
                metric.isDriver && "font-medium text-primary",
                isSubMetric && "text-muted-foreground text-xs",
                isDeptProfit && "font-semibold text-primary"
              )}>
                {metric.label}
              </span>
            )}
            
            {/* Row lock button - only for main metrics in monthly view */}
            {!isSubMetric && view === 'monthly' && onLockRow && (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-5 w-5 p-0 ml-auto",
                        allMonthsLocked && "text-amber-600 dark:text-amber-400",
                        someMonthsLocked && !allMonthsLocked && "text-amber-400/60 dark:text-amber-500/60"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLockRow(metric.key, !allMonthsLocked);
                      }}
                    >
                      {allMonthsLocked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {allMonthsLocked 
                      ? 'Unlock all months for this metric' 
                      : 'Lock all months for this metric'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
                  className="h-6 w-28 text-right text-sm ml-auto"
                  autoFocus
                />
              ) : (
                <>
                  {cellValue !== undefined && metric.type === 'currency' && Math.abs(cellValue) >= 1000 ? (
                    <TooltipProvider>
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <span 
                            className={cn(
                              "cursor-help",
                              !isSubMetric && "hover:underline",
                              isLocked && "cursor-not-allowed opacity-70",
                              isSubMetric && "text-muted-foreground"
                            )}
                            onClick={() => !isSubMetric && handleCellClick(col.key, metric.key, cellValue, isLocked, metric.type)}
                          >
                            {formatValue(cellValue, metric.type)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-mono text-sm">
                          {formatFullValue(cellValue, metric.type)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span 
                      className={cn(
                        !isSubMetric && "cursor-pointer hover:underline",
                        isLocked && "cursor-not-allowed opacity-70",
                        isSubMetric && "text-muted-foreground"
                      )}
                      onClick={() => !isSubMetric && cellValue !== undefined && handleCellClick(col.key, metric.key, cellValue, isLocked, metric.type)}
                    >
                      {cellValue !== undefined ? formatValue(cellValue, metric.type) : '-'}
                    </span>
                  )}
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
        
        {isSubMetric && subMetricData ? (
          <td className={cn(
            "text-right py-2 px-2 font-medium bg-muted/50 text-xs font-normal relative",
            subMetricData.isOverridden && "bg-blue-50 dark:bg-blue-950/30"
          )}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div className="relative">
                  {editingAnnualSubMetric === subMetricData.key ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleSubMetricAnnualBlur(subMetricData.key, subMetricData.parentKey)}
                      onKeyDown={(e) => handleSubMetricAnnualKeyDown(e, subMetricData.key, subMetricData.parentKey)}
                      className="h-6 w-20 text-right text-xs ml-auto"
                      autoFocus
                    />
                  ) : annualValue !== undefined ? (
                    view === 'annual' ? (
                      // Annual view: show full values directly
                      <span 
                        className={cn(
                          "cursor-pointer hover:underline inline-block",
                          subMetricData.isOverridden && "text-blue-600 dark:text-blue-400"
                        )}
                        onClick={() => handleSubMetricAnnualClick(subMetricData.key, annualValue, metric.type)}
                      >
                        {formatValueForView(annualValue, metric.type, true)}
                      </span>
                    ) : (
                      // Monthly/Quarter views: show abbreviated with tooltip
                      <TooltipProvider>
                        <Tooltip delayDuration={150}>
                          <TooltipTrigger asChild>
                            <span 
                              className={cn(
                                "cursor-pointer hover:underline inline-block",
                                subMetricData.isOverridden && "text-blue-600 dark:text-blue-400",
                                metric.type === 'currency' && Math.abs(annualValue) >= 1000 && "cursor-help"
                              )}
                              onClick={() => handleSubMetricAnnualClick(subMetricData.key, annualValue, metric.type)}
                            >
                              {formatValue(annualValue, metric.type)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {metric.type === 'currency' && Math.abs(annualValue) >= 1000 && (
                              <p className="font-mono text-sm">{formatFullValue(annualValue, metric.type)}</p>
                            )}
                            {hasActiveNote(subMetricData.key) && (
                              <p className="text-sm">{getNote(subMetricData.key)?.note}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )
                  ) : (
                    '-'
                  )}
                  {/* Icons for notes and linked issues */}
                  <div className="absolute -right-1 -top-1 flex items-center gap-0.5">
                    {hasActiveNote(subMetricData.key) && (
                      <Flag className="h-3 w-3 text-amber-500 fill-amber-500" />
                    )}
                    {hasLinkedIssue(subMetricData.key) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertCircle className="h-3 w-3 text-orange-500 fill-orange-100" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Issue linked to this sub-metric</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52 bg-popover z-50">
                <ContextMenuItem onClick={() => handleOpenNoteDialog(subMetricData.key, subMetricData.parentKey, metric.label)}>
                  <StickyNote className="h-4 w-4 mr-2" />
                  {hasActiveNote(subMetricData.key) ? "Edit Note" : "Add Note"}
                </ContextMenuItem>
                {hasActiveNote(subMetricData.key) && (
                  <ContextMenuItem onClick={() => handleResolveNote(subMetricData.key)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve Note
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem 
                  onClick={() => handleCreateIssue(
                    subMetricData.key, 
                    subMetricData.parentKey, 
                    metric.label, 
                    annualValue || 0, 
                    annualBaseline || 0
                  )}
                  disabled={hasLinkedIssue(subMetricData.key)}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {hasLinkedIssue(subMetricData.key) ? "Issue Linked" : "Create Issue"}
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </td>
        ) : (
          <td className={cn(
            "text-right py-2 px-2 font-medium bg-muted/50",
            // GP% and GP Net are specially editable even with children (to enable bidirectional editing)
            ((!hasChildren && !metric.isDerived) || metric.key === 'gp_percent' || metric.key === 'gp_net') && "cursor-pointer"
          )}>
            {/* Editable annual cell for main metrics without sub-metrics (non-derived), or GP%/GP Net (special case) */}
            {editingAnnualMainMetric === metric.key ? (
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleMainMetricAnnualBlur(metric.key)}
                onKeyDown={(e) => handleMainMetricAnnualKeyDown(e, metric.key)}
                className="h-6 w-20 text-right text-sm ml-auto"
                autoFocus
              />
            ) : annualValue !== undefined ? (
              // Allow editing for: metrics without children and not derived, OR gp_percent/gp_net (bidirectional)
              ((!hasChildren && !metric.isDerived) || metric.key === 'gp_percent' || metric.key === 'gp_net') && onMainMetricAnnualEdit ? (
                view === 'annual' ? (
                  // Annual view: show full values directly
                  <span 
                    className="cursor-pointer hover:underline"
                    onClick={() => handleMainMetricAnnualClick(metric.key, annualValue, metric.type)}
                  >
                    {formatValueForView(annualValue, metric.type, true)}
                  </span>
                ) : (
                  // Monthly/Quarter views: show abbreviated with tooltip
                  <TooltipProvider>
                    <Tooltip delayDuration={150}>
                      <TooltipTrigger asChild>
                        <span 
                          className={cn("cursor-pointer hover:underline", metric.type === 'currency' && Math.abs(annualValue) >= 1000 && "cursor-help")}
                          onClick={() => handleMainMetricAnnualClick(metric.key, annualValue, metric.type)}
                        >
                          {formatValue(annualValue, metric.type)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {metric.type === 'currency' && Math.abs(annualValue) >= 1000 && (
                          <p className="font-mono text-sm">{formatFullValue(annualValue, metric.type)}</p>
                        )}
                        <p className="text-xs">
                          {metric.key === 'gp_percent' 
                            ? 'Click to edit GP% (will scale GP Net sub-metrics)' 
                            : metric.key === 'gp_net'
                            ? 'Click to edit GP Net (will scale sub-metrics)'
                            : 'Click to edit annual total'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              ) : (
                // Non-editable: show full values in annual view
                view === 'annual' 
                  ? formatValueForView(annualValue, metric.type, true)
                  : metric.type === 'currency' && Math.abs(annualValue) >= 1000 
                    ? <FormattedCurrency value={annualValue} />
                    : formatValue(annualValue, metric.type)
              )
            ) : '-'}
          </td>
        )}
        <td className={cn(
          "text-right py-2 px-2 font-medium bg-primary/10",
          isSubMetric && "text-xs font-normal"
        )}>
          {annualValue !== undefined && annualBaseline !== undefined ? (() => {
            const variance = annualValue - annualBaseline;
            // For expense metrics, an increase is bad (red), decrease is good (green)
            const isExpenseMetric = metric.key === 'sales_expense' || metric.key === 'sales_expense_percent';
            const isPositiveChange = isExpenseMetric ? variance <= 0 : variance >= 0;
            
            const formattedVariance = metric.type === 'percent' 
              ? `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`
              : view === 'annual'
                ? `${variance >= 0 ? '+' : ''}${formatFullCurrency(variance)}`
                : `${variance >= 0 ? '+' : ''}${formatCurrency(variance)}`;
            
            // In annual view, show full values directly without tooltip
            if (view === 'annual') {
              return (
                <span className={cn(
                  isPositiveChange ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {formattedVariance}
                </span>
              );
            }
            
            // In other views, show abbreviated with tooltip
            return (
              <TooltipProvider>
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <span className={cn(
                      isPositiveChange ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                      metric.type === 'currency' && "cursor-help"
                    )}>
                      {formattedVariance}
                    </span>
                  </TooltipTrigger>
                  {metric.type === 'currency' && formatCurrency(variance) !== formatFullCurrency(variance) && (
                    <TooltipContent side="top" className="font-mono text-sm">
                      {variance >= 0 ? '+' : ''}{formatFullCurrency(variance)}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })() : '-'}
        </td>
        <td className={cn(
          "text-right py-2 px-2 font-medium bg-muted/30",
          isSubMetric && "text-xs font-normal text-muted-foreground"
        )}>
          {annualBaseline !== undefined ? (
            view === 'annual'
              ? formatValueForView(annualBaseline, metric.type, true)
              : metric.type === 'currency' 
                ? <FormattedCurrency value={annualBaseline} />
                : formatValue(annualBaseline, metric.type)
          ) : '-'}
        </td>
        {view === 'monthly' && (
          <td className={cn(
            "text-right py-2 pl-2 font-medium bg-muted/30",
            isSubMetric && "text-xs font-normal text-muted-foreground"
          )}>
            {annualBaseline !== undefined 
              ? (metric.type === 'percent' 
                  ? formatValue(annualBaseline, metric.type)
                  : <FormattedCurrency value={annualBaseline / 12} />
                )
              : '-'}
          </td>
        )}
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
              <th className="text-right py-2 px-2 font-medium bg-primary/10 w-[90px]">Var</th>
              <th className="text-right py-2 px-2 font-medium bg-muted/30 w-[90px]">{priorYear}</th>
              {view === 'monthly' && (
                <th className="text-right py-2 pl-2 font-medium bg-muted/30 w-[90px]">Avg Mo</th>
              )}
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
        Click values to edit • Right-click sub-metric annual values to add notes or create issues • Click lock icon to freeze cells
      </p>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentNoteSubMetric ? (hasActiveNote(currentNoteSubMetric.key) ? 'Edit Note' : 'Add Note') : 'Note'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentNoteSubMetric && (
              <p className="text-sm text-muted-foreground">
                {currentNoteSubMetric.label} — {forecastYear} Annual
              </p>
            )}
            <Textarea
              value={currentNoteText}
              onChange={(e) => setCurrentNoteText(e.target.value)}
              placeholder="Enter your note..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>
              Save Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Creation Dialog */}
      {issueContext && departmentId && (
        <IssueManagementDialog
          departmentId={departmentId}
          onIssueAdded={handleIssueCreated}
          open={issueDialogOpen}
          onOpenChange={setIssueDialogOpen}
          initialTitle={`${issueContext.label} - Forecast Goal`}
          initialDescription={`Forecast Goal: ${formatCurrency(issueContext.forecastValue)} (${forecastYear})
Prior Year: ${formatCurrency(issueContext.baselineValue)} (${priorYear})
Variance: ${issueContext.forecastValue >= issueContext.baselineValue ? '+' : ''}${formatCurrency(issueContext.forecastValue - issueContext.baselineValue)}

${issueContext.note ? `Note: ${issueContext.note}` : ''}`}
          initialSeverity="medium"
          sourceType="forecast"
          sourceMetricName={issueContext.subMetricKey}
          sourcePeriod={forecastYear.toString()}
          trigger={<span className="hidden" />}
        />
      )}
    </div>
  );
}
