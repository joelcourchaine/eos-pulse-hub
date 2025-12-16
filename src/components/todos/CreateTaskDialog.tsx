import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Repeat } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface Store {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  store_id: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onTaskCreated: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, userId, onTaskCreated }: CreateTaskDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUnit, setRecurrenceUnit] = useState<"days" | "weeks" | "months">("weeks");

  useEffect(() => {
    if (open) {
      loadStores();
    }
  }, [open]);

  useEffect(() => {
    if (selectedStore) {
      loadDepartments(selectedStore);
    } else {
      setDepartments([]);
      setSelectedDepartment("");
    }
  }, [selectedStore]);

  useEffect(() => {
    if (selectedDepartment) {
      loadProfilesForDepartment(selectedDepartment);
    } else if (selectedStore) {
      loadProfilesForStore(selectedStore);
    } else {
      loadAllProfiles();
    }
  }, [selectedDepartment, selectedStore]);

  // Real-time subscription to refresh profiles when new users are added
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('profiles-changes-task-dialog')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          // Refresh profiles list when a new user is added
          if (selectedDepartment) {
            loadProfilesForDepartment(selectedDepartment);
          } else if (selectedStore) {
            loadProfilesForStore(selectedStore);
          } else {
            loadAllProfiles();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, selectedDepartment, selectedStore]);

  const loadStores = async () => {
    const { data } = await supabase.from("stores").select("id, name").order("name");
    setStores(data || []);
  };

  const loadDepartments = async (storeId: string) => {
    const { data } = await supabase
      .from("departments")
      .select("id, name, store_id")
      .eq("store_id", storeId)
      .order("name");
    setDepartments(data || []);
  };

  const loadProfilesForDepartment = async (deptId: string) => {
    // Get department and store info
    const { data: dept } = await supabase
      .from("departments")
      .select("store_id, stores!inner(group_id)")
      .eq("id", deptId)
      .single();
    
    if (!dept) return;
    
    const storeGroupId = (dept.stores as any)?.group_id;
    
    // Get super admins
    const { data: superAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];
    
    // Get store GMs
    const { data: storeGmRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "store_gm");
    const storeGmIds = storeGmRoles?.map(r => r.user_id) || [];
    
    // Build profile queries
    const allProfiles: Profile[] = [];
    
    // Store profiles
    const { data: storeProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("store_id", dept.store_id);
    if (storeProfiles) allProfiles.push(...storeProfiles);
    
    // Department access profiles
    const { data: deptAccess } = await supabase
      .from("user_department_access")
      .select("user_id")
      .eq("department_id", deptId);
    const deptAccessIds = deptAccess?.map(a => a.user_id) || [];
    
    if (deptAccessIds.length > 0) {
      const { data: accessProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", deptAccessIds);
      if (accessProfiles) allProfiles.push(...accessProfiles);
    }
    
    // Store GM profiles in same group
    if (storeGmIds.length > 0 && storeGroupId) {
      const { data: gmProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", storeGmIds)
        .eq("store_group_id", storeGroupId);
      if (gmProfiles) allProfiles.push(...gmProfiles);
    }
    
    // Super admin profiles
    if (superAdminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", superAdminIds);
      if (adminProfiles) allProfiles.push(...adminProfiles);
    }
    
    // Dedupe and sort
    const unique = allProfiles.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    setProfiles(unique.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  const loadProfilesForStore = async (storeId: string) => {
    const { data: store } = await supabase
      .from("stores")
      .select("group_id")
      .eq("id", storeId)
      .single();
    
    const storeGroupId = store?.group_id;
    
    // Get super admins
    const { data: superAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];
    
    // Get store GMs
    const { data: storeGmRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "store_gm");
    const storeGmIds = storeGmRoles?.map(r => r.user_id) || [];
    
    const allProfiles: Profile[] = [];
    
    // Store profiles
    const { data: storeProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("store_id", storeId);
    if (storeProfiles) allProfiles.push(...storeProfiles);
    
    // Store GM profiles in same group
    if (storeGmIds.length > 0 && storeGroupId) {
      const { data: gmProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", storeGmIds)
        .eq("store_group_id", storeGroupId);
      if (gmProfiles) allProfiles.push(...gmProfiles);
    }
    
    // Super admin profiles
    if (superAdminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", superAdminIds);
      if (adminProfiles) allProfiles.push(...adminProfiles);
    }
    
    const unique = allProfiles.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
    setProfiles(unique.sort((a, b) => a.full_name.localeCompare(b.full_name)));
  };

  const loadAllProfiles = async () => {
    // For group-level tasks, show super admins only
    const { data: superAdminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];
    
    if (superAdminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", superAdminIds);
      setProfiles((adminProfiles || []).sort((a, b) => a.full_name.localeCompare(b.full_name)));
    } else {
      setProfiles([]);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Title is required" });
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.from("todos").insert({
        title: title.trim(),
        description: description.trim() || null,
        severity,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        department_id: selectedDepartment || null,
        assigned_to: assignedTo || null,
        created_by: userId,
        status: "pending",
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? parseInt(recurrenceInterval) : null,
        recurrence_unit: isRecurring ? recurrenceUnit : null,
      });
      
      if (error) throw error;
      
      toast({ title: "Task created successfully" });
      resetForm();
      onOpenChange(false);
      onTaskCreated();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setDueDate(undefined);
    setSelectedStore("");
    setSelectedDepartment("");
    setAssignedTo("");
    setIsRecurring(false);
    setRecurrenceInterval("1");
    setRecurrenceUnit("weeks");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter task title"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Due Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dueDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dueDate ? format(dueDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dueDate}
                  onSelect={setDueDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="recurring" className="font-medium">Recurring Task</Label>
              </div>
              <Switch
                id="recurring"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            
            {isRecurring && (
              <div className="flex items-center gap-2 pt-2">
                <span className="text-sm text-muted-foreground">Repeat every</span>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(e.target.value)}
                  className="w-16 text-center"
                />
                <Select value={recurrenceUnit} onValueChange={(v) => setRecurrenceUnit(v as "days" | "weeks" | "months")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">days</SelectItem>
                    <SelectItem value="weeks">weeks</SelectItem>
                    <SelectItem value="months">months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label>Store (optional)</Label>
            <Select value={selectedStore} onValueChange={(v) => {
              setSelectedStore(v === "none" ? "" : v);
              setSelectedDepartment("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select store (leave empty for group-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No store (Group-level task)</SelectItem>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedStore && (
            <div className="space-y-2">
              <Label>Department (optional)</Label>
              <Select value={selectedDepartment} onValueChange={(v) => setSelectedDepartment(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {profiles.map(profile => (
                  <SelectItem key={profile.id} value={profile.id}>{profile.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
