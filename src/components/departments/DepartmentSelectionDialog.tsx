import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DepartmentSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export function DepartmentSelectionDialog({ open, onOpenChange, storeId }: DepartmentSelectionDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: departmentTypes } = useQuery({
    queryKey: ['department-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department_types')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: departments, isLoading: departmentsLoading } = useQuery({
    queryKey: ['store-departments', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select(`
          *,
          department_types (name, description)
        `)
        .eq('store_id', storeId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const { data: users } = useQuery({
    queryKey: ['store-users', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('store_id', storeId)
        .in('role', ['department_manager', 'store_gm']);
      if (error) throw error;
      return data;
    },
    enabled: !!storeId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const selectedType = departmentTypes?.find(t => t.id === selectedTypeId);
      if (!selectedType) throw new Error("Please select a department type");

      const { error } = await supabase
        .from('departments')
        .insert({
          name: selectedType.name,
          store_id: storeId,
          department_type_id: selectedTypeId,
          manager_id: managerId || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department added successfully");
      setSelectedTypeId("");
      setManagerId("");
      queryClient.invalidateQueries({ queryKey: ['store-departments', storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add department: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (departmentId: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Department removed successfully");
      queryClient.invalidateQueries({ queryKey: ['store-departments', storeId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove department: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  // Filter out department types that are already used (by type_id or by name to prevent duplicates)
  const usedTypeIds = departments?.map(d => d.department_type_id).filter(Boolean) || [];
  const usedNames = departments?.map(d => d.name.toLowerCase()) || [];
  const availableTypes = departmentTypes?.filter(type => 
    !usedTypeIds.includes(type.id) && !usedNames.includes(type.name.toLowerCase())
  ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Store Departments</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department-type">Department Type</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
              <SelectTrigger id="department-type">
                <SelectValue placeholder="Select a department type" />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div>
                      <div className="font-medium">{type.name}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager">Department Manager (Optional)</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger id="manager">
                <SelectValue placeholder="Select a manager" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={createMutation.isPending || !selectedTypeId}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" />
            Add Department
          </Button>
        </form>

        <div className="mt-6 space-y-2">
          <h3 className="font-semibold">Active Departments</h3>
          {departmentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : departments && departments.length > 0 ? (
            <div className="space-y-2">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-medium">{dept.name}</div>
                      {dept.department_types && (
                        <div className="text-xs text-muted-foreground">
                          {dept.department_types.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(dept.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No departments added yet. Add departments from the predefined list above.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
