import React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SubMetricEntry {
  name: string;
  value: number | null;
}

interface SubMetricsRowProps {
  subMetrics: SubMetricEntry[];
  isExpanded: boolean;
  monthIdentifiers: string[];
  formatValue: (value: number | null) => string;
  // Callback to get sub-metric values by name and month
  getSubMetricValue: (subMetricName: string, monthId: string) => number | null;
}

export const SubMetricsRow: React.FC<SubMetricsRowProps> = ({
  subMetrics,
  isExpanded,
  monthIdentifiers,
  formatValue,
  getSubMetricValue,
}) => {
  if (!isExpanded || subMetrics.length === 0) return null;

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
