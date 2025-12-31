import { useState, useEffect, useMemo } from 'react';
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
  const forecastYear = currentYear + 1;
  const priorYear = currentYear - 1;

  const [view, setView] = useState<'monthly' | 'quarter' | 'annual'>('monthly');
  
  // Driver states
  const [salesGrowth, setSalesGrowth] = useState(0);
  const [gpPercent, setGpPercent] = useState(28);
  const [salesExpPercent, setSalesExpPercent] = useState(42);
  const [fixedExpense, setFixedExpense] = useState(0);

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
              onCellEdit={handleCellEdit}
              onToggleLock={handleToggleLock}
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
