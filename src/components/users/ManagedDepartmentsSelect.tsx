import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  manager_id: string | null;
}

interface ManagedDepartmentsSelectProps {
  userId: string;
  departments: Department[];
  onUpdate: () => void;
}

export const ManagedDepartmentsSelect = ({ 
  userId, 
  departments, 
  onUpdate 
}: ManagedDepartmentsSelectProps) => {
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Load departments from user_department_access
  const loadManagedDepts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_department_access")
        .select("department_id")
        .eq("user_id", userId);

      if (error) throw error;
      setSelectedDepts(data?.map(d => d.department_id) || []);
    } catch (error) {
      console.error("Error loading managed departments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount so button label is correct
  useEffect(() => {
    loadManagedDepts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Refetch when popover opens
  useEffect(() => {
    if (open) {
      loadManagedDepts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleToggle = (deptId: string) => {
    setSelectedDepts(prev => 
      prev.includes(deptId) 
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Delete existing access for this user
      const { error: deleteError } = await supabase
        .from("user_department_access")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new access records
      if (selectedDepts.length > 0) {
        const { error: insertError } = await supabase
          .from("user_department_access")
          .insert(
            selectedDepts.map(deptId => ({
              user_id: userId,
              department_id: deptId,
              granted_by: user?.id
            }))
          );

        if (insertError) throw insertError;
      }

      // Update departments.manager_id for primary assignment
      // Set manager_id on all selected departments, clear from others
      await supabase
        .from("departments")
        .update({ manager_id: null })
        .eq("manager_id", userId);

      for (const deptId of selectedDepts) {
        await supabase
          .from("departments")
          .update({ manager_id: userId })
          .eq("id", deptId);
      }

      toast({ title: "Success", description: "Department assignments updated" });
      onUpdate();
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving managed departments:", error);
      toast({ 
        title: "Error", 
        description: error.message || "Failed to update departments",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const getDisplayText = () => {
    if (loading) return "Loading...";
    if (selectedDepts.length === 0) return "None";
    if (selectedDepts.length === 1) {
      return departments.find(d => d.id === selectedDepts[0])?.name || "1 dept";
    }
    return `${selectedDepts.length} depts`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs justify-between w-full"
          disabled={loading}
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronDown className="h-3 w-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {departments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No departments available</p>
          ) : (
            departments.map(dept => (
              <label
                key={dept.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
              >
                <Checkbox
                  checked={selectedDepts.includes(dept.id)}
                  onCheckedChange={() => handleToggle(dept.id)}
                />
                <span className="text-xs">{dept.name}</span>
              </label>
            ))
          )}
        </div>
        <div className="border-t mt-2 pt-2 flex justify-end gap-2">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
