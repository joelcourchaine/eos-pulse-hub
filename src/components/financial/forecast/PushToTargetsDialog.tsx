import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUp, ArrowDown, Loader2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FinancialMetric } from '@/config/financialMetrics';

interface CalculationResult {
  value: number;
  baseline_value: number;
  is_locked: boolean;
}

interface PushToTargetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forecastYear: number;
  quarterlyValues: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', Map<string, CalculationResult>>;
  metricDefinitions: FinancialMetric[];
  onConfirm: () => void;
  isPending: boolean;
}

export function PushToTargetsDialog({
  open,
  onOpenChange,
  forecastYear,
  quarterlyValues,
  metricDefinitions,
  onConfirm,
  isPending,
}: PushToTargetsDialogProps) {
  // Prepare table data from quarterly values
  const tableData = useMemo(() => {
    return metricDefinitions.map((metric) => {
      const q1Value = quarterlyValues.Q1?.get(metric.key)?.value ?? 0;
      const q2Value = quarterlyValues.Q2?.get(metric.key)?.value ?? 0;
      const q3Value = quarterlyValues.Q3?.get(metric.key)?.value ?? 0;
      const q4Value = quarterlyValues.Q4?.get(metric.key)?.value ?? 0;

      return {
        key: metric.key,
        name: metric.name,
        type: metric.type,
        targetDirection: metric.targetDirection,
        q1: q1Value,
        q2: q2Value,
        q3: q3Value,
        q4: q4Value,
      };
    });
  }, [metricDefinitions, quarterlyValues]);

  const formatValue = (value: number, type: 'dollar' | 'percentage') => {
    if (type === 'percentage') {
      return `${(value * 100).toFixed(1)}%`;
    }
    // For dollars, use abbreviated format
    const absValue = Math.abs(value);
    if (absValue >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (absValue >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Push Forecast to Targets
          </DialogTitle>
          <DialogDescription>
            This will update the {forecastYear} financial targets with your forecast values.
            Existing targets for {forecastYear} will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Metric</TableHead>
                <TableHead className="text-right">Q1</TableHead>
                <TableHead className="text-right">Q2</TableHead>
                <TableHead className="text-right">Q3</TableHead>
                <TableHead className="text-right">Q4</TableHead>
                <TableHead className="w-[80px] text-center">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatValue(row.q1, row.type)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatValue(row.q2, row.type)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatValue(row.q3, row.type)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatValue(row.q4, row.type)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div
                      className={cn(
                        'flex items-center justify-center gap-1 text-xs',
                        row.targetDirection === 'above'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-amber-600 dark:text-amber-400'
                      )}
                    >
                      {row.targetDirection === 'above' ? (
                        <>
                          <ArrowUp className="h-3 w-3" />
                          Higher
                        </>
                      ) : (
                        <>
                          <ArrowDown className="h-3 w-3" />
                          Lower
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pushing...
              </>
            ) : (
              <>
                <Target className="h-4 w-4 mr-2" />
                Push to Targets
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
