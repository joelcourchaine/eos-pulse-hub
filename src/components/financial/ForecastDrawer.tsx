import { useState, useEffect, useMemo, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/forecast/useForecast';
import { useWeightedBaseline } from '@/hooks/forecast/useWeightedBaseline';
import { useForecastCalculations } from '@/hooks/forecast/useForecastCalculations';
import { useSubMetrics } from '@/hooks/useSubMetrics';
import { ForecastWeightsPanel } from './forecast/ForecastWeightsPanel';
import { ForecastDriverInputs } from './forecast/ForecastDriverInputs';
import { ForecastResultsGrid } from './forecast/ForecastResultsGrid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FORECAST_YEAR_KEY = 'forecast-selected-year';

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

export function ForecastDrawer({ open, onOpenChange, departmentId, departmentName }: ForecastDrawerProps) {
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
    setGrowth(0);
  };
  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [visibleMonthStart, setVisibleMonthStart] = useState(0);

  // Driver states - simplified to single growth slider
  const [growth, setGrowth] = useState(0);
  const [salesExpense, setSalesExpense] = useState(0); // Annual sales expense in dollars
  const [fixedExpense, setFixedExpense] = useState(0);

  // Baseline values for comparison
  const [baselineSalesExpense, setBaselineSalesExpense] = useState<number | undefined>();
  const [baselineFixedExpense, setBaselineFixedExpense] = useState<number | undefined>();

  // Sub-metric overrides: user-defined annual values
  const [subMetricOverrides, setSubMetricOverrides] = useState<{ subMetricKey: string; parentKey: string; overriddenAnnualValue: number }[]>([]);

  // Track if drivers have changed for auto-save
  const driversInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);

  const markDirty = () => {
    isDirtyRef.current = true;
  };

  // Hooks
  const queryClient = useQueryClient();

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
  const baselineYear = forecastYear - 1;

  const {
    calculatedWeights,
    isLoading: weightsLoading,
  } = useWeightedBaseline(departmentId, baselineYear);

  const resetWeightsToCalculated = async () => {
    if (!forecast?.id) return;
    if (!weights || weights.length === 0) return;
    if (!calculatedWeights || calculatedWeights.length === 0) return;

    const updates = weights.map(async (w) => {
      const cw = calculatedWeights.find((x) => x.month_number === w.month_number);
      if (!cw) return;

      const { error } = await supabase
        .from('forecast_weights')
        .update({
          original_weight: cw.weight,
          adjusted_weight: cw.weight,
          is_locked: false,
        })
        .eq('id', w.id);

      if (error) throw error;
    });

    await Promise.all(updates);
    await queryClient.invalidateQueries({ queryKey: ['forecast-weights', forecast.id] });
    toast.success('Weights reset to original');
  };
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
    impliedGrowth,
  } = useForecastCalculations({
    entries,
    weights,
    baselineData,
    subMetricBaselines,
    subMetricOverrides,
    forecastYear,
    growth,
    salesExpense,
    fixedExpense,
  });

  // Keep latest computed values in refs so the auto-save effect
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


  const overridesSignature = useMemo(() => {
    return subMetricOverrides
      .map((o) => `${o.subMetricKey}:${o.overriddenAnnualValue}`)
      .join('|');
  }, [subMetricOverrides]);

  // Sync growth slider with implied growth when sub-metric overrides change
  // IMPORTANT: Only sync once per overridesSignature to prevent feedback loops
  const lastSyncedOverridesSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!driversInitialized.current) return;

    if (subMetricOverrides.length === 0) {
      lastSyncedOverridesSignature.current = null;
      return;
    }

    // If we've already synced for the current override set, do nothing
    if (lastSyncedOverridesSignature.current === overridesSignature) return;

    if (impliedGrowth !== undefined && Math.abs(impliedGrowth - growth) > 0.1) {
      lastSyncedOverridesSignature.current = overridesSignature;
      setGrowth(impliedGrowth);
    }
  }, [impliedGrowth, overridesSignature, subMetricOverrides.length, growth]);

  const weightsSignature = useMemo(() => {
    return (weights ?? [])
      .map((w) => `${w.month_number}:${w.adjusted_weight}:${w.is_locked}`)
      .join('|');
  }, [weights]);


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
    growth,
    salesExpense,
    fixedExpense,
    weightsSignature,
    overridesSignature,
  ]);

  // Handle cell edits
  const handleCellEdit = (month: string, metricName: string, value: number) => {
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
    setSubMetricOverrides(prev => {
      const existingIndex = prev.findIndex(o => o.subMetricKey === subMetricKey);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue };
        return updated;
      }
      return [...prev, { subMetricKey, parentKey, overriddenAnnualValue: newAnnualValue }];
    });
    markDirty();
  };

  // Reset entire forecast to baseline values
  const handleResetForecast = () => {
    if (baselineSalesExpense !== undefined) setSalesExpense(baselineSalesExpense);
    if (baselineFixedExpense !== undefined) setFixedExpense(baselineFixedExpense);
    setGrowth(0);
    
    // Clear all sub-metric overrides
    setSubMetricOverrides([]);
    
    // Reset weights to current calculated distribution
    resetWeightsToCalculated().catch((e) => {
      console.error(e);
      toast.error('Failed to reset weights');
    });
    
    toast.success('Forecast reset to baseline');
  };

  // Get department profit for comparison
  const forecastDeptProfit = annualValues.get('department_profit')?.value || 0;
  const baselineDeptProfit = annualValues.get('department_profit')?.baseline_value || 0;
  const profitVariance = forecastDeptProfit - baselineDeptProfit;
  const profitVariancePercent = baselineDeptProfit !== 0 ? (profitVariance / Math.abs(baselineDeptProfit)) * 100 : 0;

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
                resetWeightsToCalculated().catch((e) => {
                  console.error(e);
                  toast.error('Failed to reset weights');
                });
              }}
              isUpdating={updateWeight.isPending}
            />

            {/* Key Drivers - Simplified to single growth slider */}
            <ForecastDriverInputs
              growth={growth}
              salesExpense={salesExpense}
              fixedExpense={fixedExpense}
              baselineSalesExpense={baselineSalesExpense}
              baselineFixedExpense={baselineFixedExpense}
              onGrowthChange={(v) => {
                markDirty();
                setGrowth(v);
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
}
