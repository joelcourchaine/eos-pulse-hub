import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SubMetricEntry {
  name: string;
  value: number | null;
}

interface MonthlyPeriod {
  identifier: string;
  type: 'month' | 'year-avg' | 'year-total' | 'quarter-avg' | 'quarter-target';
  year?: number;
}

interface SubMetricsRowProps {
  subMetrics: SubMetricEntry[];
  isExpanded: boolean;
  monthIdentifiers: string[];
  formatValue: (value: number | null) => string;
  // Callback to get sub-metric values by name and month
  getSubMetricValue: (subMetricName: string, monthId: string) => number | null;
  // For monthly trend mode: full period list including summary columns
  periods?: MonthlyPeriod[];
  // Whether to include sparkline column
  hasSparklineColumn?: boolean;
}

// Helper to calculate average from values
const calculateAverage = (values: (number | null)[]): number | null => {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
};

// Helper to calculate total from values
const calculateTotal = (values: (number | null)[]): number | null => {
  const validValues = values.filter((v): v is number => v !== null);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, v) => sum + v, 0);
};

export const SubMetricsRow: React.FC<SubMetricsRowProps> = ({
  subMetrics,
  isExpanded,
  monthIdentifiers,
  formatValue,
  getSubMetricValue,
  periods,
  hasSparklineColumn = false,
}) => {
  if (!isExpanded) return null;
  
  // Calculate total column count for colSpan
  const extraColumns = (hasSparklineColumn ? 1 : 0) + (periods ? periods.filter(p => p.type !== 'month').length : 0);
  const totalDataColumns = monthIdentifiers.length + extraColumns;
  
  // Show placeholder when expanded but no sub-metrics data yet
  if (subMetrics.length === 0) {
    return (
      <TableRow className="bg-muted/20">
        <TableCell 
          colSpan={totalDataColumns + 1} 
          className="sticky left-0 z-30 py-2 pl-8 text-xs text-muted-foreground italic"
        >
          No sub-metric data imported yet. Upload an Excel file with sub-metrics to see breakdown.
        </TableCell>
      </TableRow>
    );
  }

  // Helper to get summary value for a sub-metric
  const getSummaryValue = (subMetricName: string, periodType: MonthlyPeriod['type'], year?: number): number | null => {
    if (!periods) return null;
    
    // Get all month periods for the relevant year
    const monthPeriods = periods.filter(p => {
      if (p.type !== 'month') return false;
      if (year !== undefined) {
        // Extract year from month identifier (format: "2025-01")
        const periodYear = parseInt(p.identifier.split('-')[0]);
        return periodYear === year;
      }
      return true;
    });
    
    const values = monthPeriods.map(p => getSubMetricValue(subMetricName, p.identifier));
    
    if (periodType === 'year-avg' || periodType === 'quarter-avg') {
      return calculateAverage(values);
    } else if (periodType === 'year-total') {
      return calculateTotal(values);
    }
    
    return null;
  };

  // If we have periods, render columns matching the parent row structure
  if (periods && periods.length > 0) {
    return (
      <>
        {subMetrics.map((subMetric, idx) => (
          <TableRow 
            key={`sub-${subMetric.name}-${idx}`}
            className="bg-muted/20 hover:bg-muted/30"
          >
            <TableCell className="sticky left-0 z-30 py-1 pl-8 w-[200px] min-w-[200px] max-w-[200px] border-r bg-muted/20 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">└</span>
                <p className="text-xs text-muted-foreground truncate">
                  {subMetric.name}
                </p>
              </div>
            </TableCell>
            {/* Sparkline column placeholder */}
            {hasSparklineColumn && (
              <TableCell className="px-1 py-0.5 min-w-[100px] max-w-[100px]" />
            )}
            {/* Render cells for each period, matching parent row structure */}
            {periods.map((period) => {
              if (period.type === 'month') {
                const value = getSubMetricValue(subMetric.name, period.identifier);
                return (
                  <TableCell 
                    key={period.identifier} 
                    className="text-center py-1 text-xs text-muted-foreground min-w-[125px] max-w-[125px]"
                  >
                    {value !== null ? formatValue(value) : "-"}
                  </TableCell>
                );
              }
              
              // Summary columns - calculate and display the appropriate value
              if (period.type === 'quarter-target') {
                // Quarter target doesn't apply to sub-metrics
                return (
                  <TableCell 
                    key={period.identifier} 
                    className={cn(
                      "text-center py-1 text-xs text-muted-foreground min-w-[100px] max-w-[100px]",
                      "bg-primary/5 border-x-2 border-primary/30"
                    )}
                  >
                    -
                  </TableCell>
                );
              }
              
              // Calculate summary value for year-avg, year-total, quarter-avg
              const summaryValue = getSummaryValue(subMetric.name, period.type, period.year);
              
              return (
                <TableCell 
                  key={period.identifier} 
                  className={cn(
                    "text-center py-1 text-xs text-muted-foreground",
                    period.type === 'year-avg' && "bg-primary/5 border-l-2 border-primary/30 min-w-[125px] max-w-[125px]",
                    period.type === 'year-total' && "bg-primary/5 border-r-2 border-primary/30 min-w-[125px] max-w-[125px]",
                    period.type === 'quarter-avg' && "bg-primary/5 border-x-2 border-primary/30 min-w-[100px] max-w-[100px]"
                  )}
                >
                  {summaryValue !== null ? formatValue(summaryValue) : "-"}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </>
    );
  }

  // Default rendering for non-monthly-trend modes
  return (
    <>
      {subMetrics.map((subMetric, idx) => (
        <TableRow 
          key={`sub-${subMetric.name}-${idx}`}
          className="bg-muted/20 hover:bg-muted/30"
        >
          <TableCell className="sticky left-0 z-30 py-1 pl-8 w-[200px] min-w-[200px] max-w-[200px] border-r bg-muted/20 shadow-[2px_0_4px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">└</span>
              <p className="text-xs text-muted-foreground truncate">
                {subMetric.name}
              </p>
            </div>
          </TableCell>
          {monthIdentifiers.map((monthId) => {
            const value = getSubMetricValue(subMetric.name, monthId);
            return (
              <TableCell 
                key={monthId} 
                className="text-center py-1 text-xs text-muted-foreground min-w-[125px] max-w-[125px]"
              >
                {value !== null ? formatValue(value) : "-"}
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
};

// Expandable trigger button for parent metric rows
interface ExpandableMetricNameProps {
  metricName: string;
  hasSubMetrics: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isDepartmentProfit?: boolean;
}

export const ExpandableMetricName: React.FC<ExpandableMetricNameProps> = ({
  metricName,
  hasSubMetrics,
  isExpanded,
  onToggle,
  isDepartmentProfit = false,
}) => {
  if (!hasSubMetrics) {
    return (
      <p className={cn(
        "text-sm truncate",
        isDepartmentProfit ? "font-bold text-base" : "font-medium"
      )}>
        {metricName}
      </p>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="flex items-center gap-1 w-full text-left hover:text-primary transition-colors"
    >
      {isExpanded ? (
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-primary" />
      ) : (
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      )}
      <p className={cn(
        "text-sm truncate",
        isDepartmentProfit ? "font-bold text-base" : "font-medium"
      )}>
        {metricName}
      </p>
    </button>
  );
};