import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, CheckSquare, ArrowRight, Loader2, MapPin, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  department_id: string;
  department_name?: string;
  store_name?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface MyTasksViewProps {
  userId: string;
  onViewFullDashboard: () => void;
}

export function MyTasksView({ userId, onViewFullDashboard }: MyTasksViewProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (userId) {
      loadMyTasks();
      loadProfiles();
    }
  }, [userId]);

  // Real-time subscription for user's tasks across all departments
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('my-tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos'
        },
        () => {
          loadMyTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (error: any) {
      console.error("Error loading profiles:", error);
    }
  };

  const loadMyTasks = async () => {
    setLoading(true);
    
    try {
      // Fetch all pending todos assigned to the current user across all departments
      const { data, error } = await supabase
        .from("todos")
        .select(`
          *,
          departments!inner(
            name,
            stores!inner(name)
          )
        `)
        .eq("assigned_to", userId)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Map the data to include department and store names
      const mappedTodos = (data || []).map(todo => ({
        ...todo,
        department_name: todo.departments?.name,
        store_name: todo.departments?.stores?.name,
      }));

      setTodos(mappedTodos);
    } catch (error: any) {
      console.error("Error loading tasks:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load your tasks",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (todoId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: "completed" })
        .eq("id", todoId);

      if (error) throw error;

      toast({
        title: "Task completed!",
        description: "Great work!",
      });
      
      // Remove from local state immediately for snappy UX
      setTodos(prev => prev.filter(t => t.id !== todoId));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleUpdateOwner = async (todoId: string, newOwnerId: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ assigned_to: newOwnerId })
        .eq("id", todoId);

      if (error) throw error;

      toast({
        title: "Owner updated",
        description: "Task has been reassigned",
      });
      
      // If reassigned to someone else, remove from this list
      if (newOwnerId !== userId) {
        setTodos(prev => prev.filter(t => t.id !== todoId));
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleUpdateDueDate = async (todoId: string, newDate: Date | undefined) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ due_date: newDate ? format(newDate, "yyyy-MM-dd") : null })
        .eq("id", todoId);

      if (error) throw error;

      toast({
        title: "Due date updated",
      });
      
      loadMyTasks();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "low": return "border-l-success bg-success/5";
      case "high": return "border-l-destructive bg-destructive/5";
      default: return "border-l-warning bg-warning/5";
    }
  };

  const getDueDateStyles = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "text-destructive font-medium";
    if (isToday(date)) return "text-warning font-medium";
    return "text-muted-foreground";
  };

  const getDueDateLabel = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) return "Overdue";
    if (isToday(date)) return "Due Today";
    return format(date, "MMM d");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const overdueTasks = todos.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
  const todayTasks = todos.filter(t => t.due_date && isToday(new Date(t.due_date)));
  const upcomingTasks = todos.filter(t => !t.due_date || (!isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))));

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">My Tasks</h1>
              <p className="text-sm text-muted-foreground">
                {todos.length} pending {todos.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
            <Button onClick={onViewFullDashboard} variant="outline" size="sm">
              Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        {todos.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-success opacity-80" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground mb-4">
                  You have no pending tasks assigned to you.
                </p>
                <Button onClick={onViewFullDashboard} variant="default">
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <h2 className="font-semibold">Overdue ({overdueTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {overdueTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo}
                      profiles={profiles}
                      userId={userId}
                      onComplete={handleToggleComplete}
                      onUpdateOwner={handleUpdateOwner}
                      onUpdateDueDate={handleUpdateDueDate}
                      getSeverityStyles={getSeverityStyles}
                      getDueDateStyles={getDueDateStyles}
                      getDueDateLabel={getDueDateLabel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Today's Tasks */}
            {todayTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-warning">
                  <CalendarIcon className="h-4 w-4" />
                  <h2 className="font-semibold">Due Today ({todayTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {todayTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo}
                      profiles={profiles}
                      userId={userId}
                      onComplete={handleToggleComplete}
                      onUpdateOwner={handleUpdateOwner}
                      onUpdateDueDate={handleUpdateDueDate}
                      getSeverityStyles={getSeverityStyles}
                      getDueDateStyles={getDueDateStyles}
                      getDueDateLabel={getDueDateLabel}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Tasks */}
            {upcomingTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 text-foreground">
                  <CheckSquare className="h-4 w-4" />
                  <h2 className="font-semibold">Upcoming ({upcomingTasks.length})</h2>
                </div>
                <div className="space-y-2">
                  {upcomingTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo}
                      profiles={profiles}
                      userId={userId}
                      onComplete={handleToggleComplete}
                      onUpdateOwner={handleUpdateOwner}
                      onUpdateDueDate={handleUpdateDueDate}
                      getSeverityStyles={getSeverityStyles}
                      getDueDateStyles={getDueDateStyles}
                      getDueDateLabel={getDueDateLabel}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface TaskCardProps {
  todo: Todo;
  profiles: Profile[];
  userId: string;
  onComplete: (id: string) => void;
  onUpdateOwner: (id: string, newOwnerId: string) => void;
  onUpdateDueDate: (id: string, newDate: Date | undefined) => void;
  getSeverityStyles: (severity: string) => string;
  getDueDateStyles: (dueDate: string | null) => string;
  getDueDateLabel: (dueDate: string | null) => string | null;
}

function TaskCard({ todo, profiles, userId, onComplete, onUpdateOwner, onUpdateDueDate, getSeverityStyles, getDueDateStyles, getDueDateLabel }: TaskCardProps) {
  const dueLabel = getDueDateLabel(todo.due_date);
  const currentOwner = profiles.find(p => p.id === todo.assigned_to);
  
  return (
    <Card className={`border-l-4 ${getSeverityStyles(todo.severity)}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={false}
            onCheckedChange={() => onComplete(todo.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-foreground leading-tight mb-1">
              {todo.title}
            </h3>
            {todo.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {todo.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{todo.store_name} • {todo.department_name}</span>
              </div>
            </div>
            
            {/* Editable fields */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Owner Select */}
              <div className="flex items-center gap-1">
                <User className="h-3 w-3 text-muted-foreground" />
                <Select
                  value={todo.assigned_to || ""}
                  onValueChange={(value) => onUpdateOwner(todo.id, value)}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue placeholder="Assign to...">
                      {currentOwner?.full_name || "Unassigned"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date Picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs justify-start px-2",
                      getDueDateStyles(todo.due_date)
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dueLabel || "Set date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={todo.due_date ? new Date(todo.due_date) : undefined}
                    onSelect={(date) => onUpdateDueDate(todo.id, date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
