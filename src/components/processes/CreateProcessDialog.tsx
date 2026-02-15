import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CreateProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  categoryId: string;
  onCreated: (processId: string) => void;
}

export const CreateProcessDialog = ({
  open,
  onOpenChange,
  departmentId,
  categoryId,
  onCreated,
}: CreateProcessDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [users, setUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setOwnerId("");
      fetchUsers();
    }
  }, [open, departmentId]);

  const fetchUsers = async () => {
    // Fetch profiles accessible to this user
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");
    if (data) setUsers(data);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const { data, error } = await supabase
      .from("processes")
      .insert({
        department_id: departmentId,
        category_id: categoryId,
        title: title.trim(),
        description: description.trim() || null,
        owner_id: ownerId || null,
        created_by: user.user.id,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      toast({ title: "Error creating process", description: error.message, variant: "destructive" });
      return;
    }

    if (data) {
      onCreated(data.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Process</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="process-title">Process Name *</Label>
            <Input
              id="process-title"
              placeholder="e.g., Vehicle Check-In"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="process-desc">Description</Label>
            <Textarea
              id="process-desc"
              placeholder="Brief description of this process..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an owner" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
