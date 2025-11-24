import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
}

interface IssueManagementDialogProps {
  departmentId: string;
  onIssueAdded: () => void;
  issue?: Issue;
  trigger?: React.ReactNode;
}

export function IssueManagementDialog({ departmentId, onIssueAdded, issue, trigger }: IssueManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isEditMode = !!issue;

  useEffect(() => {
    if (issue && open) {
      setTitle(issue.title);
      setDescription(issue.description || "");
      setStatus(issue.status);
    } else if (!open) {
      setTitle("");
      setDescription("");
      setStatus("open");
    }
  }, [issue, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Title is required",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isEditMode) {
        const { error } = await supabase
          .from("issues")
          .update({
            title,
            description: description || null,
            status,
          })
          .eq("id", issue.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Issue updated",
        });
      } else {
        // Get the max display_order
        const { data: maxOrderData } = await supabase
          .from("issues")
          .select("display_order")
          .eq("department_id", departmentId)
          .order("display_order", { ascending: false })
          .limit(1);

        const nextOrder = maxOrderData && maxOrderData.length > 0 
          ? maxOrderData[0].display_order + 1 
          : 0;

        const { error } = await supabase
          .from("issues")
          .insert({
            department_id: departmentId,
            title,
            description: description || null,
            status,
            display_order: nextOrder,
            created_by: user.id,
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Issue created",
        });
      }

      onIssueAdded();
      setOpen(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Issue
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Issue" : "Create New Issue"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the issue details" : "Add a new issue to identify, discuss, and solve"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Issue title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description"
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditMode ? "Update Issue" : "Create Issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
