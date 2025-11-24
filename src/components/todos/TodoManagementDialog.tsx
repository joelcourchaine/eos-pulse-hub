import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  full_name: string;
}

interface Todo {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
}

interface TodoManagementDialogProps {
  departmentId?: string;
  profiles: Profile[];
  onTodoAdded: () => void;
  onDialogOpen?: () => void;
  todo?: Todo;
  trigger?: React.ReactNode;
  linkedIssueId?: string;
  linkedIssueTitle?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TodoManagementDialog({ 
  departmentId, 
  profiles, 
  onTodoAdded, 
  onDialogOpen, 
  todo, 
  trigger,
  linkedIssueId,
  linkedIssueTitle,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: TodoManagementDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  
  const isEditMode = !!todo;
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  useEffect(() => {
    if (todo && open) {
      setTitle(todo.title);
      setDescription(todo.description || "");
      setAssignedTo(todo.assigned_to || "");
      setDueDate(todo.due_date || "");
    } else if (!open) {
      setTitle(linkedIssueTitle ? `Todo: ${linkedIssueTitle}` : "");
      setDescription("");
      setAssignedTo("");
      setDueDate("");
    }
  }, [todo, open, linkedIssueTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title is required",
      });
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && todo) {
        // Update existing todo
        const { error } = await supabase
          .from("todos")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            assigned_to: assignedTo || null,
            due_date: dueDate || null,
          })
          .eq("id", todo.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "To-Do updated successfully",
        });
      } else {
        // Create new todo
        const { data: { user } } = await supabase.auth.getUser();
        
        const { error } = await supabase
          .from("todos")
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            department_id: departmentId!,
            assigned_to: assignedTo || null,
            due_date: dueDate || null,
            created_by: user?.id,
            status: "pending",
            issue_id: linkedIssueId || null,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "To-Do created successfully",
        });
      }

      // Reset form only if creating new
      if (!isEditMode) {
        setTitle("");
        setDescription("");
        setAssignedTo("");
        setDueDate("");
      }
      setOpen(false);
      onTodoAdded();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (controlledOnOpenChange) {
        controlledOnOpenChange(isOpen);
      } else {
        setOpen(isOpen);
      }
      if (isOpen && onDialogOpen) {
        onDialogOpen();
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add To-Do
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit To-Do" : "Create New To-Do"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter to-do title"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details (optional)"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="assigned-to">Assign To</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Select person (optional)" />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={5}>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assignedTo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAssignedTo("")}
                className="mt-1 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear selection
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor="due-date">Due Date</Label>
            <Input
              id="due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (isEditMode ? "Updating..." : "Creating...") : (isEditMode ? "Update To-Do" : "Create To-Do")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
