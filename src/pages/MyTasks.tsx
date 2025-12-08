import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, CheckSquare, ArrowLeft, ArrowRight, Loader2, MapPin, AlertTriangle, CheckCircle2, User, Plus, Repeat, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, isPast, isToday } from "date-fns";
import goLogo from "@/assets/go-logo.png";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateTaskDialog } from "@/components/todos/CreateTaskDialog";

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
  department_id: string | null;
  department_name?: string;
  store_name?: string;
  store_id?: string | null;
  is_recurring?: boolean;
  recurrence_interval?: number | null;
  recurrence_unit?: string | null;
  assigned_to_name?: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Store {
  id: string;
  name: string;
}

const MyTasks = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [departmentProfiles, setDepartmentProfiles] = useState<Record<string, Profile[]>>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isStoreGM, setIsStoreGM] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>("my_tasks");
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);
      
      // Check user roles
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      
      const userRoles = roles?.map(r => r.role) || [];
      setIsSuperAdmin(userRoles.includes("super_admin"));
      setIsStoreGM(userRoles.includes("store_gm"));
      
      // If super admin or store GM, load stores for filtering
      if (userRoles.includes("super_admin") || userRoles.includes("store_gm")) {
        loadStores();
      }
    };
    checkAuth();
  }, [navigate]);

  const loadStores = async () => {
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      setStores(data || []);
    } catch (error) {
      console.error("Error loading stores:", error);
    }
  };

  useEffect(() => {
    if (userId) {
      loadTasks();
    }
  }, [userId, selectedStoreFilter]);

  // Real-time subscription for tasks
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
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, selectedStoreFilter]);

  const loadProfilesForDepartments = async (departmentIds: string[], includeGroupLevel: boolean = false) => {
    try {
      const uniqueDeptIds = [...new Set(departmentIds)];
      const profilesMap: Record<string, Profile[]> = {};
      
      // Fetch super admins (they should be available in all departments)
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      
      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];
      
      let superAdminProfiles: Profile[] = [];
      if (superAdminIds.length > 0) {
        const { data: superAdmins } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", superAdminIds);
        superAdminProfiles = superAdmins || [];
      }
      
      // For group-level tasks, only super admins can be assigned
      if (includeGroupLevel) {
        profilesMap['__group__'] = superAdminProfiles.sort((a, b) => a.full_name.localeCompare(b.full_name));
      }
      
      // For each department, fetch profiles that have access
      for (const deptId of uniqueDeptIds) {
        // Get the store_id for this department
        const { data: dept } = await supabase
          .from("departments")
          .select("store_id, stores!inner(group_id)")
          .eq("id", deptId)
          .single();
        
        if (!dept) continue;
        
        const storeGroupId = (dept.stores as any)?.group_id;
        
        // Get store GMs for this store's group
        const { data: storeGmRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "store_gm");
        
        const storeGmIds = storeGmRoles?.map(r => r.user_id) || [];
        
        let storeGmProfiles: Profile[] = [];
        if (storeGmIds.length > 0 && storeGroupId) {
          // Get store GM profiles that belong to the same store group
          const { data: gmProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", storeGmIds)
            .eq("store_group_id", storeGroupId);
          storeGmProfiles = gmProfiles || [];
        }
        
        // Get profiles belonging to this store
        const { data: storeProfiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("store_id", dept.store_id);
        
        // Get profiles with explicit department access
        const { data: deptAccess } = await supabase
          .from("user_department_access")
          .select("user_id")
          .eq("department_id", deptId);
        
        const deptAccessUserIds = deptAccess?.map(a => a.user_id) || [];
        
        let deptAccessProfiles: Profile[] = [];
        if (deptAccessUserIds.length > 0) {
          const { data: accessProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", deptAccessUserIds);
          deptAccessProfiles = accessProfiles || [];
        }
        
        // Combine all profiles (store profiles + dept access + store GMs + super admins), removing duplicates
        const allProfiles = [...(storeProfiles || []), ...deptAccessProfiles, ...storeGmProfiles, ...superAdminProfiles];
        const uniqueProfiles = allProfiles.filter((p, i, arr) => 
          arr.findIndex(x => x.id === p.id) === i
        );
        
        profilesMap[deptId] = uniqueProfiles.sort((a, b) => a.full_name.localeCompare(b.full_name));
      }
      
      setDepartmentProfiles(profilesMap);
    } catch (error: any) {
      console.error("Error loading department profiles:", error);
    }
  };

  const loadTasks = async () => {
    if (!userId) return;
    setLoading(true);
    
    try {
      let query = supabase
        .from("todos")
        .select(`
          *,
          departments(
            id,
            name,
            store_id,
            stores(id, name)
          ),
          profiles!todos_assigned_to_fkey(full_name)
        `)
        .eq("status", "pending")
        .order("due_date", { ascending: true, nullsFirst: false });

      // Apply filters based on selection
      if (selectedStoreFilter === "my_tasks") {
        query = query.eq("assigned_to", userId);
      } else if (selectedStoreFilter === "group_level") {
        query = query.is("department_id", null);
      } else if (selectedStoreFilter !== "all") {
        // Filter by specific store
        // We need to get department IDs for this store first
        const { data: storeDepts } = await supabase
          .from("departments")
          .select("id")
          .eq("store_id", selectedStoreFilter);
        
        const deptIds = storeDepts?.map(d => d.id) || [];
        if (deptIds.length > 0) {
          query = query.in("department_id", deptIds);
        } else {
          // No departments in this store
          setTodos([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const mappedTodos = (data || []).map(todo => ({
        ...todo,
        department_name: todo.departments?.name || null,
        store_name: todo.departments?.stores?.name || null,
        store_id: todo.departments?.store_id || null,
        assigned_to_name: todo.profiles?.full_name || null,
      }));

      setTodos(mappedTodos);
      
      // Load profiles for all departments that have tasks
      const deptIds = mappedTodos.filter(t => t.department_id).map(t => t.department_id as string);
      const hasGroupLevelTasks = mappedTodos.some(t => !t.department_id);
      
      if (deptIds.length > 0 || hasGroupLevelTasks) {
        loadProfilesForDepartments(deptIds, hasGroupLevelTasks);
      }
    } catch (error: any) {
      console.error("Error loading tasks:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load tasks",
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
      
      // If viewing "my tasks" and reassigned to someone else, remove from list
      if (selectedStoreFilter === "my_tasks" && newOwnerId !== userId) {
        setTodos(prev => prev.filter(t => t.id !== todoId));
      } else {
        // Reload to show updated owner name
        loadTasks();
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
      
      loadTasks();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleBackToDashboard = () => {
    // On mobile, update preference to show dashboard
    if (isMobile) {
      localStorage.setItem('showMobileTasksView', 'false');
    }
    navigate("/dashboard");
  };

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "low": return "border-l-success bg-success/5";
      case "high": return "border-l-destructive bg-destructive/5";
      default: return "border-l-warning bg-warning/5";
    }
  };

  // Parse date string as local date (not UTC)
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const getDueDateStyles = (dueDate: string | null) => {
    if (!dueDate) return "text-muted-foreground";
    const date = parseLocalDate(dueDate);
    if (isPast(date) && !isToday(date)) return "text-destructive font-medium";
    if (isToday(date)) return "text-warning font-medium";
    return "text-muted-foreground";
  };

  const getDueDateLabel = (dueDate: string | null, short: boolean = false) => {
    if (!dueDate) return null;
    const date = parseLocalDate(dueDate);
    if (isPast(date) && !isToday(date)) return "Overdue";
    if (isToday(date)) return "Due Today";
    return short ? format(date, "MMM d") : format(date, "MMM d, yyyy");
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

  // Parse date as local for categorization
  const parseLocal = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const overdueTasks = todos.filter(t => t.due_date && isPast(parseLocal(t.due_date)) && !isToday(parseLocal(t.due_date)));
  const todayTasks = todos.filter(t => t.due_date && isToday(parseLocal(t.due_date)));
  const upcomingTasks = todos.filter(t => !t.due_date || (!isPast(parseLocal(t.due_date)) && !isToday(parseLocal(t.due_date))));

  const canFilterByStore = isSuperAdmin || isStoreGM;
  const isViewingAllTasks = selectedStoreFilter !== "my_tasks";
  
  const getPageTitle = () => {
    if (selectedStoreFilter === "my_tasks") return "My Tasks";
    if (selectedStoreFilter === "all") return "All Tasks";
    if (selectedStoreFilter === "group_level") return "Group-Level Tasks";
    const store = stores.find(s => s.id === selectedStoreFilter);
    return store ? `${store.name} Tasks` : "Tasks";
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-16 sm:pb-0">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={goLogo} alt="GO Logo" className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg hidden sm:block" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-foreground">{getPageTitle()}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {todos.length} pending {todos.length === 1 ? 'task' : 'tasks'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <Button onClick={() => setShowCreateDialog(true)} size={isMobile ? "sm" : "default"}>
                  <Plus className="h-4 w-4 mr-1" />
                  {isMobile ? "New" : "Create Task"}
                </Button>
              )}
              <Button onClick={handleBackToDashboard} variant="outline" size={isMobile ? "sm" : "default"}>
                {isMobile ? (
                  <>
                    Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Store Filter */}
          {canFilterByStore && (
            <div className="mt-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStoreFilter} onValueChange={setSelectedStoreFilter}>
                <SelectTrigger className="w-[200px] sm:w-[250px] h-8 text-sm">
                  <SelectValue placeholder="Filter by store..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my_tasks">My Tasks</SelectItem>
                  <SelectItem value="all">All Tasks</SelectItem>
                  {isSuperAdmin && <SelectItem value="group_level">Group-Level Tasks</SelectItem>}
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {todos.length === 0 ? (
          <Card>
            <CardContent className="py-12 sm:py-16">
              <div className="text-center">
                <CheckCircle2 className="h-16 w-16 sm:h-20 sm:w-20 mx-auto mb-4 text-success opacity-80" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground mb-4 sm:mb-6">
                  You have no pending tasks assigned to you.
                </p>
                <Button onClick={handleBackToDashboard} variant="default">
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
                <div className="flex items-center gap-2 mb-2 sm:mb-3 text-destructive">
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h2 className="text-base sm:text-lg font-semibold">Overdue ({overdueTasks.length})</h2>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {overdueTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      profiles={todo.department_id ? (departmentProfiles[todo.department_id] || []) : (departmentProfiles['__group__'] || [])}
                      userId={userId || ""}
                      isMobile={isMobile}
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
                <div className="flex items-center gap-2 mb-2 sm:mb-3 text-warning">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h2 className="text-base sm:text-lg font-semibold">Due Today ({todayTasks.length})</h2>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {todayTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      profiles={todo.department_id ? (departmentProfiles[todo.department_id] || []) : (departmentProfiles['__group__'] || [])}
                      userId={userId || ""}
                      isMobile={isMobile}
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
                <div className="flex items-center gap-2 mb-2 sm:mb-3 text-foreground">
                  <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h2 className="text-base sm:text-lg font-semibold">Upcoming ({upcomingTasks.length})</h2>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {upcomingTasks.map((todo) => (
                    <TaskCard 
                      key={todo.id} 
                      todo={todo} 
                      profiles={todo.department_id ? (departmentProfiles[todo.department_id] || []) : (departmentProfiles['__group__'] || [])}
                      userId={userId || ""}
                      isMobile={isMobile}
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
      
      {isSuperAdmin && userId && (
        <CreateTaskDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          userId={userId}
          onTaskCreated={loadTasks}
        />
      )}
    </div>
  );
};

interface TaskCardProps {
  todo: Todo & { assigned_to_name?: string };
  profiles: Profile[];
  userId: string;
  isMobile: boolean;
  onComplete: (id: string) => void;
  onUpdateOwner: (id: string, newOwnerId: string) => void;
  onUpdateDueDate: (id: string, newDate: Date | undefined) => void;
  getSeverityStyles: (severity: string) => string;
  getDueDateStyles: (dueDate: string | null) => string;
  getDueDateLabel: (dueDate: string | null, short?: boolean) => string | null;
}

function TaskCard({ todo, profiles, userId, isMobile, onComplete, onUpdateOwner, onUpdateDueDate, getSeverityStyles, getDueDateStyles, getDueDateLabel }: TaskCardProps) {
  const dueLabel = getDueDateLabel(todo.due_date, isMobile);
  const currentOwner = profiles.find(p => p.id === todo.assigned_to);
  const ownerDisplayName = currentOwner?.full_name || todo.assigned_to_name || "Unassigned";
  
  return (
    <Card className={`border-l-4 ${getSeverityStyles(todo.severity)}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <Checkbox
            checked={false}
            onCheckedChange={() => onComplete(todo.id)}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground leading-tight">
                {todo.title}
              </h3>
              {todo.is_recurring && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 gap-1">
                  <Repeat className="h-3 w-3" />
                  {todo.recurrence_interval} {todo.recurrence_unit}
                </Badge>
              )}
            </div>
            {todo.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {todo.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm mb-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>
                  {todo.store_name && todo.department_name 
                    ? `${todo.store_name} • ${todo.department_name}`
                    : todo.store_name 
                      ? todo.store_name
                      : "Group-level task"}
                </span>
              </div>
            </div>
            
            {/* Editable fields */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Owner Select */}
              <div className="flex items-center gap-1 sm:gap-2">
                <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                <Select
                  value={todo.assigned_to || ""}
                  onValueChange={(value) => onUpdateOwner(todo.id, value)}
                >
                  <SelectTrigger className="h-7 sm:h-8 w-[140px] sm:w-[180px] text-xs">
                    <SelectValue placeholder="Assign to...">
                      {ownerDisplayName}
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
                      "h-7 sm:h-8 text-xs justify-start px-2",
                      getDueDateStyles(todo.due_date)
                    )}
                  >
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {dueLabel || (isMobile ? "Set date" : "Set due date")}
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

export default MyTasks;