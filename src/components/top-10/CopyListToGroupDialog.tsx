import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface Top10List {
  id: string;
  title: string;
  description: string | null;
  columns: ColumnDefinition[];
  display_order: number;
}

interface StoreGroup {
  id: string;
  name: string;
}

interface DepartmentType {
  id: string;
  name: string;
}

interface CopyListToGroupDialogProps {
  list: Top10List;
  currentDepartmentId: string;
  onCopyComplete?: () => void;
}

export function CopyListToGroupDialog({
  list,
  currentDepartmentId,
  onCopyComplete,
}: CopyListToGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [currentDeptType, setCurrentDeptType] = useState<DepartmentType | null>(null);
  const [targetDepartments, setTargetDepartments] = useState<Array<{ id: string; storeName: string }>>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  // Fetch store groups and current department type on open
  useEffect(() => {
    if (open) {
      fetchStoreGroups();
      fetchCurrentDepartmentType();
    }
  }, [open]);

  // Fetch target departments when group is selected
  useEffect(() => {
    if (selectedGroupId && currentDeptType) {
      fetchTargetDepartments();
    } else {
      setTargetDepartments([]);
      setSelectedDepartments([]);
    }
  }, [selectedGroupId, currentDeptType]);

  const fetchStoreGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("store_groups")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setStoreGroups(data || []);
    } catch (error) {
      console.error("Error fetching store groups:", error);
      toast.error("Failed to load store groups");
    }
  };

  const fetchCurrentDepartmentType = async () => {
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("department_type_id, department_types(id, name)")
        .eq("id", currentDepartmentId)
        .single();

      if (error) throw error;
      if (data?.department_types) {
        setCurrentDeptType(data.department_types as DepartmentType);
      }
    } catch (error) {
      console.error("Error fetching department type:", error);
    }
  };

  const fetchTargetDepartments = async () => {
    if (!selectedGroupId || !currentDeptType) return;

    setLoadingDepartments(true);
    try {
      // Get all stores in the selected group
      const { data: stores, error: storesError } = await supabase
        .from("stores")
        .select("id, name")
        .eq("group_id", selectedGroupId);

      if (storesError) throw storesError;

      if (!stores || stores.length === 0) {
        setTargetDepartments([]);
        return;
      }

      // Get all departments of the same type in those stores
      const { data: departments, error: deptsError } = await supabase
        .from("departments")
        .select("id, store_id")
        .eq("department_type_id", currentDeptType.id)
        .in("store_id", stores.map(s => s.id))
        .neq("id", currentDepartmentId);

      if (deptsError) throw deptsError;

      // Map departments to include store names
      const storeMap = new Map(stores.map(s => [s.id, s.name]));
      const depts = (departments || []).map(d => ({
        id: d.id,
        storeName: storeMap.get(d.store_id) || "Unknown Store",
      }));

      setTargetDepartments(depts);
      // Select all by default
      setSelectedDepartments(depts.map(d => d.id));
    } catch (error) {
      console.error("Error fetching target departments:", error);
      toast.error("Failed to load departments");
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDepartments(targetDepartments.map(d => d.id));
    } else {
      setSelectedDepartments([]);
    }
  };

  const handleToggleDepartment = (deptId: string, checked: boolean) => {
    if (checked) {
      setSelectedDepartments(prev => [...prev, deptId]);
    } else {
      setSelectedDepartments(prev => prev.filter(id => id !== deptId));
    }
  };

  const handleCopy = async () => {
    if (selectedDepartments.length === 0) {
      toast.error("Please select at least one department");
      return;
    }

    setLoading(true);
    try {
      // Get existing list counts for each department to set proper display_order
      const { data: existingLists, error: countError } = await supabase
        .from("top_10_lists")
        .select("department_id, id")
        .in("department_id", selectedDepartments)
        .eq("is_active", true);

      if (countError) throw countError;

      // Count lists per department
      const listCounts = new Map<string, number>();
      (existingLists || []).forEach(l => {
        listCounts.set(l.department_id, (listCounts.get(l.department_id) || 0) + 1);
      });

      // Check for lists with the same title (to avoid duplicates)
      const { data: duplicates, error: dupError } = await supabase
        .from("top_10_lists")
        .select("department_id")
        .in("department_id", selectedDepartments)
        .eq("title", list.title)
        .eq("is_active", true);

      if (dupError) throw dupError;

      const departmentsWithDuplicate = new Set((duplicates || []).map(d => d.department_id));
      const departmentsToInsert = selectedDepartments.filter(id => !departmentsWithDuplicate.has(id));

      if (departmentsToInsert.length === 0) {
        toast.warning("All selected departments already have a list with this title");
        setOpen(false);
        return;
      }

      // Create new lists for each target department
      const newLists = departmentsToInsert.map(deptId => ({
        department_id: deptId,
        title: list.title,
        description: list.description,
        columns: JSON.parse(JSON.stringify(list.columns)),
        display_order: (listCounts.get(deptId) || 0) + 1,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from("top_10_lists")
        .insert(newLists);

      if (insertError) throw insertError;

      const skippedCount = selectedDepartments.length - departmentsToInsert.length;
      const successMessage = skippedCount > 0
        ? `List copied to ${departmentsToInsert.length} departments. ${skippedCount} skipped (already had this list).`
        : `List copied to ${departmentsToInsert.length} departments successfully!`;

      toast.success(successMessage);
      setOpen(false);
      onCopyComplete?.();
    } catch (error: any) {
      console.error("Error copying list:", error);
      toast.error(error.message || "Failed to copy list");
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setSelectedGroupId("");
    setTargetDepartments([]);
    setSelectedDepartments([]);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Copy to Group">
          <Copy className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Copy List to Group</DialogTitle>
          <DialogDescription>
            Copy "{list.title}" to all {currentDeptType?.name || "similar"} departments in a store group.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Select Store Group</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a store group..." />
              </SelectTrigger>
              <SelectContent>
                {storeGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedGroupId && (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Target Departments</Label>
                {targetDepartments.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={selectedDepartments.length === targetDepartments.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <label htmlFor="select-all" className="text-sm text-muted-foreground">
                      Select All
                    </label>
                  </div>
                )}
              </div>

              {loadingDepartments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : targetDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No {currentDeptType?.name || "matching"} departments found in this group (excluding current department).
                </p>
              ) : (
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-2">
                  {targetDepartments.map((dept) => (
                    <div key={dept.id} className="flex items-center gap-2">
                      <Checkbox
                        id={dept.id}
                        checked={selectedDepartments.includes(dept.id)}
                        onCheckedChange={(checked) => 
                          handleToggleDepartment(dept.id, checked as boolean)
                        }
                      />
                      <label htmlFor={dept.id} className="text-sm flex-1">
                        {dept.storeName}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCopy} 
            disabled={loading || selectedDepartments.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Copying...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy to {selectedDepartments.length} Department{selectedDepartments.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
