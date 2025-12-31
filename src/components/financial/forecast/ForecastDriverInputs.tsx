import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

interface ForecastDriverInputsProps {
  salesGrowth: number;
  gpPercent: number;
  salesExpPercent: number;
  fixedExpense: number;
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
  onSalesGrowthChange,
  onGpPercentChange,
  onSalesExpPercentChange,
  onFixedExpenseChange,
}: ForecastDriverInputsProps) {
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
      <h3 className="font-semibold">Key Drivers</h3>
      
      <div className="space-y-4">
        {/* Sales Growth */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sales Growth</span>
            <span className="font-medium">{salesGrowth > 0 ? '+' : ''}{salesGrowth.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">-10%</span>
            <Slider
              value={[salesGrowth]}
              onValueChange={([v]) => onSalesGrowthChange(v)}
              min={-10}
              max={25}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">+25%</span>
          </div>
        </div>

        {/* GP % */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>GP % Target</span>
            <span className="font-medium">{gpPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">15%</span>
            <Slider
              value={[gpPercent]}
              onValueChange={([v]) => onGpPercentChange(v)}
              min={15}
              max={80}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">80%</span>
          </div>
        </div>

        {/* Sales Expense % */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Sales Expense %</span>
            <span className="font-medium">{salesExpPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-8">20%</span>
            <Slider
              value={[salesExpPercent]}
              onValueChange={([v]) => onSalesExpPercentChange(v)}
              min={20}
              max={80}
              step={0.5}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground w-8">80%</span>
          </div>
        </div>

        {/* Fixed Expense */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Fixed Expense (Annual)</span>
            <span className="font-medium">{formatCurrency(fixedExpense)}</span>
          </div>
          <Input
            type="text"
            value={`$${Math.round(fixedExpense).toLocaleString()}`}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.-]/g, '');
              onFixedExpenseChange(parseFloat(raw) || 0);
            }}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
