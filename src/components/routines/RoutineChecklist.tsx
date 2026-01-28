import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoutineItemRow } from "./RoutineItemRow";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { 
  getDueDate, 
  formatDueDate, 
  getDueStatus,
  type DueDayConfig, 
  type Cadence 
} from "@/utils/routineDueDate";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from "date-fns";

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

interface Routine {
  id: string;
  title: string;
  cadence: string;
  items: RoutineItem[];
  is_active: boolean;
  due_day_config?: DueDayConfig | null;
}

interface RoutineChecklistProps {
  routine: Routine;
  periodStart: string;
  userId: string;
}

export const RoutineChecklist = ({
  routine,
  periodStart,
  userId,
}: RoutineChecklistProps) => {
  const { toast } = useToast();
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  // Parse items from JSONB
  const items: RoutineItem[] = Array.isArray(routine.items)
    ? routine.items
    : [];

  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const completedCount = completedItems.size;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  // Calculate due date
  const dueInfo = useMemo(() => {
    if (!routine.due_day_config) return null;
    
    const cadence = routine.cadence as Cadence;
    // Parse periodStart string to get the Date
    const periodDate = new Date(periodStart);
    
    const dueDate = getDueDate(cadence, periodDate, routine.due_day_config);
    if (!dueDate) return null;
    
    const status = getDueStatus(dueDate);
    const formattedDate = formatDueDate(dueDate);
    
    return { dueDate, status, formattedDate };
  }, [routine.cadence, routine.due_day_config, periodStart]);

  useEffect(() => {
    fetchCompletions();

    // Real-time subscription for completions
    const channel = supabase
      .channel(`routine-completions-${routine.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "routine_completions",
          filter: `routine_id=eq.${routine.id}`,
        },
        () => {
          fetchCompletions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [routine.id, periodStart]);

  const fetchCompletions = async () => {
    try {
      const { data, error } = await supabase
        .from("routine_completions")
        .select("item_id")
        .eq("routine_id", routine.id)
        .eq("period_start", periodStart);

      if (error) throw error;

      setCompletedItems(new Set(data?.map((c) => c.item_id) || []));
    } catch (error: any) {
      console.error("Error fetching completions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (itemId: string) => {
    const isCurrentlyCompleted = completedItems.has(itemId);
    setToggling(itemId);

    try {
      if (isCurrentlyCompleted) {
        // Uncomplete - delete the completion record
        const { error } = await supabase
          .from("routine_completions")
          .delete()
          .eq("routine_id", routine.id)
          .eq("item_id", itemId)
          .eq("period_start", periodStart);

        if (error) throw error;

        setCompletedItems((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      } else {
        // Complete - insert a completion record
        const { error } = await supabase.from("routine_completions").insert({
          routine_id: routine.id,
          item_id: itemId,
          period_start: periodStart,
          completed_by: userId,
        });

        if (error) throw error;

        setCompletedItems((prev) => new Set(prev).add(itemId));
      }
    } catch (error: any) {
      console.error("Error toggling completion:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update completion status",
      });
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{routine.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={dueInfo?.status.variant === "destructive" && !isComplete ? "border-destructive/50" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{routine.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount} / {totalCount}
          </span>
        </div>
        
        {/* Due date indicator */}
        {dueInfo && !isComplete && (
          <div className="flex items-center gap-2 mt-1">
            {dueInfo.status.variant === "destructive" ? (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            ) : dueInfo.status.variant === "warning" ? (
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={`text-xs ${
              dueInfo.status.variant === "destructive" 
                ? "text-destructive font-medium" 
                : dueInfo.status.variant === "warning"
                ? "text-amber-600 dark:text-amber-500"
                : "text-muted-foreground"
            }`}>
              Due: {dueInfo.formattedDate}
              {dueInfo.status.variant === "destructive" && " (Overdue)"}
            </span>
          </div>
        )}
        
        {isComplete && dueInfo && (
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" className="text-[10px] py-0">
              ✓ Complete
            </Badge>
          </div>
        )}
        
        <Progress value={progressPercent} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-2">
        {sortedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No items in this routine
          </p>
        ) : (
          sortedItems.map((item) => (
            <RoutineItemRow
              key={item.id}
              item={item}
              isCompleted={completedItems.has(item.id)}
              onToggle={handleToggle}
              disabled={toggling === item.id}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
};
