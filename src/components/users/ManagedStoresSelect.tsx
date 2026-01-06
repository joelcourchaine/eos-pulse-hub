import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Store {
  id: string;
  name: string;
}

interface ManagedStoresSelectProps {
  userId: string;
  stores: Store[];
  onUpdate: () => void;
}

export const ManagedStoresSelect = ({ userId, stores, onUpdate }: ManagedStoresSelectProps) => {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Fetch current store access when popover opens
  useEffect(() => {
    const fetchStoreAccess = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_store_access")
        .select("store_id")
        .eq("user_id", userId);

      if (error) {
        console.error("Error fetching store access:", error);
      } else {
        setSelectedStores(data?.map(d => d.store_id) || []);
      }
      setLoading(false);
    };

    if (open) {
      fetchStoreAccess();
    }
  }, [userId, open]);

  const handleToggle = (storeId: string) => {
    setSelectedStores(prev =>
      prev.includes(storeId)
        ? prev.filter(id => id !== storeId)
        : [...prev, storeId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get current user for granted_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Delete existing store access for this user
      const { error: deleteError } = await supabase
        .from("user_store_access")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      // Insert new store access records
      if (selectedStores.length > 0) {
        const { error: insertError } = await supabase
          .from("user_store_access")
          .insert(
            selectedStores.map(storeId => ({
              user_id: userId,
              store_id: storeId,
              granted_by: user?.id
            }))
          );

        if (insertError) throw insertError;

        // Get all departments for the selected stores
        const { data: departments } = await supabase
          .from("departments")
          .select("id")
          .in("store_id", selectedStores);

        if (departments && departments.length > 0) {
          // Get existing department access for this user
          const { data: existingAccess } = await supabase
            .from("user_department_access")
            .select("department_id")
            .eq("user_id", userId);

          const existingDeptIds = new Set(existingAccess?.map(a => a.department_id) || []);
          
          // Only insert department access for departments not already assigned
          const newDeptAccess = departments
            .filter(d => !existingDeptIds.has(d.id))
            .map(dept => ({
              user_id: userId,
              department_id: dept.id,
              granted_by: user?.id
            }));

          if (newDeptAccess.length > 0) {
            const { error: deptAccessError } = await supabase
              .from("user_department_access")
              .insert(newDeptAccess);

            if (deptAccessError) {
              console.error("Error adding department access:", deptAccessError);
            }
          }
        }
      }

      toast({ title: "Success", description: "Store access updated successfully" });
      onUpdate();
      setOpen(false);
    } catch (error: any) {
      console.error("Error updating store access:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update store access",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getDisplayText = () => {
    if (selectedStores.length === 0) return "None";
    if (selectedStores.length === 1) {
      const store = stores.find(s => s.id === selectedStores[0]);
      return store?.name || "1 store";
    }
    return `${selectedStores.length} stores`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start font-normal">
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`store-access-${store.id}`}
                    checked={selectedStores.includes(store.id)}
                    onCheckedChange={() => handleToggle(store.id)}
                  />
                  <label
                    htmlFor={`store-access-${store.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {store.name}
                  </label>
                </div>
              ))}
              {stores.length === 0 && (
                <p className="text-sm text-muted-foreground">No stores available</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
