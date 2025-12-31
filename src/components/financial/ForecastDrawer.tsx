import { useState, useEffect, useMemo, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/forecast/useForecast';
import { useWeightedBaseline } from '@/hooks/forecast/useWeightedBaseline';
import { useForecastCalculations } from '@/hooks/forecast/useForecastCalculations';
import { ForecastWeightsPanel } from './forecast/ForecastWeightsPanel';
import { ForecastDriverInputs } from './forecast/ForecastDriverInputs';
import { ForecastResultsGrid } from './forecast/ForecastResultsGrid';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Sub-metrics that roll up to parent metrics
const SUB_METRIC_PARENTS: Record<string, string> = {
  'new_vehicle_sales': 'total_sales',
  'used_vehicle_sales': 'total_sales',
  'parts_sales': 'total_sales',
  'service_sales': 'total_sales',
  'other_sales': 'total_sales',
  'salesperson_expense': 'sales_expense',
  'sales_management_expense': 'sales_expense',
  'other_sales_expense': 'sales_expense',
};

export function ForecastDrawer({ open, onOpenChange, departmentId, departmentName }: ForecastDrawerProps) {
  const currentYear = new Date().getFullYear();
  const forecastYear = currentYear + 1;
  const priorYear = forecastYear - 1; // Year before the forecast year (2025 when forecasting 2026)

  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  const [visibleMonthStart, setVisibleMonthStart] = useState(0);
  
  // Driver states
  const [salesGrowth, setSalesGrowth] = useState(0);
  const [gpPercent, setGpPercent] = useState(28);
  const [salesExpPercent, setSalesExpPercent] = useState(42);
  const [fixedExpense, setFixedExpense] = useState(0);
  
  // Baseline values for centering sliders
  const [baselineGpPercent, setBaselineGpPercent] = useState<number | undefined>();
  const [baselineSalesExpPercent, setBaselineSalesExpPercent] = useState<number | undefined>();
  const [baselineFixedExpense, setBaselineFixedExpense] = useState<number | undefined>();
  
  // Track if drivers have changed for auto-save
  const driversInitialized = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch sub-metrics data
  const { data: subMetricsData } = useQuery({
    queryKey: ['sub-metrics-financial', departmentId, priorYear],
    queryFn: async () => {
      if (!departmentId) return [];
      
      // Get all financial entries that could be sub-metrics
      const subMetricKeys = Object.keys(SUB_METRIC_PARENTS);
      const { data, error } = await supabase
        .from('financial_entries')
        .select('month, metric_name, value')
        .eq('department_id', departmentId)
        .in('metric_name', subMetricKeys)
        .gte('month', `${priorYear}-01`)
        .lte('month', `${priorYear}-12`);
      
      if (error) throw error;
      return data;
    },
    enabled: !!departmentId,
  });

  // Convert prior year data to baseline map
  const baselineData = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    
    priorYearData?.forEach(entry => {
      if (!map.has(entry.month)) {
        map.set(entry.month, new Map());
      }
      map.get(entry.month)!.set(entry.metric_name, entry.value || 0);
    });
    
    return map;
  }, [priorYearData]);

  // Convert sub-metrics to the format needed by the grid
  const subMetrics = useMemo(() => {
    const result = new Map<string, { key: string; label: string; values: Map<string, number>; annualValue: number }[]>();
    
    if (!subMetricsData) return result;
    
    // Group by parent metric
    const grouped = new Map<string, Map<string, Map<string, number>>>();
    
    subMetricsData.forEach(entry => {
      const parentKey = SUB_METRIC_PARENTS[entry.metric_name];
      if (!parentKey) return;
      
      if (!grouped.has(parentKey)) {
        grouped.set(parentKey, new Map());
      }
      
      const parentGroup = grouped.get(parentKey)!;
      if (!parentGroup.has(entry.metric_name)) {
        parentGroup.set(entry.metric_name, new Map());
      }
      
      parentGroup.get(entry.metric_name)!.set(entry.month, entry.value || 0);
    });
    
    // Convert to final format
    grouped.forEach((metrics, parentKey) => {
      const children: { key: string; label: string; values: Map<string, number>; annualValue: number }[] = [];
      
      metrics.forEach((monthValues, metricKey) => {
        let annualValue = 0;
        monthValues.forEach(v => annualValue += v);
        
        children.push({
          key: metricKey,
          label: metricKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          values: monthValues,
          annualValue,
        });
      });
      
      if (children.length > 0) {
        result.set(parentKey, children);
      }
    });
    
    return result;
  }, [subMetricsData]);

  // Use the calculations hook
  const {
    monthlyValues,
    quarterlyValues,
    annualValues,
    months,
    metricDefinitions,
    distributeQuarterToMonths,
  } = useForecastCalculations({
    entries,
    weights,
    baselineData,
    forecastYear,
    salesGrowth,
    gpPercent,
    salesExpPercent,
    fixedExpense,
  });

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
      
      if (totals.gp_net && totals.total_sales) {
        const gp = Math.round((totals.gp_net / totals.total_sales) * 1000) / 10;
        setGpPercent(gp);
        setBaselineGpPercent(gp);
      }
      if (totals.sales_expense && totals.gp_net) {
        const salesExp = Math.round((totals.sales_expense / totals.gp_net) * 1000) / 10;
        setSalesExpPercent(salesExp);
        setBaselineSalesExpPercent(salesExp);
      }
      if (totals.total_fixed_expense) {
        setFixedExpense(totals.total_fixed_expense);
        setBaselineFixedExpense(totals.total_fixed_expense);
      }
      
      driversInitialized.current = true;
    }
  }, [priorYearData]);

  // Auto-save forecast entries when drivers change
  useEffect(() => {
    if (!forecast || !driversInitialized.current) return;
    
    // Debounce auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setTimeout(() => {
      // Build updates from calculated values
      const updates: { month: string; metricName: string; forecastValue: number; baselineValue?: number }[] = [];
      
      monthlyValues.forEach((metrics, month) => {
        metrics.forEach((result, metricKey) => {
          // Only save if not locked
          const entry = entries.find(e => e.month === month && e.metric_name === metricKey);
          if (!entry?.is_locked) {
            updates.push({
              month,
              metricName: metricKey,
              forecastValue: result.value,
              baselineValue: result.baseline_value,
            });
          }
        });
      });
      
      if (updates.length > 0) {
        bulkUpdateEntries.mutate(updates, {
          onSuccess: () => {
            // Silent save, no toast
          },
        });
      }
    }, 1500); // 1.5 second debounce
    
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [salesGrowth, gpPercent, salesExpPercent, fixedExpense, monthlyValues, forecast, entries]);

  // Handle cell edits
  const handleCellEdit = (month: string, metricName: string, value: number) => {
    if (view === 'quarter') {
      // Distribute to months
      const distributions = distributeQuarterToMonths(month as 'Q1' | 'Q2' | 'Q3' | 'Q4', metricName, value);
      distributions.forEach(d => {
        updateEntry.mutate({ month: d.month, metricName, forecastValue: d.value });
      });
    } else {
      updateEntry.mutate({ month, metricName, forecastValue: value });
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

  // Get department profit for comparison
  const forecastDeptProfit = annualValues.get('department_profit')?.value || 0;
  const baselineDeptProfit = annualValues.get('department_profit')?.baseline_value || 0;
  const profitVariance = forecastDeptProfit - baselineDeptProfit;
  const profitVariancePercent = baselineDeptProfit !== 0 ? (profitVariance / Math.abs(baselineDeptProfit)) * 100 : 0;

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl lg:max-w-4xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold">
              Forecast {forecastYear} — {departmentName}
            </SheetTitle>
            <Button size="sm" className="mr-8" disabled={!forecast}>
              Save Forecast
            </Button>
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
                updateWeight.mutate({ monthNumber, adjustedWeight, isLocked });
              }}
              onResetWeights={() => resetWeights.mutate()}
              isUpdating={updateWeight.isPending}
            />

            {/* Key Drivers */}
            <ForecastDriverInputs
              salesGrowth={salesGrowth}
              gpPercent={gpPercent}
              salesExpPercent={salesExpPercent}
              fixedExpense={fixedExpense}
              baselineGpPercent={baselineGpPercent}
              baselineSalesExpPercent={baselineSalesExpPercent}
              baselineFixedExpense={baselineFixedExpense}
              onSalesGrowthChange={setSalesGrowth}
              onGpPercentChange={setGpPercent}
              onSalesExpPercentChange={setSalesExpPercent}
              onFixedExpenseChange={setFixedExpense}
            />

            {/* Forecast Results Grid */}
            <ForecastResultsGrid
              view={view}
              monthlyValues={monthlyValues}
              quarterlyValues={quarterlyValues}
              annualValues={annualValues}
              metricDefinitions={metricDefinitions}
              months={months}
              subMetrics={subMetrics}
              visibleMonthStart={visibleMonthStart}
              forecastYear={forecastYear}
              priorYear={priorYear}
              onCellEdit={handleCellEdit}
              onToggleLock={handleToggleLock}
              onMonthNavigate={handleMonthNavigate}
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
