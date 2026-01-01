import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useMemo, useState, useEffect } from 'react';

interface ForecastDriverInputsProps {
  salesGrowth: number;
  gpPercent: number;
  salesExpense: number; // Annual sales expense in dollars (fixed driver)
  fixedExpense: number;
  baselineGpPercent?: number;
  baselineSalesExpense?: number; // Baseline annual sales expense
  baselineFixedExpense?: number;
  onSalesGrowthChange: (value: number) => void;
  onGpPercentChange: (value: number) => void;
  onSalesExpenseChange: (value: number) => void; // Changed from percent to dollars
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
  salesExpense,
  fixedExpense,
  baselineGpPercent,
  baselineSalesExpense,
  baselineFixedExpense,
  onSalesGrowthChange,
  onGpPercentChange,
  onSalesExpenseChange,
  onFixedExpenseChange,
}: ForecastDriverInputsProps) {
  // Local state for text inputs to prevent focus loss during typing
  const [localSalesExpense, setLocalSalesExpense] = useState(`$${Math.round(salesExpense).toLocaleString()}`);
  const [localFixedExpense, setLocalFixedExpense] = useState(`$${Math.round(fixedExpense).toLocaleString()}`);

  // Sync local state when prop changes (but not during editing)
  useEffect(() => {
    setLocalSalesExpense(`$${Math.round(salesExpense).toLocaleString()}`);
  }, [salesExpense]);

  useEffect(() => {
    setLocalFixedExpense(`$${Math.round(fixedExpense).toLocaleString()}`);
  }, [fixedExpense]);

  // Calculate dynamic slider ranges centered on baseline values
  const gpRange = useMemo(() => {
    const baseline = baselineGpPercent ?? gpPercent;
    const halfRange = 20; // +/- 20 percentage points
    return {
      min: Math.max(0, Math.round((baseline - halfRange) * 2) / 2),
      max: Math.min(100, Math.round((baseline + halfRange) * 2) / 2),
    };
  }, [baselineGpPercent, gpPercent]);

  const handleSalesExpenseBlur = () => {
    const raw = localSalesExpense.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(raw) || 0;
    onSalesExpenseChange(parsed);
  };

  const handleFixedExpenseBlur = () => {
    const raw = localFixedExpense.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(raw) || 0;
    onFixedExpenseChange(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent, onBlur: () => void) => {
    if (e.key === 'Enter') {
      onBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

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

        {/* Sales Expense - text input (fixed dollar amount) */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sales Expense (Annual)</span>
            <span className="font-medium">{formatCurrency(salesExpense)}</span>
          </div>
          <Input
            type="text"
            value={localSalesExpense}
            onChange={(e) => setLocalSalesExpense(e.target.value)}
            onBlur={handleSalesExpenseBlur}
            onKeyDown={(e) => handleKeyDown(e, handleSalesExpenseBlur)}
            className="w-full"
          />
          {baselineSalesExpense !== undefined && salesExpense !== baselineSalesExpense && (
            <p className="text-xs text-muted-foreground">
              Baseline: {formatCurrency(baselineSalesExpense)} ({salesExpense > baselineSalesExpense ? '+' : ''}{((salesExpense - baselineSalesExpense) / baselineSalesExpense * 100).toFixed(1)}%)
            </p>
          )}
        </div>

        {/* Fixed Expense - text input */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Fixed Expense (Annual)</span>
            <span className="font-medium">{formatCurrency(fixedExpense)}</span>
          </div>
          <Input
            type="text"
            value={localFixedExpense}
            onChange={(e) => setLocalFixedExpense(e.target.value)}
            onBlur={handleFixedExpenseBlur}
            onKeyDown={(e) => handleKeyDown(e, handleFixedExpenseBlur)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
