import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface Store {
  id: string;
  name: string;
  group_id?: string | null;
}

interface StoreGroup {
  id: string;
  name: string;
}

interface ManagedStoresSelectProps {
  userId: string;
  stores: Store[];
  storeGroups: StoreGroup[];
  userStoreGroupId: string | null;
  userStoreId: string | null;
  onUpdate: () => void;
  isSuperAdmin?: boolean;
}

type AccessMode = "none" | "group" | "specific";

export const ManagedStoresSelect = ({ 
  userId, 
  stores, 
  storeGroups,
  userStoreGroupId,
  userStoreId,
  onUpdate,
  isSuperAdmin 
}: ManagedStoresSelectProps) => {
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const fetchStoreAccess = async () => {
    setLoading(true);
    
    // Check if user has group-level access
    if (userStoreGroupId && !userStoreId) {
      setAccessMode("group");
      setSelectedGroupId(userStoreGroupId);
      setSelectedStores([]);
      setLoading(false);
      return;
    }
    
    // Check user_store_access table for specific stores
    const { data, error } = await supabase
      .from("user_store_access")
      .select("store_id")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching store access:", error);
      setLoading(false);
      return;
    }
    
    const accessStores = data?.map((d) => d.store_id) || [];
    
    // Include the user's primary store_id if set
    if (userStoreId && !accessStores.includes(userStoreId)) {
      accessStores.push(userStoreId);
    }
    
    if (accessStores.length > 0) {
      setAccessMode("specific");
      setSelectedStores(accessStores);
      setSelectedGroupId(null);
    } else {
      setAccessMode("none");
      setSelectedStores([]);
      setSelectedGroupId(null);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchStoreAccess();
  }, [userId, userStoreGroupId, userStoreId]);

  useEffect(() => {
    if (open) {
      fetchStoreAccess();
    }
  }, [open]);

  const handleToggleStore = (storeId: string) => {
    // When toggling individual stores, switch to specific mode
    if (accessMode === "group") {
      // Switching from group to specific - start with just this store
      setAccessMode("specific");
      setSelectedGroupId(null);
      setSelectedStores([storeId]);
    } else {
      setSelectedStores(prev =>
        prev.includes(storeId)
          ? prev.filter(id => id !== storeId)
          : [...prev, storeId]
      );
      
      // If all stores are deselected, set mode to none
      if (selectedStores.length === 1 && selectedStores.includes(storeId)) {
        setAccessMode("none");
      } else if (accessMode === "none") {
        setAccessMode("specific");
      }
    }
  };

  const handleSelectGroup = (groupId: string) => {
    if (accessMode === "group" && selectedGroupId === groupId) {
      // Deselect group - switch to none
      setAccessMode("none");
      setSelectedGroupId(null);
      setSelectedStores([]);
    } else {
      // Select group
      setAccessMode("group");
      setSelectedGroupId(groupId);
      setSelectedStores([]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (accessMode === "group" && selectedGroupId) {
        // Set group-level access: update profile, clear user_store_access
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            store_group_id: selectedGroupId, 
            store_id: null 
          })
          .eq("id", userId);
        
        if (profileError) throw profileError;
        
        // Clear user_store_access
        await supabase
          .from("user_store_access")
          .delete()
          .eq("user_id", userId);
          
      } else if (accessMode === "specific" && selectedStores.length > 0) {
        // Set specific store access
        const primaryStore = selectedStores[0];
        const additionalStores = selectedStores.slice(1);
        
        // Update profile with primary store, clear group
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            store_id: primaryStore, 
            store_group_id: null 
          })
          .eq("id", userId);
        
        if (profileError) throw profileError;
        
        // Delete existing store access
        await supabase
          .from("user_store_access")
          .delete()
          .eq("user_id", userId);
        
        // Insert additional store access (excluding primary which is in profile)
        if (additionalStores.length > 0) {
          const { error: insertError } = await supabase
            .from("user_store_access")
            .insert(
              additionalStores.map(storeId => ({
                user_id: userId,
                store_id: storeId,
                granted_by: user?.id
              }))
            );

          if (insertError) throw insertError;
        }

        // Add department access for all selected stores
        const { data: departments } = await supabase
          .from("departments")
          .select("id")
          .in("store_id", selectedStores);

        if (departments && departments.length > 0) {
          const { data: existingAccess } = await supabase
            .from("user_department_access")
            .select("department_id")
            .eq("user_id", userId);

          const existingDeptIds = new Set(existingAccess?.map(a => a.department_id) || []);
          
          const newDeptAccess = departments
            .filter(d => !existingDeptIds.has(d.id))
            .map(dept => ({
              user_id: userId,
              department_id: dept.id,
              granted_by: user?.id
            }));

          if (newDeptAccess.length > 0) {
            await supabase
              .from("user_department_access")
              .insert(newDeptAccess);
          }
        }
        
      } else {
        // No access - clear both
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ 
            store_id: null, 
            store_group_id: null 
          })
          .eq("id", userId);
        
        if (profileError) throw profileError;
        
        await supabase
          .from("user_store_access")
          .delete()
          .eq("user_id", userId);
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
    if (accessMode === "group" && selectedGroupId) {
      const group = storeGroups.find(g => g.id === selectedGroupId);
      return `All (${group?.name || "Group"})`;
    }
    if (accessMode === "specific") {
      if (selectedStores.length === 0) return "None";
      if (selectedStores.length === 1) {
        const store = stores.find(s => s.id === selectedStores[0]);
        return store?.name || "1 store";
      }
      return `${selectedStores.length} stores`;
    }
    return "None";
  };

  // Get stores for a specific group
  const getGroupStores = (groupId: string) => {
    return stores.filter(s => s.group_id === groupId);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs w-full justify-start font-normal">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            {/* Group Access Options - Only for super admins */}
            {isSuperAdmin && storeGroups.length > 0 && (
              <>
                <div className="text-xs font-medium text-muted-foreground mb-2">Group Access</div>
                <div className="space-y-2 mb-3">
                  {storeGroups.map((group) => {
                    const groupStoreCount = getGroupStores(group.id).length;
                    return (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`group-${group.id}`}
                          checked={accessMode === "group" && selectedGroupId === group.id}
                          onCheckedChange={() => handleSelectGroup(group.id)}
                        />
                        <label
                          htmlFor={`group-${group.id}`}
                          className="text-sm font-medium leading-none cursor-pointer flex items-center gap-1"
                        >
                          <Building2 className="h-3 w-3" />
                          All {group.name} ({groupStoreCount} stores)
                        </label>
                      </div>
                    );
                  })}
                </div>
                <Separator className="my-3" />
                <div className="text-xs font-medium text-muted-foreground mb-2">Specific Stores</div>
              </>
            )}
            
            {/* Individual Store Selection */}
            <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`store-${store.id}`}
                    checked={
                      accessMode === "specific" 
                        ? selectedStores.includes(store.id)
                        : accessMode === "group" && store.group_id === selectedGroupId
                    }
                    disabled={accessMode === "group"}
                    onCheckedChange={() => handleToggleStore(store.id)}
                  />
                  <label
                    htmlFor={`store-${store.id}`}
                    className={`text-sm font-medium leading-none cursor-pointer ${
                      accessMode === "group" ? "text-muted-foreground" : ""
                    }`}
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
