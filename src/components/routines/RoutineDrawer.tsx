import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RoutineChecklist } from "./RoutineChecklist";
import { Loader2, CheckSquare, AlertTriangle } from "lucide-react";
import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  format,
} from "date-fns";
import { 
  formatDueConfig, 
  getDueDate, 
  isOverdue,
  type DueDayConfig,
  type Cadence as CadenceType
} from "@/utils/routineDueDate";

type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

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

interface DepartmentRoutine {
  id: string;
  title: string;
  cadence: string;
  items: RoutineItem[];
  is_active: boolean;
  due_day_config?: DueDayConfig | null;
}

interface RoutineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  userId: string;
}

const CADENCE_ORDER: Cadence[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

function getPeriodStart(cadence: Cadence): Date {
  const now = new Date();
  switch (cadence) {
    case "daily":
      return startOfDay(now);
    case "weekly":
      return startOfWeek(now, { weekStartsOn: 1 });
    case "monthly":
      return startOfMonth(now);
    case "quarterly":
      return startOfQuarter(now);
    case "yearly":
      return startOfYear(now);
    default:
      return startOfDay(now);
  }
}

function getPeriodLabel(cadence: Cadence): string {
  const now = new Date();
  switch (cadence) {
    case "daily":
      return format(now, "EEEE, MMM d");
    case "weekly":
      return `Week of ${format(startOfWeek(now, { weekStartsOn: 1 }), "MMM d")}`;
    case "monthly":
      return format(now, "MMMM yyyy");
    case "quarterly":
      const q = Math.ceil((now.getMonth() + 1) / 3);
      return `Q${q} ${now.getFullYear()}`;
    case "yearly":
      return now.getFullYear().toString();
    default:
      return "";
  }
}

export const RoutineDrawer = ({
  open,
  onOpenChange,
  departmentId,
  userId,
}: RoutineDrawerProps) => {
  const [routines, setRoutines] = useState<DepartmentRoutine[]>([]);
  const [completionCounts, setCompletionCounts] = useState<Record<string, { completed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeCadence, setActiveCadence] = useState<Cadence>("daily");

  useEffect(() => {
    if (open && departmentId) {
      fetchRoutines();
    }
  }, [open, departmentId]);

  const fetchRoutines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("department_routines")
        .select("*")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("title");

      if (error) throw error;
      
      const typedData: DepartmentRoutine[] = (data || []).map(r => ({
        ...r,
        items: Array.isArray(r.items) ? r.items as unknown as RoutineItem[] : [],
        due_day_config: r.due_day_config as unknown as DueDayConfig | null,
      }));
      
      setRoutines(typedData);

      // Fetch completion counts for badge display
      await fetchCompletionCounts(typedData);
    } catch (error: any) {
      console.error("Error fetching routines:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletionCounts = async (routineData: DepartmentRoutine[]) => {
    const counts: Record<string, { completed: number; total: number }> = {};

    for (const routine of routineData) {
      const cadence = routine.cadence as Cadence;
      const periodStart = format(getPeriodStart(cadence), "yyyy-MM-dd");
      const items = routine.items || [];

      const { data, error } = await supabase
        .from("routine_completions")
        .select("item_id")
        .eq("routine_id", routine.id)
        .eq("period_start", periodStart);

      if (!error) {
        counts[routine.id] = {
          completed: data?.length || 0,
          total: items.length,
        };
      }
    }

    setCompletionCounts(counts);
  };

  // Group routines by cadence
  const routinesByCadence = useMemo(() => {
    const grouped: Record<Cadence, DepartmentRoutine[]> = {
      daily: [],
      weekly: [],
      monthly: [],
      quarterly: [],
      yearly: [],
    };

    routines.forEach((routine) => {
      const cadence = routine.cadence as Cadence;
      if (grouped[cadence]) {
        grouped[cadence].push(routine);
      }
    });

    return grouped;
  }, [routines]);

  // Calculate totals per cadence for badges
  const cadenceTotals = useMemo(() => {
    const totals: Record<Cadence, { completed: number; total: number }> = {
      daily: { completed: 0, total: 0 },
      weekly: { completed: 0, total: 0 },
      monthly: { completed: 0, total: 0 },
      quarterly: { completed: 0, total: 0 },
      yearly: { completed: 0, total: 0 },
    };

    routines.forEach((routine) => {
      const cadence = routine.cadence as Cadence;
      const counts = completionCounts[routine.id];
      if (counts) {
        totals[cadence].completed += counts.completed;
        totals[cadence].total += counts.total;
      }
    });

    return totals;
  }, [routines, completionCounts]);

  // Find first cadence with routines
  useEffect(() => {
    if (routines.length > 0) {
      const firstWithRoutines = CADENCE_ORDER.find(
        (c) => routinesByCadence[c].length > 0
      );
      if (firstWithRoutines) {
        setActiveCadence(firstWithRoutines);
      }
    }
  }, [routines, routinesByCadence]);

  const availableCadences = CADENCE_ORDER.filter(
    (c) => routinesByCadence[c].length > 0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            My Routines
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No routines assigned yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask your admin to deploy routine templates
            </p>
          </div>
        ) : (
          <Tabs
            value={activeCadence}
            onValueChange={(v) => setActiveCadence(v as Cadence)}
            className="mt-4"
          >
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableCadences.length}, 1fr)` }}>
              {availableCadences.map((cadence) => {
                const totals = cadenceTotals[cadence];
                const isComplete = totals.total > 0 && totals.completed === totals.total;
                return (
                  <TabsTrigger key={cadence} value={cadence} className="text-xs capitalize relative">
                    {cadence}
                    {totals.total > 0 && (
                      <Badge
                        variant={isComplete ? "default" : "secondary"}
                        className="ml-1.5 h-5 px-1.5 text-[10px]"
                      >
                        {totals.completed}/{totals.total}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CADENCE_ORDER.map((cadence) => {
              // Check if any routine in this cadence has an overdue config
              const hasOverdue = routinesByCadence[cadence].some((routine) => {
                if (!routine.due_day_config) return false;
                const periodDate = getPeriodStart(cadence);
                const dueDate = getDueDate(cadence as CadenceType, periodDate, routine.due_day_config);
                return dueDate && isOverdue(dueDate);
              });

              // Get shared due config text if all routines have the same config
              const sharedDueText = (() => {
                const configs = routinesByCadence[cadence]
                  .map(r => r.due_day_config)
                  .filter(Boolean);
                if (configs.length === 0) return null;
                const firstConfig = configs[0];
                const allSame = configs.every(c => JSON.stringify(c) === JSON.stringify(firstConfig));
                if (allSame && firstConfig) {
                  return formatDueConfig(cadence as CadenceType, firstConfig);
                }
                return null;
              })();

              return (
                <TabsContent key={cadence} value={cadence} className="space-y-4 mt-4">
                  <div className="text-sm text-muted-foreground text-center mb-4 flex items-center justify-center gap-2">
                    <span>{getPeriodLabel(cadence)}</span>
                    {sharedDueText && (
                      <>
                        <span>•</span>
                        <span className={hasOverdue ? "text-destructive font-medium flex items-center gap-1" : ""}>
                          {hasOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {sharedDueText}
                          {hasOverdue && " (Overdue)"}
                        </span>
                      </>
                    )}
                  </div>

                  {routinesByCadence[cadence].map((routine) => (
                    <RoutineChecklist
                      key={routine.id}
                      routine={routine}
                      periodStart={format(getPeriodStart(cadence), "yyyy-MM-dd")}
                      userId={userId}
                    />
                  ))}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
};
