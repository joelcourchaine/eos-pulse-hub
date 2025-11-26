import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DepartmentAccessDialogProps {
  userId: string;
  userName: string;
  currentStoreId?: string | null;
  onAccessUpdated: () => void;
}

export const DepartmentAccessDialog = ({ userId, userName, currentStoreId, onAccessUpdated }: DepartmentAccessDialogProps) => {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadDepartments();
      loadUserAccess();
    }
  }, [open, userId, currentStoreId]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("departments")
        .select("*, stores(name)")
        .order("name");

      if (currentStoreId) {
        query = query.eq("store_id", currentStoreId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error("Error loading departments:", error);
      toast({
        title: "Error",
        description: "Failed to load departments",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserAccess = async () => {
    try {
      const { data, error } = await supabase
        .from("user_department_access")
        .select("department_id")
        .eq("user_id", userId);

      if (error) throw error;

      const deptIds = data?.map(d => d.department_id) || [];
      setSelectedDepartments(new Set(deptIds));
    } catch (error: any) {
      console.error("Error loading user access:", error);
    }
  };

  const handleToggleDepartment = (departmentId: string) => {
    setSelectedDepartments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId);
      } else {
        newSet.add(departmentId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Delete all existing access for this user
      const { error: deleteError } = await supabase
        .from("user_department_access")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new access records
      if (selectedDepartments.size > 0) {
        const accessRecords = Array.from(selectedDepartments).map(deptId => ({
          user_id: userId,
          department_id: deptId,
          granted_by: user?.id
        }));

        const { error: insertError } = await supabase
          .from("user_department_access")
          .insert(accessRecords);

        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: "Department access updated successfully"
      });

      onAccessUpdated();
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving department access:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update department access",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="Manage Department Access">
          <Building2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Department Access</DialogTitle>
          <DialogDescription>
            Select which departments {userName} can access
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {departments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No departments available
                </p>
              ) : (
                departments.map(dept => (
                  <div key={dept.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={dept.id}
                      checked={selectedDepartments.has(dept.id)}
                      onCheckedChange={() => handleToggleDepartment(dept.id)}
                    />
                    <Label
                      htmlFor={dept.id}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {dept.name}
                      {dept.stores && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({dept.stores.name})
                        </span>
                      )}
                    </Label>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
