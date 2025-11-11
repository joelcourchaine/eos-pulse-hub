import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  full_name: string;
}

interface RockManagementDialogProps {
  departmentId: string;
  year: number;
  quarter: number;
  onRocksChange: () => void;
  rock?: any;
}

export const RockManagementDialog = ({ departmentId, year, quarter, onRocksChange, rock }: RockManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formData, setFormData] = useState({
    title: rock?.title || "",
    description: rock?.description || "",
    assigned_to: rock?.assigned_to || "",
    progress_percentage: rock?.progress_percentage || 0,
    status: rock?.status || "on_track",
    due_date: rock?.due_date || "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProfiles();
    }
  }, [open]);

  useEffect(() => {
    if (rock) {
      setFormData({
        title: rock.title || "",
        description: rock.description || "",
        assigned_to: rock.assigned_to || "",
        progress_percentage: rock.progress_percentage || 0,
        status: rock.status || "on_track",
        due_date: rock.due_date || "",
      });
    }
  }, [rock]);

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name");

    if (error) {
      console.error("Error loading profiles:", error);
      return;
    }

    setProfiles(data || []);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }

    setLoading(true);

    const rockData = {
      department_id: departmentId,
      year,
      quarter,
      title: formData.title,
      description: formData.description,
      assigned_to: formData.assigned_to || null,
      progress_percentage: parseInt(formData.progress_percentage.toString()) || 0,
      status: formData.status,
      due_date: formData.due_date || null,
    };

    let error;
    if (rock) {
      ({ error } = await supabase
        .from("rocks")
        .update(rockData)
        .eq("id", rock.id));
    } else {
      ({ error } = await supabase
        .from("rocks")
        .insert(rockData));
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: rock ? "Rock updated successfully" : "Rock added successfully" });
      setOpen(false);
      setFormData({
        title: "",
        description: "",
        assigned_to: "",
        progress_percentage: 0,
        status: "on_track",
        due_date: "",
      });
      onRocksChange();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rock ? (
          <Button variant="ghost" size="sm">Edit</Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{rock ? "Edit Rock" : "Add New Rock"}</DialogTitle>
          <DialogDescription>
            Define a quarterly priority for Q{quarter} {year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Reduce Personnel Expense to 35%"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this rock..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress_percentage}
                onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rock ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
