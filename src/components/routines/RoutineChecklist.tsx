import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoutineItemRow } from "./RoutineItemRow";
import { Loader2 } from "lucide-react";

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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{routine.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount} / {totalCount}
          </span>
        </div>
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
