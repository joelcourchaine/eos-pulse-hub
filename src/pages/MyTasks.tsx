import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Calendar, ArrowLeft, Loader2, MapPin, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday } from "date-fns";
import goLogo from "@/assets/go-logo.png";

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

const MyTasks = () => {
  const navigate = useNavigate();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      loadMyTasks();
    }
  }, [userId]);

  // Real-time subscription for user's tasks across all departments
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('my-tasks-page-realtime')
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

  const loadMyTasks = async () => {
    if (!userId) return;
    setLoading(true);
    
    try {
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
      
      setTodos(prev => prev.filter(t => t.id !== todoId));
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
    return format(date, "MMM d, yyyy");
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
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={goLogo} alt="GO Logo" className="h-10 w-10 rounded-lg" />
              <div>
                <h1 className="text-xl font-bold text-foreground">My Tasks</h1>
                <p className="text-sm text-muted-foreground">
                  {todos.length} pending {todos.length === 1 ? 'task' : 'tasks'} across all stores
                </p>
              </div>
            </div>
            <Button onClick={() => navigate("/dashboard")} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {todos.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <CheckCircle2 className="h-20 w-20 mx-auto mb-4 text-success opacity-80" />
                <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground mb-6">
                  You have no pending tasks assigned to you.
                </p>
                <Button onClick={() => navigate("/dashboard")} variant="default">
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
                <div className="flex items-center gap-2 mb-3 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Overdue ({overdueTasks.length})</h2>
                </div>
                <div className="space-y-3">
                  {overdueTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      onComplete={handleToggleComplete}
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
                <div className="flex items-center gap-2 mb-3 text-warning">
                  <Calendar className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Due Today ({todayTasks.length})</h2>
                </div>
                <div className="space-y-3">
                  {todayTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      onComplete={handleToggleComplete}
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
                <div className="flex items-center gap-2 mb-3 text-foreground">
                  <CheckSquare className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Upcoming ({upcomingTasks.length})</h2>
                </div>
                <div className="space-y-3">
                  {upcomingTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      onComplete={handleToggleComplete}
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
};

interface TaskCardProps {
  todo: Todo;
  onComplete: (id: string) => void;
  getSeverityStyles: (severity: string) => string;
  getDueDateStyles: (dueDate: string | null) => string;
  getDueDateLabel: (dueDate: string | null) => string | null;
}

function TaskCard({ todo, onComplete, getSeverityStyles, getDueDateStyles, getDueDateLabel }: TaskCardProps) {
  const dueLabel = getDueDateLabel(todo.due_date);
  
  return (
    <Card className={`border-l-4 ${getSeverityStyles(todo.severity)}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
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
              <p className="text-sm text-muted-foreground mb-2">
                {todo.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{todo.store_name} • {todo.department_name}</span>
              </div>
              {dueLabel && (
                <Badge 
                  variant="outline" 
                  className={`${getDueDateStyles(todo.due_date)} border-current`}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {dueLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MyTasks;
