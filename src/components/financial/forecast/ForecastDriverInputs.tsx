import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';

interface ForecastDriverInputsProps {
  growth: number;
  salesExpense: number; // Annual sales expense in dollars (fixed driver)
  fixedExpense: number;
  baselineSalesExpense?: number; // Baseline annual sales expense
  baselineFixedExpense?: number;
  onGrowthChange: (value: number) => void;
  onSalesExpenseChange: (value: number) => void;
  onFixedExpenseChange: (value: number) => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

export function ForecastDriverInputs({
  growth,
  salesExpense,
  fixedExpense,
  baselineSalesExpense,
  baselineFixedExpense,
  onGrowthChange,
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
        {/* Growth % - scales both Total Sales and GP Net proportionally */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Growth %</span>
            <span className="font-medium">{growth > 0 ? '+' : ''}{growth.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">-25%</span>
            <Slider
              value={[growth]}
              onValueChange={([v]) => onGrowthChange(v)}
              min={-25}
              max={25}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">+25%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Scales Total Sales and GP Net proportionally (GP% stays constant)
          </p>
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
