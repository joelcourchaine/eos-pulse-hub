import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
  currentStoreId?: string | null;
}

export const AddUserDialog = ({ open, onOpenChange, onUserCreated, currentStoreId }: AddUserDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("department_manager");
  const [storeId, setStoreId] = useState<string>(currentStoreId || "");
  const [storeGroupId, setStoreGroupId] = useState<string>("");
  const [stores, setStores] = useState<any[]>([]);
  const [storeGroups, setStoreGroups] = useState<any[]>([]);
  const { toast } = useToast();

  // Update storeId when currentStoreId changes
  useEffect(() => {
    if (currentStoreId) {
      setStoreId(currentStoreId);
    }
  }, [currentStoreId]);

  // Load stores and store groups when dialog opens
  useEffect(() => {
    if (open) {
      loadStores();
      loadStoreGroups();
    }
  }, [open]);

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("name");
    
    if (!error && data) {
      setStores(data);
    }
  };

  const loadStoreGroups = async () => {
    const { data, error } = await supabase
      .from("store_groups")
      .select("*")
      .order("name");
    
    if (!error && data) {
      setStoreGroups(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          full_name: fullName,
          role,
          store_id: storeId || null,
          store_group_id: storeGroupId || null,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast({
        title: "Success",
        description: `User created successfully. An invitation email has been sent to ${email} to set their password.`,
      });

      // Reset form
      setEmail("");
      setFullName("");
      setRole("department_manager");
      setStoreId("");
      setStoreGroupId("");
      
      onUserCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. They will receive an email to set their password.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com (optional - will auto-generate if empty)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="super_admin">Super Admin</SelectItem>
                <SelectItem value="store_gm">Store GM</SelectItem>
                <SelectItem value="department_manager">Department Manager</SelectItem>
                <SelectItem value="read_only">Read Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessType">Store Access</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="store" className="text-xs text-muted-foreground">Single Store</Label>
                <Select value={storeId || "none"} onValueChange={(value) => {
                  setStoreId(value === "none" ? "" : value);
                  if (value !== "none") setStoreGroupId(""); // Clear group if store selected
                }}>
                  <SelectTrigger id="store">
                    <SelectValue placeholder="Select store" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {stores.filter(s => s.id && s.id.trim() !== "").map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="storeGroup" className="text-xs text-muted-foreground">Store Group (Multi-Store)</Label>
                <Select value={storeGroupId || "none"} onValueChange={(value) => {
                  setStoreGroupId(value === "none" ? "" : value);
                  if (value !== "none") setStoreId(""); // Clear store if group selected
                }}>
                  <SelectTrigger id="storeGroup">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {storeGroups.filter(g => g.id && g.id.trim() !== "").map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Assign to either a single store OR a store group for multi-store access
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
