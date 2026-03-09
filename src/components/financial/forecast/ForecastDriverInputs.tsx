import { Slider } from '@/components/ui/slider';
import { AlertTriangle } from 'lucide-react';

interface ForecastDriverInputsProps {
  growth: number;
  onGrowthChange: (value: number) => void;
  hasManualEdits?: boolean;
  isPendingConfirm?: boolean;
}

export function ForecastDriverInputs({
  growth,
  onGrowthChange,
  hasManualEdits = false,
  isPendingConfirm = false,
}: ForecastDriverInputsProps) {
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
              className={isPendingConfirm ? 'flex-1 [&_.slider-thumb]:ring-2 [&_.slider-thumb]:ring-yellow-500' : 'flex-1'}
            />
            <span className="text-xs text-muted-foreground w-8">+25%</span>
          </div>
          {hasManualEdits ? (
            <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Moving this slider will overwrite all manually entered forecast cells
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Scales Total Sales and GP Net proportionally (GP% stays constant)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
