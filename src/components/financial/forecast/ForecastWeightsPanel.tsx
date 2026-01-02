import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForecastWeight } from '@/hooks/forecast/useForecast';

interface CalculatedWeight {
  month_number: number;
  month_name: string;
  sales_value: number;
  weight: number;
}

interface ForecastWeightsPanelProps {
  weights: ForecastWeight[];
  calculatedWeights: CalculatedWeight[];
  onUpdateWeight: (monthNumber: number, adjustedWeight?: number, isLocked?: boolean) => void;
  onResetWeights: () => void;
  isUpdating: boolean;
}

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ForecastWeightsPanel({
  weights,
  calculatedWeights,
  onUpdateWeight,
  onResetWeights,
  isUpdating,
}: ForecastWeightsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Local state for input values to allow free typing
  const [localValues, setLocalValues] = useState<Record<number, string>>({});
  const [editingMonth, setEditingMonth] = useState<number | null>(null);

  // Merge calculated weights with saved weights
  // Original always shows the CALCULATED weight from sales data, not saved original
  const mergedWeights = useMemo(() => {
    return calculatedWeights.map((cw) => {
      const savedWeight = weights.find((w) => w.month_number === cw.month_number);
      return {
        month_number: cw.month_number,
        month_name: cw.month_name,
        original_weight: cw.weight, // Always use calculated weight for "Original"
        adjusted_weight: savedWeight?.adjusted_weight ?? cw.weight,
        is_locked: savedWeight?.is_locked ?? false,
      };
    });
  }, [calculatedWeights, weights]);

  const totalWeight = mergedWeights.reduce((sum, w) => sum + w.adjusted_weight, 0);
  const isValid = Math.abs(totalWeight - 100) < 0.1;

  // Sync local values when not actively editing
  useEffect(() => {
    if (editingMonth !== null) return;

    const next: Record<number, string> = {};
    mergedWeights.forEach((w) => {
      next[w.month_number] = w.adjusted_weight.toFixed(1);
    });

    setLocalValues((prev) => {
      // Avoid infinite update loops by only updating state if something actually changed.
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length !== nextKeys.length) return next;
      for (const k of nextKeys) {
        if (prev[Number(k)] !== next[Number(k)]) return next;
      }
      return prev;
    });
  }, [mergedWeights, editingMonth]);

  const handleInputChange = (monthNumber: number, value: string) => {
    setLocalValues(prev => ({ ...prev, [monthNumber]: value }));
  };

  const handleInputFocus = (monthNumber: number) => {
    setEditingMonth(monthNumber);
  };

  const handleInputBlur = (monthNumber: number) => {
    setEditingMonth(null);
    const value = localValues[monthNumber];
    const newWeight = parseFloat(value) || 0;
    onUpdateWeight(monthNumber, newWeight, undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent, monthNumber: number) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleLockToggle = (monthNumber: number, currentLocked: boolean) => {
    onUpdateWeight(monthNumber, undefined, !currentLocked);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-3 py-2 h-auto bg-muted/50">
          <span className="font-semibold">Weight Distribution</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm",
              !isValid ? "text-destructive" : "text-muted-foreground"
            )}>
              Total: {totalWeight.toFixed(1)}%
            </span>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div className="font-medium text-muted-foreground">Month</div>
          <div className="font-medium text-muted-foreground">Original</div>
          <div className="font-medium text-muted-foreground">Adjusted</div>
          <div className="font-medium text-muted-foreground text-center">Lock</div>
          
          {mergedWeights.map((w) => (
            <div key={w.month_number} className="contents">
              <div className="py-1">{MONTH_ABBREV[w.month_number - 1]}</div>
              <div className="py-1 text-muted-foreground">{w.original_weight.toFixed(1)}%</div>
              <div>
                <Input
                  type="number"
                  value={localValues[w.month_number] ?? w.adjusted_weight.toFixed(1)}
                  onChange={(e) => handleInputChange(w.month_number, e.target.value)}
                  onFocus={() => handleInputFocus(w.month_number)}
                  onBlur={() => handleInputBlur(w.month_number)}
                  onKeyDown={(e) => handleKeyDown(e, w.month_number)}
                  className="h-7 w-20 text-sm"
                  step="0.1"
                  disabled={w.is_locked || isUpdating}
                />
              </div>
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleLockToggle(w.month_number, w.is_locked)}
                  disabled={isUpdating}
                >
                  {w.is_locked ? (
                    <Lock className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onResetWeights}
            disabled={isUpdating}
          >
            Reset to Original
          </Button>
          {!isValid && (
            <span className="text-sm text-destructive">
              Weights must sum to 100%
            </span>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
