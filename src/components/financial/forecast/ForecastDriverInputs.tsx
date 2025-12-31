import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useMemo } from 'react';

interface ForecastDriverInputsProps {
  salesGrowth: number;
  gpPercent: number;
  salesExpPercent: number;
  fixedExpense: number;
  baselineGpPercent?: number;
  baselineSalesExpPercent?: number;
  baselineFixedExpense?: number;
  onSalesGrowthChange: (value: number) => void;
  onGpPercentChange: (value: number) => void;
  onSalesExpPercentChange: (value: number) => void;
  onFixedExpenseChange: (value: number) => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function ForecastDriverInputs({
  salesGrowth,
  gpPercent,
  salesExpPercent,
  fixedExpense,
  baselineGpPercent,
  baselineSalesExpPercent,
  baselineFixedExpense,
  onSalesGrowthChange,
  onGpPercentChange,
  onSalesExpPercentChange,
  onFixedExpenseChange,
}: ForecastDriverInputsProps) {
  // Calculate dynamic slider ranges centered on baseline values
  const gpRange = useMemo(() => {
    const baseline = baselineGpPercent ?? gpPercent;
    const halfRange = 20; // +/- 20 percentage points
    return {
      min: Math.max(0, Math.round((baseline - halfRange) * 2) / 2),
      max: Math.min(100, Math.round((baseline + halfRange) * 2) / 2),
    };
  }, [baselineGpPercent, gpPercent]);

  const salesExpRange = useMemo(() => {
    const baseline = baselineSalesExpPercent ?? salesExpPercent;
    const halfRange = 25; // +/- 25 percentage points
    return {
      min: Math.max(0, Math.round((baseline - halfRange) * 2) / 2),
      max: Math.min(100, Math.round((baseline + halfRange) * 2) / 2),
    };
  }, [baselineSalesExpPercent, salesExpPercent]);

  const fixedExpRange = useMemo(() => {
    const baseline = baselineFixedExpense ?? fixedExpense;
    const halfRange = baseline * 0.5; // +/- 50% of baseline
    return {
      min: Math.max(0, Math.round(baseline - halfRange)),
      max: Math.round(baseline + halfRange),
    };
  }, [baselineFixedExpense, fixedExpense]);

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <h3 className="font-semibold">Key Drivers</h3>
      
      <div className="space-y-4">
        {/* Sales Growth - always centered at 0 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sales Growth</span>
            <span className="font-medium">{salesGrowth > 0 ? '+' : ''}{salesGrowth.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">-25%</span>
            <Slider
              value={[salesGrowth]}
              onValueChange={([v]) => onSalesGrowthChange(v)}
              min={-25}
              max={25}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">+25%</span>
          </div>
        </div>

        {/* GP % - centered on baseline */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>GP % Target</span>
            <span className="font-medium">{gpPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">{gpRange.min}%</span>
            <Slider
              value={[gpPercent]}
              onValueChange={([v]) => onGpPercentChange(v)}
              min={gpRange.min}
              max={gpRange.max}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{gpRange.max}%</span>
          </div>
        </div>

        {/* Sales Expense % - centered on baseline */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sales Expense %</span>
            <span className="font-medium">{salesExpPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">{salesExpRange.min}%</span>
            <Slider
              value={[salesExpPercent]}
              onValueChange={([v]) => onSalesExpPercentChange(v)}
              min={salesExpRange.min}
              max={salesExpRange.max}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">{salesExpRange.max}%</span>
          </div>
        </div>

        {/* Fixed Expense - centered on baseline */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Fixed Expense (Annual)</span>
            <span className="font-medium">{formatCurrency(fixedExpense)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-12">{formatCurrency(fixedExpRange.min)}</span>
            <Slider
              value={[fixedExpense]}
              onValueChange={([v]) => onFixedExpenseChange(v)}
              min={fixedExpRange.min}
              max={fixedExpRange.max}
              step={1000}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-12">{formatCurrency(fixedExpRange.max)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
