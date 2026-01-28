import { Checkbox } from "@/components/ui/checkbox";
import { Info, Trash2, Loader2 } from "lucide-react";
import { RoutineItemTooltip } from "./RoutineItemTooltip";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
  onDelete?: (itemId: string) => void;
  disabled?: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
}

export const RoutineItemRow = ({
  item,
  isCompleted,
  onToggle,
  onDelete,
  disabled,
  canDelete = false,
  isDeleting = false,
}: RoutineItemRowProps) => {
  const hasTooltipContent = item.description || item.report_info?.instructions;

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all group",
        isCompleted
          ? "bg-muted/50 border-muted"
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={() => onToggle(item.id)}
        disabled={disabled || isDeleting}
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

      {canDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(item.id)}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
};
