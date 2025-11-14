import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface StoreManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreManagementDialog({ open, onOpenChange }: StoreManagementDialogProps) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [brand, setBrand] = useState<string>("GMC");
  const queryClient = useQueryClient();

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('stores')
        .insert({ name, location, brand });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Store created successfully");
      setName("");
      setLocation("");
      setBrand("GMC");
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to create store: ${error.message}`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Stores</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger id="store-brand">
                <SelectValue placeholder="Select brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GMC">GMC</SelectItem>
                <SelectItem value="Chevrolet">Chevrolet</SelectItem>
                <SelectItem value="Stellantis">Stellantis</SelectItem>
                <SelectItem value="Nissan">Nissan</SelectItem>
                <SelectItem value="Ford">Ford</SelectItem>
                <SelectItem value="Mazda">Mazda</SelectItem>
                <SelectItem value="Honda">Honda</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" />
            Add Store
          </Button>
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
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(store.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
