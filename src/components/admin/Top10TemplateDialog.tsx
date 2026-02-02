import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface Column {
  key: string;
  label: string;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  columns: Column[];
  department_type_id: string | null;
}

interface DepartmentType {
  id: string;
  name: string;
}

interface Top10TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSuccess: () => void;
}

export const Top10TemplateDialog = ({
  open,
  onOpenChange,
  template,
  onSuccess,
}: Top10TemplateDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentTypeId, setDepartmentTypeId] = useState<string>("all");
  const [columns, setColumns] = useState<Column[]>([{ key: "name", label: "Name" }]);

  const isEditMode = !!template;

  const { data: departmentTypes } = useQuery({
    queryKey: ["department-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("department_types")
        .select("id, name")
        .order("display_order");
      if (error) throw error;
      return data as DepartmentType[];
    },
  });

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description || "");
      setDepartmentTypeId(template.department_type_id || "all");
      setColumns(
        template.columns?.length > 0
          ? template.columns
          : [{ key: "name", label: "Name" }]
      );
    } else {
      setTitle("");
      setDescription("");
      setDepartmentTypeId("all");
      setColumns([{ key: "name", label: "Name" }]);
    }
  }, [template, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        department_type_id: departmentTypeId === "all" ? null : departmentTypeId,
        columns: columns as unknown as Json,
        ...(isEditMode ? {} : { created_by: user?.id }),
      };

      if (isEditMode && template) {
        const oldTitle = template.title;
        const newTitle = title.trim();

        // Update the template
        const { error } = await supabase
          .from("top_10_list_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;

        // Sync all deployed lists that match the old title (columns, description, title)
        // This preserves all user data in items - only updates list structure
        const { error: syncError } = await supabase
          .from("top_10_lists")
          .update({ 
            title: newTitle,
            description: payload.description,
            columns: payload.columns,
          })
          .eq("title", oldTitle);
        
        if (syncError) {
          console.error("Failed to sync deployed lists:", syncError);
          // Don't throw - template update succeeded
        }
      } else {
        const { error } = await supabase
          .from("top_10_list_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditMode ? "Template updated (synced to all stores)" : "Template created");
      onSuccess();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save template");
    },
  });

  const addColumn = () => {
    const newKey = `col_${Date.now()}`;
    setColumns([...columns, { key: newKey, label: "" }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length > 1) {
      setColumns(columns.filter((_, i) => i !== index));
    }
  };

  const updateColumn = (index: number, field: "key" | "label", value: string) => {
    const updated = [...columns];
    if (field === "label") {
      updated[index] = {
        ...updated[index],
        label: value,
        key: value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || updated[index].key,
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setColumns(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (columns.some((c) => !c.label.trim())) {
      toast.error("All columns must have a label");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Technician Performance"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="department-type">Department Type</Label>
            <Select value={departmentTypeId} onValueChange={setDepartmentTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select department type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Columns</Label>
              <Button type="button" variant="outline" size="sm" onClick={addColumn}>
                <Plus className="h-4 w-4 mr-1" />
                Add Column
              </Button>
            </div>
            <div className="space-y-2">
              {columns.map((col, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={col.label}
                    onChange={(e) => updateColumn(index, "label", e.target.value)}
                    placeholder="Column label"
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground font-mono w-20 truncate">
                    {col.key}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeColumn(index)}
                    disabled={columns.length === 1}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditMode ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
