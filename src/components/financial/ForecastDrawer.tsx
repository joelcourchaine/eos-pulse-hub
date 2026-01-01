import { useState, useEffect, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/forecast/useForecast';
import { useWeightedBaseline } from '@/hooks/forecast/useWeightedBaseline';
import { useForecastCalculations, type SubMetricCalcMode } from '@/hooks/forecast/useForecastCalculations';
import { useSubMetrics } from '@/hooks/useSubMetrics';
import { ForecastWeightsPanel } from './forecast/ForecastWeightsPanel';
import { ForecastDriverInputs } from './forecast/ForecastDriverInputs';
import { ForecastResultsGrid } from './forecast/ForecastResultsGrid';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const FORECAST_YEAR_KEY = 'forecast-selected-year';

export interface ForecastDrawerHandle {
  setGpPercent: (value: number) => void;
}

interface ForecastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export const ForecastDrawer = forwardRef<ForecastDrawerHandle, ForecastDrawerProps>(function ForecastDrawer(
  { open, onOpenChange, departmentId, departmentName },
  ref
) {
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear + 1];
  
  // Initialize from localStorage or default to current year
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    const saved = localStorage.getItem(FORECAST_YEAR_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (yearOptions.includes(parsed)) return parsed;
    }
    return currentYear;
  });

  const forecastYear = selectedYear;
  const priorYear = forecastYear - 1;

  // Persist year selection
  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year, 10);
    setSelectedYear(yearNum);
    localStorage.setItem(FORECAST_YEAR_KEY, year);
    // Reset state when year changes
    driversInitialized.current = false;
    setSubMetricOverrides([]);
    setSalesGrowth(0);
  };
  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [visibleMonthStart, setVisibleMonthStart] = useState(0);

  // Driver states
  const [salesGrowth, setSalesGrowth] = useState(0);
  const [gpPercent, setGpPercent] = useState(28);
  const [salesExpense, setSalesExpense] = useState(0); // Annual sales expense in dollars
  const [fixedExpense, setFixedExpense] = useState(0);

  // If Financial Summary updates the GP% target while the drawer is closed,
  // we still want that value to win once baseline initialization runs.
  const pendingGpPercentRef = useRef<number | null>(null);

  // Baseline values for centering sliders
  const [baselineGpPercent, setBaselineGpPercent] = useState<number | undefined>();
  const [baselineSalesExpense, setBaselineSalesExpense] = useState<number | undefined>(); // Baseline annual sales expense
  const [baselineFixedExpense, setBaselineFixedExpense] = useState<number | undefined>();

  // Sub-metric overrides: user-defined annual values
  const [subMetricOverrides, setSubMetricOverrides] = useState<{ subMetricKey: string; parentKey: string; overriddenAnnualValue: number }[]>([]);
  
  if (import.meta.env.DEV) {
    console.debug('[ForecastDrawer] render, subMetricOverrides:', subMetricOverrides.length);
  }
  
  // Sub-metric calculation mode: solve-for-gp-net (default) or solve-for-sales
  const [subMetricCalcMode, setSubMetricCalcMode] = useState<SubMetricCalcMode>('gp-drives-growth');

  // Expose imperative handle so parent can update gpPercent when a target is saved
  useImperativeHandle(ref, () => ({
    setGpPercent: (value: number) => {
      pendingGpPercentRef.current = value;
      setGpPercent(value);
    },
  }), []);

  // Track if drivers have changed for auto-save
  const driversInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  const markDirty = () => {
    isDirtyRef.current = true;
  };


  // Hooks
  const {
    forecast,
    entries,
    weights,
    isLoading,
    createForecast,
    updateWeight,
    resetWeights,
    updateEntry,
    bulkUpdateEntries,
  } = useForecast(departmentId, forecastYear);

  // Use prior year (forecastYear - 1) for weight distribution
  const baselineYear = forecastYear - 1; // 2025 when forecasting 2026

  const {
    calculatedWeights,
    isLoading: weightsLoading,
    baselineYearTotal,
  } = useWeightedBaseline(departmentId, baselineYear);

  // Fetch baseline data (prior year financial entries)
  const { data: priorYearData } = useQuery({
    queryKey: ['prior-year-financial', departmentId, priorYear],
    queryFn: async () => {
      if (!departmentId) return [];

      const { data, error } = await supabase
        .from('financial_entries')
        .select('month, metric_name, value')
        .eq('department_id', departmentId)
        .gte('month', `${priorYear}-01`)
        .lte('month', `${priorYear}-12`);

      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });

  const priorYearMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return `${priorYear}-${String(m).padStart(2, '0')}`;
    });
  }, [priorYear]);

  // Fetch sub-metrics using the existing sub-metric naming convention (sub:{parent}:{order}:{name})
  const { subMetrics: subMetricEntries } = useSubMetrics(departmentId, priorYearMonths);

  // Convert prior year data to baseline map
  // Note: Some metrics like parts_transfer may have multiple entries per month that need to be summed
  const baselineData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    priorYearData?.forEach((entry) => {
      // Skip sub-metrics (they're handled separately)
      if (entry.metric_name.startsWith('sub:')) return;
      
      if (!map.has(entry.month)) {
        map.set(entry.month, new Map());
      }
      const monthMap = map.get(entry.month)!;
      const existingValue = monthMap.get(entry.metric_name) || 0;
      // Sum values for the same metric in the same month
      monthMap.set(entry.metric_name, existingValue + (entry.value || 0));
    });

    return map;
  }, [priorYearData]);

  // Convert sub-metrics to baseline format for calculations hook
  const subMetricBaselines = useMemo(() => {
    if (!subMetricEntries || subMetricEntries.length === 0) return [];

    // Group by parent + orderIndex + name to get all monthly values for each sub-metric
    // (orderIndex is required because names can repeat in statements)
    const grouped = new Map<
      string,
      { parentKey: string; name: string; orderIndex: number; values: Map<string, number> }
    >();

    for (const entry of subMetricEntries) {
      const key = `${entry.parentMetricKey}:${entry.orderIndex}:${entry.name}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          parentKey: entry.parentMetricKey,
          name: entry.name,
          orderIndex: entry.orderIndex,
          values: new Map(),
        });
      }
      grouped.get(key)!.values.set(entry.monthIdentifier, entry.value ?? 0);
    }

    return Array.from(grouped.values()).map((g) => ({
      parentKey: g.parentKey,
      name: g.name,
      orderIndex: g.orderIndex,
      monthlyValues: g.values,
    }));
  }, [subMetricEntries]);


  // Use the calculations hook
  const {
    monthlyValues,
    quarterlyValues,
    annualValues,
    subMetricForecasts,
    months,
    metricDefinitions,
    distributeQuarterToMonths,
  } = useForecastCalculations({
    entries,
    weights,
    baselineData,
    subMetricBaselines,
    subMetricOverrides,
    forecastYear,
    salesGrowth,
    gpPercent,
    salesExpense,
    fixedExpense,
    subMetricCalcMode,
  });

  // Keep latest computed values in refs so the auto-save effect
  // doesn't need to depend on large Map objects (which change identity often).
  // doesn't need to depend on large Map objects (which change identity often).
  const latestMonthlyValuesRef = useRef(monthlyValues);
  const latestEntriesRef = useRef(entries);

  useEffect(() => {
    latestMonthlyValuesRef.current = monthlyValues;
  }, [monthlyValues]);

  useEffect(() => {
    latestEntriesRef.current = entries;
  }, [entries]);


  // Create forecast if it doesn't exist when drawer opens
  useEffect(() => {
    if (open && !forecast && !isLoading && calculatedWeights.length > 0 && !createForecast.isPending) {
      const initialWeights = calculatedWeights.map(w => ({
        month_number: w.month_number,
        weight: w.weight,
      }));
      createForecast.mutate(initialWeights);
    }
  }, [open, forecast, isLoading, calculatedWeights, createForecast.isPending]);

  // Initialize driver values from baseline data
  useEffect(() => {
    if (priorYearData && priorYearData.length > 0 && !driversInitialized.current) {
      // Calculate prior year totals to set initial driver values
      const totals: Record<string, number> = {};
      priorYearData.forEach(entry => {
        totals[entry.metric_name] = (totals[entry.metric_name] || 0) + (entry.value || 0);
      });

      // Baseline GP% (used for comparisons/centering). If a target GP% was pushed in,
      // keep that as the current driver value but still record the true baseline.
      if (totals.gp_net && totals.total_sales) {
        const gp = Math.round((totals.gp_net / totals.total_sales) * 1000) / 10;
        setBaselineGpPercent(gp);

        if (pendingGpPercentRef.current !== null) {
          setGpPercent(pendingGpPercentRef.current);
          pendingGpPercentRef.current = null;
        } else {
          setGpPercent(gp);
        }
      }

      if (totals.sales_expense) {
        setSalesExpense(totals.sales_expense);
        setBaselineSalesExpense(totals.sales_expense);
      }
      if (totals.total_fixed_expense) {
        setFixedExpense(totals.total_fixed_expense);
        setBaselineFixedExpense(totals.total_fixed_expense);
      }

      driversInitialized.current = true;
    }
  }, [priorYearData]);


  const weightsSignature = useMemo(() => {
    return (weights ?? [])
      .map((w) => `${w.month_number}:${w.adjusted_weight}:${w.is_locked}`)
      .join('|');
  }, [weights]);

  const overridesSignature = useMemo(() => {
    return subMetricOverrides
      .map((o) => `${o.subMetricKey}:${o.overriddenAnnualValue}`)
      .join('|');
  }, [subMetricOverrides]);

  // Auto-save forecast entries when inputs change (drivers/weights/overrides)
  useEffect(() => {
    if (!open) return;
    if (!forecast || !driversInitialized.current) return;
    if (!isDirtyRef.current) return;
    if (bulkUpdateEntries.isPending) return;

    // Debounce auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      const currentMonthlyValues = latestMonthlyValuesRef.current;
      const currentEntries = latestEntriesRef.current;

      // Build updates from calculated values (skip locked, skip no-op writes)
      const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
      const EPS = 0.0001;

      currentMonthlyValues.forEach((metrics, month) => {
        metrics.forEach((result, metricKey) => {
          const entry = currentEntries.find((e) => e.month === month && e.metric_name === metricKey);
          if (entry?.is_locked) return;

          const nextForecast = result.value;
          const nextBaseline = result.baseline_value;

          const prevForecast = entry?.forecast_value ?? null;
          const prevBaseline = entry?.baseline_value ?? null;

          const forecastChanged = prevForecast === null ? true : Math.abs(prevForecast - nextForecast) > EPS;
          const baselineChanged =
            nextBaseline === undefined
              ? false
              : prevBaseline === null
                ? true
                : Math.abs(prevBaseline - nextBaseline) > EPS;

          if (!entry || forecastChanged || baselineChanged) {
            updates.push({
              month,
              metricName: metricKey,
              forecastValue: nextForecast,
              baselineValue: nextBaseline,
            });
          }
        });
      });

      if (updates.length > 0) {
        bulkUpdateEntries.mutate(updates, {
          onSuccess: () => {
            isDirtyRef.current = false;
          },
        });
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    open,
    forecast?.id,
    salesGrowth,
    gpPercent,
    salesExpense,
    fixedExpense,
    weightsSignature,
    overridesSignature,
    subMetricCalcMode,
  ]);


  // Handle cell edits
  const handleCellEdit = (month: string, metricName: string, value: number) => {
    // A user edit should immediately “win” over recalculated values.
    // We do that by locking the edited cells.
    if (view === 'quarter') {
      // Distribute to months
      const distributions = distributeQuarterToMonths(month as 'Q1' | 'Q2' | 'Q3' | 'Q4', metricName, value);
      distributions.forEach((d) => {
        updateEntry.mutate({ month: d.month, metricName, forecastValue: d.value, isLocked: true });
      });
    } else {
      updateEntry.mutate({ month, metricName, forecastValue: value, isLocked: true });
    }
  };

  // Handle lock toggle
  const handleToggleLock = (month: string, metricName: string) => {
    const entry = entries.find(e => e.month === month && e.metric_name === metricName);
    const currentLocked = entry?.is_locked ?? false;
    updateEntry.mutate({ month, metricName, isLocked: !currentLocked });
  };

  // Handle month navigation
  const handleMonthNavigate = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && visibleMonthStart > 0) {
      setVisibleMonthStart(visibleMonthStart - 1);
    } else if (direction === 'next' && visibleMonthStart < 6) {
      setVisibleMonthStart(visibleMonthStart + 1);
    }
  };

  // Handle sub-metric annual value edit
  const handleSubMetricEdit = (subMetricKey: string, parentKey: string, newAnnualValue: number) => {
    console.log('[ForecastDrawer] handleSubMetricEdit called', { subMetricKey, parentKey, newAnnualValue });
    setSubMetricOverrides(prev => {
      // Update existing or add new override
      const existingIndex = prev.findIndex(o => o.subMetricKey === subMetricKey);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue };
        console.log('[ForecastDrawer] Updated override at index', existingIndex, updated);
        return updated;
      }
      const newOverrides = [...prev, { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue }];
      console.log('[ForecastDrawer] Added new override', newOverrides);
      return newOverrides;
    });
    markDirty();
  };

  // Reset entire forecast to baseline values
  const handleResetForecast = () => {
    // Reset drivers to baseline
    if (baselineGpPercent !== undefined) setGpPercent(baselineGpPercent);
    if (baselineSalesExpense !== undefined) setSalesExpense(baselineSalesExpense);
    if (baselineFixedExpense !== undefined) setFixedExpense(baselineFixedExpense);
    setSalesGrowth(0);
    
    // Clear all sub-metric overrides
    setSubMetricOverrides([]);
    
    // Reset weights to original
    resetWeights.mutate();
    
    toast.success('Forecast reset to baseline');
  };

  // Get department profit for comparison
  const forecastDeptProfit = annualValues.get('department_profit')?.value || 0;
  const baselineDeptProfit = annualValues.get('department_profit')?.baseline_value || 0;
  const profitVariance = forecastDeptProfit - baselineDeptProfit;
  const profitVariancePercent = baselineDeptProfit !== 0 ? (profitVariance / Math.abs(baselineDeptProfit)) * 100 : 0;
  // Keep the component mounted even when closed so imperative updates (e.g., GP% targets)
  // can be received and applied before the user opens the drawer.
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              Forecast
              <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                <SelectTrigger className="w-24 h-8 text-lg font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              — {departmentName}
            </SheetTitle>
            <div className="flex items-center gap-2 mr-8">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetForecast}
                disabled={!forecast}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button 
                size="sm" 
                disabled={!forecast || bulkUpdateEntries.isPending}
                onClick={() => {
                  const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
                  
                  monthlyValues.forEach((metrics, month) => {
                    metrics.forEach((result, metricKey) => {
                      updates.push({
                        month,
                        metricName: metricKey,
                        forecastValue: result.value,
                        baselineValue: result.baseline_value,
                      });
                    });
                  });
                  
                  if (updates.length > 0) {
                    bulkUpdateEntries.mutate(updates, {
                      onSuccess: () => {
                        toast.success('Forecast saved');
                      },
                    });
                  }
                }}
              >
                {bulkUpdateEntries.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Forecast'
                )}
              </Button>
            </div>
          </div>
        </SheetHeader>

        {isLoading || weightsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {/* View Toggle */}
            <div className="flex gap-2">
              {(['monthly', 'quarter', 'annual'] as const).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView(v)}
                  className="capitalize"
                >
                  {v}
                </Button>
              ))}
            </div>

            {/* Weight Distribution Panel */}
            <ForecastWeightsPanel
              weights={weights}
              calculatedWeights={calculatedWeights}
              onUpdateWeight={(monthNumber, adjustedWeight, isLocked) => {
                markDirty();
                updateWeight.mutate({ monthNumber, adjustedWeight, isLocked });
              }}
              onResetWeights={() => {
                markDirty();
                resetWeights.mutate();
              }}
              isUpdating={updateWeight.isPending}
            />

            {/* Key Drivers */}
            <ForecastDriverInputs
              salesGrowth={salesGrowth}
              gpPercent={gpPercent}
              salesExpense={salesExpense}
              fixedExpense={fixedExpense}
              baselineGpPercent={baselineGpPercent}
              baselineSalesExpense={baselineSalesExpense}
              baselineFixedExpense={baselineFixedExpense}
              onSalesGrowthChange={(v) => {
                markDirty();
                setSalesGrowth(v);
              }}
              onGpPercentChange={(v) => {
                markDirty();
                setGpPercent(v);
              }}
              onSalesExpenseChange={(v) => {
                markDirty();
                setSalesExpense(v);
              }}
              onFixedExpenseChange={(v) => {
                markDirty();
                setFixedExpense(v);
              }}
            />

            {/* Sub-Metric Calculation Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Label htmlFor="calc-mode" className="text-sm font-medium">
                  GP% drives growth
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground cursor-help">(?)</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-sm">
                        <strong>GP% Drives Growth (default):</strong> When GP% improves, Sales increases proportionally, and GP Net compounds both.<br/><br/>
                        <strong>Independent Sales:</strong> Sales growth is set separately. GP Net = Sales × GP%
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-sm",
                  subMetricCalcMode === 'gp-drives-growth' ? "font-medium" : "text-muted-foreground"
                )}>
                  GP% Drives Growth
                </span>
                <Switch
                  id="calc-mode"
                  checked={subMetricCalcMode === 'solve-for-gp-net'}
                  onCheckedChange={(checked) => {
                    markDirty();
                    setSubMetricCalcMode(checked ? 'solve-for-gp-net' : 'gp-drives-growth');
                  }}
                />
                <span className={cn(
                  "text-sm",
                  subMetricCalcMode === 'solve-for-gp-net' ? "font-medium" : "text-muted-foreground"
                )}>
                  Independent Sales
                </span>
              </div>
            </div>

            {/* Forecast Results Grid */}
            <ForecastResultsGrid
              view={view}
              monthlyValues={monthlyValues}
              quarterlyValues={quarterlyValues}
              annualValues={annualValues}
              metricDefinitions={metricDefinitions}
              months={months}
              subMetrics={subMetricForecasts}
              visibleMonthStart={visibleMonthStart}
              forecastYear={forecastYear}
              priorYear={priorYear}
              onCellEdit={handleCellEdit}
              onToggleLock={handleToggleLock}
              onMonthNavigate={handleMonthNavigate}
              onSubMetricEdit={handleSubMetricEdit}
            />

            {/* Baseline Comparison */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-semibold mb-3">vs Baseline</h3>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-muted-foreground">Dept Profit:</span>
                  <span className="ml-2 font-medium">{formatCurrency(forecastDeptProfit)}</span>
                  <span className="text-muted-foreground mx-1">vs</span>
                  <span className="text-muted-foreground">{formatCurrency(baselineDeptProfit)} baseline</span>
                </div>
                <div className={cn(
                  "flex items-center gap-2",
                  profitVariance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}>
                  {profitVariance >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold">
                    {profitVariance >= 0 ? '+' : ''}{formatCurrency(profitVariance)} ({profitVariancePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
});
