import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RoutineItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  report_info?: {
    type: "internal" | "external" | "manual";
    path?: string;
    instructions?: string;
  };
}

interface AddRoutineItemInlineProps {
  routineId: string;
  currentItems: RoutineItem[];
  onItemAdded: () => void;
}

export const AddRoutineItemInline = ({
  routineId,
  currentItems,
  onItemAdded,
}: AddRoutineItemInlineProps) => {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast({
        variant: "destructive",
        title: "Title required",
        description: "Please enter a task title",
      });
      return;
    }

    setSaving(true);
    try {
      // Create new item
      const newItem: RoutineItem = {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        description: "",
        order: currentItems.length + 1,
      };

      // Update the routine with new items array
      const updatedItems = [...currentItems, newItem];

      const { error } = await supabase
        .from("department_routines")
        .update({ items: updatedItems as unknown as any })
        .eq("id", routineId);

      if (error) throw error;

      toast({
        title: "Task added",
        description: `"${trimmedTitle}" has been added to this routine`,
      });

      setTitle("");
      setIsAdding(false);
      onItemAdded();
    } catch (error: any) {
      console.error("Error adding routine item:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add task",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setTitle("");
    }
  };

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground hover:text-foreground gap-2 h-8"
        onClick={() => setIsAdding(true)}
      >
        <Plus className="h-4 w-4" />
        Add task
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="h-8 text-sm"
      />
      <Button
        size="sm"
        onClick={handleAdd}
        disabled={saving || !title.trim()}
        className="h-8 px-3"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsAdding(false);
          setTitle("");
        }}
        disabled={saving}
        className="h-8 w-8 p-0"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
