import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Trash2, Calendar, User, Loader2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TodoManagementDialog } from "./TodoManagementDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

interface Profile {
  id: string;
  full_name: string;
}

interface TodosPanelProps {
  departmentId?: string;
  userId?: string;
}

export function TodosPanel({ departmentId, userId }: TodosPanelProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [loading, setLoading] = useState(true);
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (departmentId) {
      loadTodos();
      loadProfiles();
    }
  }, [departmentId]);

  // Real-time subscription
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel('todos-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `department_id=eq.${departmentId}`
        },
        () => {
          loadTodos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  const loadProfiles = async () => {
    if (!departmentId) return;
    
    try {
      // Use the security definer function to get basic profile data
      const { data, error } = await supabase.rpc("get_profiles_basic");

      if (error) throw error;

      const profilesMap: { [key: string]: Profile } = {};
      data?.forEach((profile: { id: string; full_name: string }) => {
        profilesMap[profile.id] = { id: profile.id, full_name: profile.full_name };
      });
      setProfiles(profilesMap);
    } catch (error: any) {
      console.error("Error loading profiles:", error);
    }
  };

  const loadTodos = async () => {
    if (!departmentId) return;

    setLoading(true);
    // Clear existing data to prevent stale data from showing
    setTodos([]);
    
    try {
      const { data, error } = await supabase
        .from("todos")
        .select("*")
        .eq("department_id", departmentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load to-dos",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "pending" ? "completed" : "pending";
    
    try {
      const { error } = await supabase
        .from("todos")
        .update({ status: newStatus })
        .eq("id", todoId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `To-Do marked as ${newStatus}`,
      });
      loadTodos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTodoId) return;

    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", deleteTodoId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "To-Do deleted",
      });
      setDeleteTodoId(null);
      loadTodos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const getAssignedName = (assignedId: string | null) => {
    if (!assignedId) return "Unassigned";
    return profiles[assignedId]?.full_name || "Unknown";
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case "low": return "border-success/50 bg-success/10";
      case "high": return "border-destructive/50 bg-destructive/10";
      default: return "border-warning/50 bg-warning/10";
    }
  };

  const getSeverityDotColor = (severity: string) => {
    switch (severity) {
      case "low": return "bg-success";
      case "high": return "bg-destructive";
      default: return "bg-warning";
    }
  };

  const handleUpdateTodoSeverity = async (todoId: string, newSeverity: string) => {
    try {
      const { error } = await supabase
        .from("todos")
        .update({ severity: newSeverity })
        .eq("id", todoId);

      if (error) throw error;
      loadTodos();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const myTodos = todos.filter(t => t.assigned_to === userId);
  const teamTodos = todos;
  const createdByMe = todos.filter(t => t.created_by === userId);

  const renderTodoList = (todoList: Todo[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (todoList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No to-dos yet</p>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {todoList.map((todo) => (
          <div
            key={todo.id}
            className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${getSeverityBorderColor(todo.severity)}`}
          >
            <Checkbox
              checked={todo.status === "completed"}
              onCheckedChange={() => handleToggleStatus(todo.id, todo.status)}
              className="mt-1"
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-medium ${todo.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                  {todo.title}
                </h4>
                {todo.status === "completed" && (
                  <Badge variant="default" className="text-xs">Completed</Badge>
                )}
              </div>
              
              {todo.description && (
                <p className="text-sm text-muted-foreground mb-2">{todo.description}</p>
              )}
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <Select value={todo.severity} onValueChange={(value) => handleUpdateTodoSeverity(todo.id, value)}>
                  <SelectTrigger className="h-6 w-24 text-xs capitalize">
                    <span className={`h-2 w-2 rounded-full mr-1 ${getSeverityDotColor(todo.severity)}`} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-success" />
                        Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-warning" />
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-destructive" />
                        High
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{getAssignedName(todo.assigned_to)}</span>
                </div>
                {todo.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>Due: {format(new Date(todo.due_date), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-1">
              <TodoManagementDialog
                departmentId={departmentId}
                profiles={profilesList}
                onTodoAdded={loadTodos}
                onDialogOpen={loadProfiles}
                todo={todo}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTodoId(todo.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!departmentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>To-Dos</CardTitle>
          <CardDescription>Select a department to view to-dos</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const profilesList = Object.values(profiles);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <CheckSquare className="h-6 w-6" />
                To-Dos
              </CardTitle>
              <CardDescription>
                Track and manage team tasks with full transparency
              </CardDescription>
            </div>
            <TodoManagementDialog
              departmentId={departmentId}
              profiles={profilesList}
              onTodoAdded={loadTodos}
              onDialogOpen={loadProfiles}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my">
                My To-Dos ({myTodos.filter(t => t.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="team">
                Team To-Dos ({teamTodos.filter(t => t.status === "pending").length})
              </TabsTrigger>
              <TabsTrigger value="created">
                Created by Me ({createdByMe.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="my" className="mt-4">
              {renderTodoList(myTodos)}
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              {renderTodoList(teamTodos)}
            </TabsContent>

            <TabsContent value="created" className="mt-4">
              {renderTodoList(createdByMe)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTodoId} onOpenChange={() => setDeleteTodoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete To-Do</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this to-do? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
