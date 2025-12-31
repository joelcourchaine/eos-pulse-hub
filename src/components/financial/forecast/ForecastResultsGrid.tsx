import { cn } from '@/lib/utils';
import { ChevronRight, ChevronDown, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState } from 'react';

interface CalculationResult {
  month: string;
  metric_name: string;
  value: number;
  baseline_value: number;
  is_locked: boolean;
}

interface MetricDefinition {
  key: string;
  label: string;
  type: 'currency' | 'percent' | 'number';
  isDriver: boolean;
  isDerived: boolean;
}

interface ForecastResultsGridProps {
  view: 'monthly' | 'quarter' | 'annual';
  monthlyValues: Map<string, Map<string, CalculationResult>>;
  quarterlyValues: Record<string, Map<string, CalculationResult>>;
  annualValues: Map<string, CalculationResult>;
  metricDefinitions: MetricDefinition[];
  months: string[];
  onCellEdit?: (month: string, metricName: string, value: number) => void;
  onToggleLock?: (month: string, metricName: string) => void;
}

const formatCurrency = (value: number) => {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const formatValue = (value: number, type: 'currency' | 'percent' | 'number') => {
  if (type === 'percent') return `${value.toFixed(1)}%`;
  if (type === 'currency') return formatCurrency(value);
  return value.toFixed(0);
};

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ForecastResultsGrid({
  view,
  monthlyValues,
  quarterlyValues,
  annualValues,
  metricDefinitions,
  months,
  onCellEdit,
  onToggleLock,
}: ForecastResultsGridProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Get columns based on view
  const getColumns = () => {
    if (view === 'monthly') {
      // Show first 6 months for now (can scroll for more)
      return months.slice(0, 6).map((m, i) => ({
        key: m,
        label: MONTH_ABBREV[i],
      }));
    }
    if (view === 'quarter') {
      return [
        { key: 'Q1', label: 'Q1' },
        { key: 'Q2', label: 'Q2' },
        { key: 'Q3', label: 'Q3' },
        { key: 'Q4', label: 'Q4' },
      ];
    }
    return [];
  };

  const columns = getColumns();

  const getValue = (column: string, metricKey: string): CalculationResult | undefined => {
    if (view === 'monthly') {
      return monthlyValues.get(column)?.get(metricKey);
    }
    if (view === 'quarter') {
      return quarterlyValues[column]?.get(metricKey);
    }
    return undefined;
  };

  const handleCellClick = (columnKey: string, metricKey: string, currentValue: number) => {
    const cellKey = `${columnKey}:${metricKey}`;
    setEditingCell(cellKey);
    setEditValue(currentValue.toString());
  };

  const handleCellBlur = (columnKey: string, metricKey: string) => {
    if (editingCell === `${columnKey}:${metricKey}`) {
      const newValue = parseFloat(editValue);
      if (!isNaN(newValue) && onCellEdit) {
        onCellEdit(columnKey, metricKey, newValue);
      }
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, columnKey: string, metricKey: string) => {
    if (e.key === 'Enter') {
      handleCellBlur(columnKey, metricKey);
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Forecast Results</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium min-w-[140px]">Metric</th>
              {columns.map((col) => (
                <th key={col.key} className="text-right py-2 px-2 font-medium min-w-[80px]">
                  {col.label}
                </th>
              ))}
              <th className="text-right py-2 pl-2 font-medium bg-muted/50 min-w-[90px]">Year</th>
            </tr>
          </thead>
          <tbody>
            {metricDefinitions.map((metric) => {
              const annualData = annualValues.get(metric.key);
              const variance = annualData 
                ? annualData.value - annualData.baseline_value 
                : 0;
              const isPositiveVariance = variance >= 0;
              
              return (
                <tr 
                  key={metric.key} 
                  className={cn(
                    "border-b border-border/50 hover:bg-muted/30",
                    metric.isDriver && "bg-primary/5"
                  )}
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        metric.isDriver && "font-medium text-primary"
                      )}>
                        {metric.label}
                      </span>
                      {metric.isDriver && (
                        <span className="text-xs text-muted-foreground">(driver)</span>
                      )}
                    </div>
                  </td>
                  
                  {columns.map((col) => {
                    const data = getValue(col.key, metric.key);
                    const cellKey = `${col.key}:${metric.key}`;
                    const isEditing = editingCell === cellKey;
                    
                    return (
                      <td 
                        key={col.key} 
                        className={cn(
                          "text-right py-1 px-2",
                          data?.is_locked && "bg-amber-50 dark:bg-amber-950/20"
                        )}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleCellBlur(col.key, metric.key)}
                              onKeyDown={(e) => handleKeyDown(e, col.key, metric.key)}
                              className="h-6 w-20 text-right text-sm"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:underline"
                              onClick={() => data && handleCellClick(col.key, metric.key, data.value)}
                            >
                              {data ? formatValue(data.value, metric.type) : '-'}
                            </span>
                          )}
                          {data?.is_locked && (
                            <Lock className="h-3 w-3 text-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  
                  <td className={cn(
                    "text-right py-2 pl-2 font-medium bg-muted/50",
                    isPositiveVariance ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  )}>
                    {annualData ? formatValue(annualData.value, metric.type) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
