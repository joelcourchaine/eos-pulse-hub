import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, FileText, LayoutTemplate } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ColumnDefinition {
  key: string;
  label: string;
}

interface Top10List {
  id: string;
  title: string;
  description: string | null;
  columns: ColumnDefinition[];
  display_order: number;
}

interface Template {
  id: string;
  title: string;
  description: string | null;
  columns: ColumnDefinition[];
  department_type_id: string | null;
}

interface Top10ListManagementDialogProps {
  departmentId: string;
  list?: Top10List;
  onListChange: () => void;
  existingListCount: number;
}

export function Top10ListManagementDialog({
  departmentId,
  list,
  onListChange,
  existingListCount,
}: Top10ListManagementDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { key: "col_1", label: "Column 1" },
  ]);
  const [mode, setMode] = useState<"choose" | "template" | "custom">("choose");

  const isEdit = !!list;
  const maxColumns = 8;
  const maxLists = 4;

  // Fetch department type for template filtering
  const { data: departmentTypeId } = useQuery({
    queryKey: ["department-type", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("department_type_id")
        .eq("id", departmentId)
        .single();
      if (error) throw error;
      return data?.department_type_id;
    },
    enabled: open && !isEdit,
  });

  // Fetch templates filtered by department type
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["top10-templates", departmentTypeId],
    queryFn: async () => {
      let query = supabase
        .from("top_10_list_templates")
        .select("id, title, description, columns, department_type_id")
        .order("title");

      // If department has a type, filter templates for that type or null (universal)
      if (departmentTypeId) {
        query = query.or(`department_type_id.eq.${departmentTypeId},department_type_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        columns: (Array.isArray(t.columns) ? t.columns : []) as unknown as ColumnDefinition[]
      })) as Template[];
    },
    enabled: open && !isEdit && mode === "template",
  });

  useEffect(() => {
    if (open && list) {
      setTitle(list.title);
      setDescription(list.description || "");
      setColumns(list.columns.length > 0 ? list.columns : [{ key: "col_1", label: "Column 1" }]);
      setMode("custom"); // Edit mode goes straight to form
    } else if (open && !list) {
      setTitle("");
      setDescription("");
      setColumns([{ key: "col_1", label: "Column 1" }]);
      setMode("choose");
    }
  }, [open, list]);

  const applyTemplate = (template: Template) => {
    setTitle(template.title);
    setDescription(template.description || "");
    setColumns(template.columns.length > 0 ? template.columns : [{ key: "col_1", label: "Column 1" }]);
    setMode("custom");
  };

  const addColumn = () => {
    if (columns.length >= maxColumns) return;
    const newKey = `col_${columns.length + 1}`;
    setColumns([...columns, { key: newKey, label: `Column ${columns.length + 1}` }]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const updateColumnLabel = (index: number, label: string) => {
    const updated = [...columns];
    updated[index] = { ...updated[index], label };
    setColumns(updated);
  };

  const moveColumn = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;
    const updated = [...columns];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setColumns(updated);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    if (columns.some((c) => !c.label.trim())) {
      toast.error("All columns must have labels");
      return;
    }

    setLoading(true);
    try {
      // Regenerate keys to ensure consistency
      const finalColumns = columns.map((col, index) => ({
        key: `col_${index + 1}`,
        label: col.label.trim(),
      }));

      if (isEdit && list) {
        const { error } = await supabase
          .from("top_10_lists")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            columns: finalColumns,
          })
          .eq("id", list.id);

        if (error) throw error;
        toast.success("List updated successfully");
      } else {
        const { error } = await supabase.from("top_10_lists").insert({
          department_id: departmentId,
          title: title.trim(),
          description: description.trim() || null,
          columns: finalColumns,
          display_order: existingListCount + 1,
        });

        if (error) throw error;
        toast.success("List created successfully");
      }

      onListChange();
      setOpen(false);
    } catch (error: any) {
      console.error("Error saving list:", error);
      toast.error(error.message || "Failed to save list");
    } finally {
      setLoading(false);
    }
  };

  const canAddList = !isEdit && existingListCount < maxLists;

  const renderChooseMode = () => (
    <div className="grid gap-4 py-4">
      <p className="text-sm text-muted-foreground">How would you like to create your list?</p>
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          className="h-24 flex-col gap-2"
          onClick={() => setMode("template")}
        >
          <LayoutTemplate className="h-8 w-8 text-primary" />
          <span>From Template</span>
        </Button>
        <Button
          variant="outline"
          className="h-24 flex-col gap-2"
          onClick={() => setMode("custom")}
        >
          <FileText className="h-8 w-8 text-muted-foreground" />
          <span>Custom List</span>
        </Button>
      </div>
    </div>
  );

  const renderTemplateMode = () => (
    <div className="grid gap-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Select a template to use:</p>
        <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
          Back
        </Button>
      </div>
      {loadingTemplates ? (
        <div className="text-center py-4 text-muted-foreground">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <p>No templates available for this department type.</p>
          <Button variant="link" onClick={() => setMode("custom")} className="mt-2">
            Create a custom list instead
          </Button>
        </div>
      ) : (
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="w-full text-left p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="font-medium">{template.title}</div>
                {template.description && (
                  <div className="text-sm text-muted-foreground mt-1">{template.description}</div>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {template.columns.length} columns: {template.columns.map(c => c.label).join(", ")}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );

  const renderCustomMode = () => (
    <div className="grid gap-4 py-4">
      {!isEdit && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setMode("choose")}>
            Back
          </Button>
        </div>
      )}
      <div className="grid gap-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Top 10 Oldest RO's"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this list..."
          rows={2}
        />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Columns ({columns.length}/{maxColumns})</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addColumn}
            disabled={columns.length >= maxColumns}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Column
          </Button>
        </div>

        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {columns.map((col, index) => (
            <div key={col.key} className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => moveColumn(index, "up")}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => moveColumn(index, "down")}
                  disabled={index === columns.length - 1}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={col.label}
                onChange={(e) => updateColumnLabel(index, e.target.value)}
                placeholder={`Column ${index + 1} label`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => removeColumn(index)}
                disabled={columns.length <= 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={!canAddList}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add List
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit List" : mode === "choose" ? "Add Top 10 List" : mode === "template" ? "Choose Template" : "Create List"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the list settings and column configuration."
              : mode === "choose"
              ? "Choose how you'd like to create your Top 10 list."
              : mode === "template"
              ? "Select a pre-configured template to get started quickly."
              : "Configure your Top 10 list with custom columns."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && !isEdit && renderChooseMode()}
        {mode === "template" && !isEdit && renderTemplateMode()}
        {(mode === "custom" || isEdit) && renderCustomMode()}

        {(mode === "custom" || isEdit) && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
