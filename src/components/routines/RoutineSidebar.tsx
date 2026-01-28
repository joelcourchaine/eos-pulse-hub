import { useState, useEffect, useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RoutineChecklist } from "./RoutineChecklist";
import { Loader2, CheckSquare, AlertTriangle, Calendar, CalendarDays, CalendarRange, CalendarClock, CalendarCheck } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface RoutineSidebarProps {
  departmentId: string;
  userId: string;
}

const CADENCE_ORDER: Cadence[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];

const CADENCE_ICONS: Record<Cadence, React.ComponentType<{ className?: string }>> = {
  daily: Calendar,
  weekly: CalendarDays,
  monthly: CalendarRange,
  quarterly: CalendarClock,
  yearly: CalendarCheck,
};

const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const CADENCE_SHORT: Record<Cadence, string> = {
  daily: "D",
  weekly: "W",
  monthly: "M",
  quarterly: "Q",
  yearly: "Y",
};

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

export const RoutineSidebar = ({
  departmentId,
  userId,
}: RoutineSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  
  const [routines, setRoutines] = useState<DepartmentRoutine[]>([]);
  const [completionCounts, setCompletionCounts] = useState<Record<string, { completed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [activeCadence, setActiveCadence] = useState<Cadence>("daily");

  useEffect(() => {
    if (departmentId) {
      fetchRoutines();
    }
  }, [departmentId]);

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

  // Find first cadence with routines (for default selection)
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

  // Get active cadence routines and info
  const cadenceRoutines = routinesByCadence[activeCadence];
  const hasRoutines = cadenceRoutines.length > 0;
  const totals = cadenceTotals[activeCadence];

  // Check if any routine in active cadence has an overdue config
  const hasOverdue = cadenceRoutines.some((routine) => {
    if (!routine.due_day_config) return false;
    const periodDate = getPeriodStart(activeCadence);
    const dueDate = getDueDate(activeCadence as CadenceType, periodDate, routine.due_day_config);
    return dueDate && isOverdue(dueDate);
  });

  // Get shared due config text if all routines have the same config
  const sharedDueText = (() => {
    const configs = cadenceRoutines
      .map(r => r.due_day_config)
      .filter(Boolean);
    if (configs.length === 0) return null;
    const firstConfig = configs[0];
    const allSame = configs.every(c => JSON.stringify(c) === JSON.stringify(firstConfig));
    if (allSame && firstConfig) {
      return formatDueConfig(activeCadence as CadenceType, firstConfig);
    }
    return null;
  })();

  // Calculate outstanding (incomplete) tasks per cadence
  const getOutstanding = (cadence: Cadence) => {
    const t = cadenceTotals[cadence];
    return t.total - t.completed;
  };

  return (
    <Sidebar 
      side="right" 
      collapsible="icon" 
      className="border-l !top-16 !h-[calc(100svh-4rem)]"
      style={{ "--sidebar-width-icon": "6.5rem" } as React.CSSProperties}
    >
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <CheckSquare className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">My Routines</span>
          </div>
          <SidebarTrigger className="h-7 w-7 shrink-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Cadence Menu */}
        <SidebarMenu className="p-2">
          {CADENCE_ORDER.map((cadence) => {
            const Icon = CADENCE_ICONS[cadence];
            const totals = cadenceTotals[cadence];
            const outstanding = getOutstanding(cadence);
            const isComplete = totals.total > 0 && totals.completed === totals.total;
            const isActive = activeCadence === cadence;

            return (
              <SidebarMenuItem key={cadence}>
                <SidebarMenuButton
                  isActive={isActive}
                  onClick={() => setActiveCadence(cadence)}
                  tooltip={`${CADENCE_LABELS[cadence]}: ${totals.completed}/${totals.total}`}
                  className="justify-between group-data-[collapsible=icon]:!size-auto group-data-[collapsible=icon]:!p-2"
                >
                  {/* Expanded view */}
                  <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                    <Icon className="h-4 w-4" />
                    <span>{CADENCE_LABELS[cadence]}</span>
                  </div>
                  {totals.total > 0 && (
                    <Badge
                      variant={isComplete ? "default" : "secondary"}
                      className="h-5 px-1.5 text-[10px] group-data-[collapsible=icon]:hidden"
                    >
                      {totals.completed}/{totals.total}
                    </Badge>
                  )}
                  
                  {/* Collapsed view - stack icon above badge */}
                  <div className="hidden group-data-[collapsible=icon]:flex flex-col items-center justify-center gap-0.5 w-full py-1">
                    <Icon className="h-5 w-5 shrink-0" />
                    {outstanding > 0 ? (
                      <Badge 
                        variant="destructive" 
                        className="h-4 min-w-4 px-1 text-[9px] font-semibold"
                      >
                        {outstanding}
                      </Badge>
                    ) : totals.total > 0 ? (
                      <Badge 
                        variant="default" 
                        className="h-4 min-w-4 px-1 text-[9px]"
                      >
                        ✓
                      </Badge>
                    ) : null}
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* Routine Checklists - Hidden when collapsed */}
        <div className="group-data-[collapsible=icon]:hidden flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-4">
              {/* Period Label & Due Date */}
              <div className="text-sm text-muted-foreground text-center flex flex-col items-center gap-1">
                <span>{getPeriodLabel(activeCadence)}</span>
                {sharedDueText && (
                  <span className={hasOverdue ? "text-destructive font-medium flex items-center gap-1" : ""}>
                    {hasOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                    {sharedDueText}
                    {hasOverdue && " (Overdue)"}
                  </span>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : hasRoutines ? (
                cadenceRoutines.map((routine) => (
                  <RoutineChecklist
                    key={routine.id}
                    routine={routine}
                    periodStart={format(getPeriodStart(activeCadence), "yyyy-MM-dd")}
                    userId={userId}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No {activeCadence} routines assigned
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SidebarContent>
    </Sidebar>
  );
};
