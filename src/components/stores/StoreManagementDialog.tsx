import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface StoreManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreManagementDialog({ open, onOpenChange }: StoreManagementDialogProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const queryClient = useQueryClient();

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: storeGroups } = useQuery({
    queryKey: ['store-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_groups')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select(`
          *,
          store_groups (
            id,
            name
          )
        `)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (editingStoreId) {
        const { error } = await supabase
          .from('stores')
          .update({ name, location, brand_id: brandId || null, group_id: groupId || null })
          .eq('id', editingStoreId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stores')
          .insert({ name, location, brand_id: brandId || null, group_id: groupId || null, logo_url: null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingStoreId ? "Store updated successfully" : "Store created successfully");
      setName("");
      setLocation("");
      setBrandId("");
      setGroupId(undefined);
      setEditingStoreId(null);
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to ${editingStoreId ? 'update' : 'create'} store: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (storeId: string) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Store deleted successfully");
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete store: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a store name");
      return;
    }
    createMutation.mutate();
  };

  const handleEdit = (store: any) => {
    console.log("handleEdit called with store:", store);
    setName(store.name);
    setLocation(store.location || "");
    setBrandId(store.brand_id || "");
    setGroupId(store.group_id || undefined);
    setEditingStoreId(store.id);
    // Scroll to form after state update
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    toast.info(`Editing "${store.name}" - scroll up to see the form`);
  };

  const handleCancelEdit = () => {
    setName("");
    setLocation("");
    setBrandId("");
    setGroupId(undefined);
    setEditingStoreId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Stores</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Store Name</Label>
            <Input
              id="store-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Downtown Location"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-location">Location</Label>
            <Input
              id="store-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., 123 Main St, City, State"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-brand">Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger id="store-brand">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                {brands?.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-group">Store Group (Optional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="store-group">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {storeGroups?.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            {editingStoreId && (
              <Button type="button" variant="outline" onClick={handleCancelEdit}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingStoreId ? (
                <>
                  <Pencil className="mr-2 h-4 w-4" />
                  Update Store
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Store
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 space-y-2">
          <h3 className="font-semibold">Existing Stores</h3>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stores && stores.length > 0 ? (
            <div className="space-y-2">
              {stores.map((store) => (
                <div key={store.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{store.name}</div>
                    {store.location && <div className="text-sm text-muted-foreground">{store.location}</div>}
                    {store.brand && <div className="text-sm text-muted-foreground">Brand: {store.brand}</div>}
                    {store.store_groups && <div className="text-sm text-muted-foreground">Group: {store.store_groups.name}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="icon"
                      className="bg-success hover:bg-success/90"
                      onClick={(e) => {
                        console.log("Edit button clicked for store:", store.name);
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(store);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(store.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No stores created yet</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
