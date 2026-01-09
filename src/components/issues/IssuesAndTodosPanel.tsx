import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Plus, GripVertical, Trash2, Pencil, CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { IssueManagementDialog } from "./IssueManagementDialog";
import { TodoManagementDialog } from "../todos/TodoManagementDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  display_order: number;
  department_id: string;
  created_by: string | null;
  created_at: string;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string | null;
  issue_id: string | null;
  department_id: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface IssuesAndTodosPanelProps {
  departmentId: string;
  userId?: string;
}

export function IssuesAndTodosPanel({ departmentId, userId }: IssuesAndTodosPanelProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);
  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);
  const [selectedIssueForTodo, setSelectedIssueForTodo] = useState<Issue | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (departmentId) {
      loadIssues();
      loadTodos();
      loadProfiles();
    }
  }, [departmentId]);

  // Subscribe to realtime changes for issues
  useEffect(() => {
    if (!departmentId) return;

    const channel = supabase
      .channel(`issues-${departmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'issues',
          filter: `department_id=eq.${departmentId}`
        },
        () => {
          loadIssues();
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
      // First get the store_id for this department
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("store_id")
        .eq("id", departmentId)
        .single();

      if (deptError) throw deptError;
      
      // Use security definer function to get basic profile data, then filter by store
      const { data, error } = await supabase.rpc("get_profiles_basic");

      if (error) throw error;

      const profilesMap: { [key: string]: Profile } = {};
      data?.forEach((profile: { id: string; full_name: string; store_id: string | null }) => {
        // Only include profiles that belong to this store
        if (profile.store_id === department.store_id) {
          profilesMap[profile.id] = { id: profile.id, full_name: profile.full_name };
        }
      });
      setProfiles(profilesMap);
    } catch (error: any) {
      console.error("Error loading profiles:", error);
    }
  };

  const loadIssues = async () => {
    if (!departmentId) return;
    
    try {
      const { data, error } = await supabase
        .from("issues")
        .select("*")
        .eq("department_id", departmentId);

      if (error) throw error;
      
      // Sort by severity: high first, then medium, then low
      const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const sorted = (data || []).sort((a, b) => {
        const orderA = severityOrder[a.severity] ?? 1;
        const orderB = severityOrder[b.severity] ?? 1;
        return orderA - orderB;
      });
      
      setIssues(sorted);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error loading issues",
        description: error.message,
      });
    }
  };

  const loadTodos = async () => {
    if (!departmentId) return;
    
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
        title: "Error loading to-dos",
        description: error.message,
      });
    }
  };

  const handleDragStart = (issue: Issue) => {
    setDraggedIssue(issue);
  };

  const handleDragOver = (e: React.DragEvent, targetIssue: Issue) => {
    e.preventDefault();
    if (!draggedIssue || draggedIssue.id === targetIssue.id) return;

    const newIssues = [...issues];
    const draggedIndex = newIssues.findIndex(i => i.id === draggedIssue.id);
    const targetIndex = newIssues.findIndex(i => i.id === targetIssue.id);

    newIssues.splice(draggedIndex, 1);
    newIssues.splice(targetIndex, 0, draggedIssue);

    // Update display_order for all issues
    const updatedIssues = newIssues.map((issue, index) => ({
      ...issue,
      display_order: index,
    }));

    setIssues(updatedIssues);
  };

  const handleDragEnd = async () => {
    if (!draggedIssue) return;

    try {
      // Update all issue orders in the database
      const updates = issues.map((issue) => ({
        id: issue.id,
        display_order: issue.display_order,
      }));

      for (const update of updates) {
        await supabase
          .from("issues")
          .update({ display_order: update.display_order })
          .eq("id", update.id);
      }

      toast({
        title: "Success",
        description: "Issue order updated",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
      loadIssues(); // Reload to reset order
    } finally {
      setDraggedIssue(null);
    }
  };

  const handleDeleteIssue = async () => {
    if (!deleteIssueId) return;

    try {
      const { error } = await supabase
        .from("issues")
        .delete()
        .eq("id", deleteIssueId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Issue deleted",
      });
      setDeleteIssueId(null);
      loadIssues();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDeleteTodo = async () => {
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

  const handleToggleTodoStatus = async (todoId: string, currentStatus: string) => {
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

  const getAssignedName = (assignedId: string | null) => {
    if (!assignedId) return "Unassigned";
    return profiles[assignedId]?.full_name || "Unknown";
  };

  const getIssueTitle = (issueId: string | null) => {
    if (!issueId) return null;
    return issues.find(i => i.id === issueId)?.title;
  };

  const getIssueSeverity = (issueId: string | null) => {
    if (!issueId) return null;
    return issues.find(i => i.id === issueId)?.severity;
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

  const handleUpdateIssueSeverity = async (issueId: string, newSeverity: string) => {
    try {
      const { error } = await supabase
        .from("issues")
        .update({ severity: newSeverity })
        .eq("id", issueId);

      if (error) throw error;
      loadIssues();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
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

  const profilesList = Object.values(profiles);

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="min-h-[600px] rounded-lg border">
        {/* Issues Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <Card className="h-full border-0 rounded-none">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Issues List
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Drag to reorder by importance
                  </p>
                </div>
                <IssueManagementDialog
                  departmentId={departmentId}
                  onIssueAdded={loadIssues}
                />
              </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 80px)" }}>
              {issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No issues yet</p>
                </div>
              ) : (
                issues.map((issue) => (
                  <ContextMenu key={issue.id}>
                    <ContextMenuTrigger>
                      <div
                        draggable
                        onDragStart={() => handleDragStart(issue)}
                        onDragOver={(e) => handleDragOver(e, issue)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-colors cursor-move ${getSeverityBorderColor(issue.severity)}`}
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium">{issue.title}</h4>
                          {issue.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {issue.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant={issue.status === "open" ? "default" : "secondary"}>
                              {issue.status}
                            </Badge>
                            <Select value={issue.severity} onValueChange={(value) => handleUpdateIssueSeverity(issue.id, value)}>
                              <SelectTrigger className="h-6 w-[5.5rem] text-xs capitalize">
                                <span className={`h-2 w-2 rounded-full mr-1 ${getSeverityDotColor(issue.severity)}`} />
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
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <IssueManagementDialog
                            departmentId={departmentId}
                            onIssueAdded={loadIssues}
                            issue={issue}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteIssueId(issue.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => setSelectedIssueForTodo(issue)}>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Create To-Do from Issue
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              )}
            </div>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* To-Dos Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <Card className="h-full border-0 rounded-none">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    To-Dos
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Action items and tasks
                  </p>
                </div>
                <TodoManagementDialog
                  departmentId={departmentId}
                  profiles={profilesList}
                  onTodoAdded={loadTodos}
                  onDialogOpen={loadProfiles}
                />
              </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 80px)" }}>
              {todos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No to-dos yet</p>
                </div>
              ) : (
                todos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-colors ${getSeverityBorderColor(todo.severity)}`}
                  >
                    <Checkbox
                      checked={todo.status === "completed"}
                      onCheckedChange={() => handleToggleTodoStatus(todo.id, todo.status)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium ${todo.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {todo.title}
                      </h4>
                      {todo.description && (
                        <p className="text-sm text-muted-foreground mt-1">{todo.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {todo.issue_id && (
                          <Badge variant="outline">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {getIssueTitle(todo.issue_id)}
                          </Badge>
                        )}
                        <Select value={todo.severity} onValueChange={(value) => handleUpdateTodoSeverity(todo.id, value)}>
                          <SelectTrigger className="h-6 w-[5.5rem] text-xs capitalize">
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
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{getAssignedName(todo.assigned_to)}</span>
                        {todo.due_date && (
                          <span>Due: {format(new Date(todo.due_date), "MMM d")}</span>
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
                          <Button variant="ghost" size="sm">
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
                ))
              )}
            </div>
          </Card>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Alert Dialogs */}
      <AlertDialog open={!!deleteIssueId} onOpenChange={() => setDeleteIssueId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Issue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will not delete linked to-dos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteIssue} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTodoId} onOpenChange={() => setDeleteTodoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete To-Do</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTodo} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create To-Do from Issue Dialog */}
      {selectedIssueForTodo && (
        <TodoManagementDialog
          departmentId={departmentId}
          profiles={profilesList}
          onTodoAdded={() => {
            loadTodos();
            setSelectedIssueForTodo(null);
          }}
          onDialogOpen={loadProfiles}
          linkedIssueId={selectedIssueForTodo.id}
          linkedIssueTitle={selectedIssueForTodo.title}
          linkedIssueSeverity={selectedIssueForTodo.severity}
          open={true}
          onOpenChange={(open) => {
            if (!open) setSelectedIssueForTodo(null);
          }}
        />
      )}
    </>
  );
}
