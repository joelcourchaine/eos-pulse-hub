import { Checkbox } from "@/components/ui/checkbox";
import { Info } from "lucide-react";
import { RoutineItemTooltip } from "./RoutineItemTooltip";
import { cn } from "@/lib/utils";

interface ReportInfo {
  type: "internal" | "external" | "manual";
  path?: string;
  instructions?: string;
}

interface RoutineItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  report_info?: ReportInfo;
}

interface RoutineItemRowProps {
  item: RoutineItem;
  isCompleted: boolean;
  onToggle: (itemId: string) => void;
  disabled?: boolean;
}

export const RoutineItemRow = ({
  item,
  isCompleted,
  onToggle,
  disabled,
}: RoutineItemRowProps) => {
  const hasTooltipContent = item.description || item.report_info?.instructions;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all",
        isCompleted
          ? "bg-muted/50 border-muted"
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggle(item.id)}
        disabled={disabled}
        className="mt-0.5"
      />

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm transition-all",
            isCompleted && "line-through text-muted-foreground"
          )}
        >
          {item.title}
        </span>
      </div>

      {hasTooltipContent && (
        <RoutineItemTooltip
          title={item.title}
          description={item.description}
          reportInfo={item.report_info}
        >
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <Info className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        </RoutineItemTooltip>
      )}
    </div>
  );
};
