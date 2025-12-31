import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Lock, Unlock, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForecast } from '@/hooks/forecast/useForecast';
import { useWeightedBaseline } from '@/hooks/forecast/useWeightedBaseline';
import { ForecastWeightsPanel } from './forecast/ForecastWeightsPanel';
import { ForecastDriverInputs } from './forecast/ForecastDriverInputs';

interface ForecastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatValue = (value: number, isPercent?: boolean) => {
  if (isPercent) return `${value.toFixed(1)}%`;
  return formatCurrency(value);
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
  } = useForecast(departmentId, forecastYear);

  const { 
    calculatedWeights, 
    isLoading: weightsLoading,
    priorYearTotal,
  } = useWeightedBaseline(departmentId, priorYear);

  // Create forecast if it doesn't exist when drawer opens
  useEffect(() => {
    if (open && !forecast && !isLoading && calculatedWeights.length > 0) {
      const initialWeights = calculatedWeights.map(w => ({
        month_number: w.month_number,
        weight: w.weight,
      }));
      createForecast.mutate(initialWeights);
    }
  }, [open, forecast, isLoading, calculatedWeights]);

  // Calculate baseline from prior year
  const baselineAnnualSales = priorYearTotal;
  const forecastAnnualSales = baselineAnnualSales * (1 + salesGrowth / 100);
  const forecastGpNet = forecastAnnualSales * (gpPercent / 100);
  const forecastSalesExp = forecastGpNet * (salesExpPercent / 100);
  const forecastDeptProfit = forecastGpNet - forecastSalesExp - fixedExpense;

  // Mock metrics using calculated values
  const mockMetrics = [
    { name: 'Total Sales', value: forecastAnnualSales, hasSubMetrics: true, isPercent: false },
    { name: 'GP Net', value: forecastGpNet, hasSubMetrics: false, isPercent: false },
    { name: 'GP %', value: gpPercent, hasSubMetrics: false, isPercent: true },
    { name: 'Sales Expense', value: forecastSalesExp, hasSubMetrics: true, isPercent: false },
    { name: 'Fixed Expense', value: fixedExpense, hasSubMetrics: false, isPercent: false },
    { name: 'Dept Profit', value: forecastDeptProfit, hasSubMetrics: false, isPercent: false },
  ];

  const baselineProfit = baselineAnnualSales * 0.28 * 0.15; // Rough baseline profit estimate
  const profitVariance = forecastDeptProfit - baselineProfit;
  const profitVariancePercent = baselineProfit !== 0 ? (profitVariance / baselineProfit) * 100 : 0;

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
            <div className="space-y-2">
              <h3 className="font-semibold">Forecast Results</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium">Metric</th>
                      {view === 'monthly' && (
                        <>
                          {weights.slice(0, 3).map((w) => (
                            <th key={w.month_number} className="text-right py-2 px-2 font-medium">
                              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][w.month_number - 1]}
                            </th>
                          ))}
                        </>
                      )}
                      {view === 'quarter' && (
                        <>
                          <th className="text-right py-2 px-2 font-medium">Q1</th>
                          <th className="text-right py-2 px-2 font-medium">Q2</th>
                          <th className="text-right py-2 px-2 font-medium">Q3</th>
                          <th className="text-right py-2 px-2 font-medium">Q4</th>
                        </>
                      )}
                      <th className="text-right py-2 pl-2 font-medium bg-muted/50">Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMetrics.map((metric) => {
                      // Calculate monthly values using weights
                      const monthlyValues = weights.slice(0, 3).map(w => 
                        metric.isPercent ? metric.value : metric.value * (w.adjusted_weight / 100)
                      );
                      const quarterlyValue = metric.isPercent ? metric.value : monthlyValues.reduce((a, b) => a + b, 0);
                      
                      return (
                        <tr key={metric.name} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              {metric.hasSubMetrics && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className={metric.hasSubMetrics ? 'font-medium' : ''}>
                                {metric.name}
                              </span>
                            </div>
                          </td>
                          {view === 'monthly' && (
                            <>
                              {monthlyValues.map((val, i) => (
                                <td key={i} className="text-right py-2 px-2">
                                  {formatValue(val, metric.isPercent)}
                                </td>
                              ))}
                            </>
                          )}
                          {view === 'quarter' && (
                            <>
                              <td className="text-right py-2 px-2">{formatValue(quarterlyValue, metric.isPercent)}</td>
                              <td className="text-right py-2 px-2">{formatValue(quarterlyValue * 1.05, metric.isPercent)}</td>
                              <td className="text-right py-2 px-2">{formatValue(quarterlyValue * 1.08, metric.isPercent)}</td>
                              <td className="text-right py-2 px-2">{formatValue(quarterlyValue * 0.95, metric.isPercent)}</td>
                            </>
                          )}
                          <td className="text-right py-2 pl-2 font-medium bg-muted/50">
                            {formatValue(metric.value, metric.isPercent)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Baseline Comparison */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <h3 className="font-semibold mb-3">vs Baseline</h3>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Dept Profit:</span>
                  <span className="ml-2 font-medium">{formatCurrency(forecastDeptProfit)}</span>
                  <span className="text-muted-foreground mx-1">vs</span>
                  <span className="text-muted-foreground">{formatCurrency(baselineProfit)} baseline</span>
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
