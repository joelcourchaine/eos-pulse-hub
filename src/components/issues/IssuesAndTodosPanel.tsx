import { useState, useEffect, useRef } from "react";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, GripVertical, Trash2, Pencil, CheckSquare, ChevronDown, ChevronUp } from "lucide-react";
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
  expandAllNotes?: boolean;
}

export function IssuesAndTodosPanel({ departmentId, userId, expandAllNotes = false }: IssuesAndTodosPanelProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [profiles, setProfiles] = useState<{ [key: string]: Profile }>({});
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);
  const [isDragOverTodos, setIsDragOverTodos] = useState(false);
  const [deleteIssueId, setDeleteIssueId] = useState<string | null>(null);
  const [deleteTodoId, setDeleteTodoId] = useState<string | null>(null);
  const [selectedIssueForTodo, setSelectedIssueForTodo] = useState<Issue | null>(null);
  const [isSelectedIssueFromDrag, setIsSelectedIssueFromDrag] = useState(false);
  const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);
  const [expandedTodoId, setExpandedTodoId] = useState<string | null>(null);
  const [editingIssueNotes, setEditingIssueNotes] = useState<{ [id: string]: string }>({});
  const [editingTodoNotes, setEditingTodoNotes] = useState<{ [id: string]: string }>({});
  const { toast } = useToast();
  const draggedIssueRef = useRef<Issue | null>(null);
  const droppedOnTodosRef = useRef(false);

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
      const { data: department, error: deptError } = await supabase
        .from("departments")
        .select("store_id")
        .eq("id", departmentId)
        .single();

      if (deptError) throw deptError;

      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];

      const { data, error } = await supabase.rpc("get_profiles_basic");

      if (error) throw error;

      const profilesMap: { [key: string]: Profile } = {};
      data?.forEach((profile: { id: string; full_name: string; store_id: string | null }) => {
        if (profile.store_id === department.store_id || superAdminIds.includes(profile.id)) {
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
        description: getUserFriendlyError(error),
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
        description: getUserFriendlyError(error),
      });
    }
  };

  const handleDragStart = (issue: Issue) => {
    draggedIssueRef.current = issue;
    setDraggedIssue(issue);
  };

  const handleDragOver = (e: React.DragEvent, targetIssue: Issue) => {
    e.preventDefault();
    const current = draggedIssueRef.current;
    if (!current || current.id === targetIssue.id) return;

    const newIssues = [...issues];
    const draggedIndex = newIssues.findIndex(i => i.id === current.id);
    const targetIndex = newIssues.findIndex(i => i.id === targetIssue.id);

    newIssues.splice(draggedIndex, 1);
    newIssues.splice(targetIndex, 0, current);

    const updatedIssues = newIssues.map((issue, index) => ({
      ...issue,
      display_order: index,
    }));

    setIssues(updatedIssues);
  };

  const handleDragEnd = async () => {
    // If dropped on the To-Dos panel, that handler already took care of everything
    if (droppedOnTodosRef.current) {
      droppedOnTodosRef.current = false;
      draggedIssueRef.current = null;
      setDraggedIssue(null);
      return;
    }

    if (!draggedIssueRef.current) return;

    try {
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

      toast({ title: "Success", description: "Issue order updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
      loadIssues();
    } finally {
      draggedIssueRef.current = null;
      setDraggedIssue(null);
    }
  };

  const handleDeleteIssue = async () => {
    if (!deleteIssueId) return;

    try {
      const { error } = await supabase.from("issues").delete().eq("id", deleteIssueId);
      if (error) throw error;
      toast({ title: "Success", description: "Issue deleted" });
      setDeleteIssueId(null);
      loadIssues();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
    }
  };

  const handleDeleteTodo = async () => {
    if (!deleteTodoId) return;

    try {
      const { error } = await supabase.from("todos").delete().eq("id", deleteTodoId);
      if (error) throw error;
      toast({ title: "Success", description: "To-Do deleted" });
      setDeleteTodoId(null);
      loadTodos();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
    }
  };

  const handleToggleTodoStatus = async (todoId: string, currentStatus: string) => {
    const newStatus = currentStatus === "pending" ? "completed" : "pending";

    try {
      const { error } = await supabase.from("todos").update({ status: newStatus }).eq("id", todoId);
      if (error) throw error;
      toast({ title: "Success", description: `To-Do marked as ${newStatus}` });
      loadTodos();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
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

  const issueHasLinkedTodo = (issueId: string) => {
    return todos.some(todo => todo.issue_id === issueId);
  };

  const getSeverityBorderColor = (severity: string, isInMotion: boolean = false) => {
    if (isInMotion) return "border-muted-foreground/30 bg-muted/50";
    switch (severity) {
      case "low": return "border-emerald-300 dark:border-emerald-700 bg-emerald-100 dark:bg-emerald-900/40";
      case "high": return "border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/40";
      case "executive": return "border-purple-400 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40";
      default: return "border-amber-300 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40";
    }
  };

  const getSeverityDotColor = (severity: string) => {
    switch (severity) {
      case "low": return "bg-emerald-500";
      case "high": return "bg-red-500";
      case "executive": return "bg-purple-600";
      default: return "bg-amber-500";
    }
  };

  const handleUpdateIssueSeverity = async (issueId: string, newSeverity: string) => {
    try {
      const { error } = await supabase.from("issues").update({ severity: newSeverity }).eq("id", issueId);
      if (error) throw error;
      loadIssues();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
    }
  };

  const handleUpdateTodoSeverity = async (todoId: string, newSeverity: string) => {
    try {
      const { error } = await supabase.from("todos").update({ severity: newSeverity }).eq("id", todoId);
      if (error) throw error;
      loadTodos();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
    }
  };

  const saveIssueNotes = async (issueId: string, notes: string) => {
    const issue = issues.find(i => i.id === issueId);
    const original = issue?.description ?? "";
    if (notes === original) return;
    try {
      const { error } = await supabase.from("issues").update({ description: notes || null }).eq("id", issueId);
      if (error) throw error;
      loadIssues();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
    }
  };

  const saveTodoNotes = async (todoId: string, notes: string) => {
    const todo = todos.find(t => t.id === todoId);
    const original = todo?.description ?? "";
    if (notes === original) return;
    try {
      const { error } = await supabase.from("todos").update({ description: notes || null }).eq("id", todoId);
      if (error) throw error;
      loadTodos();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: getUserFriendlyError(error) });
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
                    Drag to reorder · Drop onto To-Dos to link
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IssueManagementDialog
                    departmentId={departmentId}
                    onIssueAdded={loadIssues}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 80px)" }}>
              {issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No issues yet</p>
                </div>
              ) : (
                issues.map((issue) => {
                  const isInMotion = issueHasLinkedTodo(issue.id);
                  const isExpanded = expandAllNotes || expandedIssueId === issue.id;
                  return (
                    <div
                      key={issue.id}
                      draggable
                      onDragStart={() => handleDragStart(issue)}
                      onDragOver={(e) => handleDragOver(e, issue)}
                      onDragEnd={handleDragEnd}
                      className="cursor-move"
                    >
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div
                            className={`flex items-start gap-2 p-3 rounded-lg border-2 transition-colors ${getSeverityBorderColor(issue.severity, isInMotion)}`}
                          >
                            <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div
                                className="flex items-center gap-1 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedIssueId(expandedIssueId === issue.id ? null : issue.id);
                                }}
                              >
                                <h4 className="font-medium flex-1">{issue.title}</h4>
                                {(issue.description || expandAllNotes) && (
                                  isExpanded
                                    ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>
                              {isExpanded && (
                                <Textarea
                                  value={editingIssueNotes[issue.id] ?? issue.description ?? ""}
                                  placeholder="Add notes..."
                                  rows={2}
                                  className="mt-1 text-sm resize-none"
                                  onChange={(e) => setEditingIssueNotes(prev => ({ ...prev, [issue.id]: e.target.value }))}
                                  onBlur={(e) => saveIssueNotes(issue.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={isInMotion ? "secondary" : issue.status === "open" ? "default" : "secondary"}>
                                  {isInMotion ? "in progress" : issue.status}
                                </Badge>
                                <Select value={issue.severity} onValueChange={(value) => handleUpdateIssueSeverity(issue.id, value)}>
                                  <SelectTrigger className="h-6 w-[6.5rem] text-xs capitalize">
                                    <span className={`h-2 w-2 rounded-full mr-1 ${getSeverityDotColor(issue.severity)}`} />
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="low">
                                      <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                        Low
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="medium">
                                      <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        Medium
                                      </span>
                                    </SelectItem>
                                   <SelectItem value="high">
                                      <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-red-500" />
                                        High
                                      </span>
                                    </SelectItem>
                                    <SelectItem value="executive">
                                      <span className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-purple-600" />
                                        Executive
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
                          <ContextMenuItem onClick={() => {
                            setSelectedIssueForTodo(issue);
                            setIsSelectedIssueFromDrag(false);
                          }}>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Create To-Do from Issue
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* To-Dos Panel */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <Card className={`h-full border-0 rounded-none transition-all ${isDragOverTodos && draggedIssue ? "ring-2 ring-inset ring-primary bg-primary/5" : ""}`}>
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
                <div className="flex items-center gap-2">
                  <TodoManagementDialog
                    departmentId={departmentId}
                    profiles={profilesList}
                    onTodoAdded={loadTodos}
                    onDialogOpen={loadProfiles}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100% - 80px)" }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOverTodos(true);
              }}
              onDragLeave={() => setIsDragOverTodos(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const issue = draggedIssueRef.current;
                droppedOnTodosRef.current = true;
                setIsDragOverTodos(false);
                if (issue) {
                  setIsSelectedIssueFromDrag(true);
                  setSelectedIssueForTodo(issue);
                  setDraggedIssue(null);
                }
              }}
            >
              {isDragOverTodos && draggedIssue ? (
                <div className="text-center py-8 text-primary">
                  <CheckSquare className="h-12 w-12 mx-auto mb-2" />
                  <p className="font-medium">Drop to link issue as a to-do</p>
                </div>
              ) : todos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No to-dos yet</p>
                </div>
              ) : (
                todos.map((todo) => {
                  const isTodoExpanded = expandAllNotes || expandedTodoId === todo.id;
                  return (
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
                        <div
                          className="flex items-center gap-1 cursor-pointer"
                          onClick={() => setExpandedTodoId(expandedTodoId === todo.id ? null : todo.id)}
                        >
                          <h4 className={`font-medium flex-1 ${todo.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {todo.title}
                          </h4>
                          {(todo.description || expandAllNotes) && (
                            isTodoExpanded
                              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>
                        {isTodoExpanded && (
                          <Textarea
                            value={editingTodoNotes[todo.id] ?? todo.description ?? ""}
                            placeholder="Add notes..."
                            rows={2}
                            className="mt-1 text-sm resize-none"
                            onChange={(e) => setEditingTodoNotes(prev => ({ ...prev, [todo.id]: e.target.value }))}
                            onBlur={(e) => saveTodoNotes(todo.id, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {todo.issue_id && (
                            <Badge variant="outline" className="h-5 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {getIssueTitle(todo.issue_id)}
                            </Badge>
                          )}
                          <Select value={todo.severity} onValueChange={(value) => handleUpdateTodoSeverity(todo.id, value)}>
                            <SelectTrigger className="h-5 w-[6.5rem] text-xs capitalize">
                              <span className={`h-2 w-2 rounded-full mr-1 ${getSeverityDotColor(todo.severity)}`} />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                  Low
                                </span>
                              </SelectItem>
                              <SelectItem value="medium">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                                  Medium
                                </span>
                              </SelectItem>
                              <SelectItem value="high">
                                <span className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-red-500" />
                                  High
                                </span>
                              </SelectItem>
                            </SelectContent>
                          </Select>
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
                  );
                })
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
          initialDescription={selectedIssueForTodo.description || ""}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedIssueForTodo(null);
              setIsSelectedIssueFromDrag(false);
            }
          }}
          onIssueLinked={isSelectedIssueFromDrag ? async () => {
            const issueId = selectedIssueForTodo.id;
            await supabase.from("issues").delete().eq("id", issueId);
            loadIssues();
          } : undefined}
        />
      )}
    </>
  );
}
