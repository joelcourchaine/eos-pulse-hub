import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Edit2, X, Save } from "lucide-react";

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface CategoryManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChanged?: () => void;
}

export const CategoryManagementDialog = ({
  open,
  onOpenChange,
  onCategoriesChanged,
}: CategoryManagementDialogProps) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("question_categories")
        .select("*")
        .order("display_order");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    try {
      const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.display_order), -1);
      const { error } = await supabase
        .from("question_categories")
        .insert({
          name: newCategoryName.trim(),
          display_order: maxOrder + 1,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category added successfully.",
      });

      setNewCategoryName("");
      await loadCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      console.error("Error adding category:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") 
          ? "A category with this name already exists." 
          : "Failed to add category.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("question_categories")
        .update({ name: editingName.trim() })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category updated successfully.",
      });

      setEditingId(null);
      setEditingName("");
      await loadCategories();
      onCategoriesChanged?.();
    } catch (error: any) {
      console.error("Error updating category:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate")
          ? "A category with this name already exists."
          : "Failed to update category.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"?`)) return;

    try {
      const { error } = await supabase
        .from("question_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });

      await loadCategories();
      onCategoriesChanged?.();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category. It may be in use by existing questions.",
        variant: "destructive",
      });
    }
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Question Categories</DialogTitle>
          <DialogDescription>
            Add, edit, or remove categories for organizing department questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add new category */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="new-category">New Category</Label>
              <Input
                id="new-category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                }}
              />
            </div>
            <Button onClick={handleAdd} className="mt-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Existing categories */}
          <div className="space-y-2">
            <Label>Existing Categories</Label>
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No categories yet. Add one above.
                </div>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="p-3 flex items-center gap-2">
                    {editingId === category.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate(category.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(category.id)}
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{category.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEdit(category)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(category.id, category.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
