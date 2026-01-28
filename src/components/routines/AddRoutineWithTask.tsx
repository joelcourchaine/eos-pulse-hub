import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

const CADENCE_TITLES: Record<Cadence, string> = {
  daily: "Daily Tasks",
  weekly: "Weekly Tasks",
  monthly: "Monthly Tasks",
  quarterly: "Quarterly Tasks",
  yearly: "Yearly Tasks",
};

interface AddRoutineWithTaskProps {
  departmentId: string;
  cadence: Cadence;
  onRoutineCreated: () => void;
}

export const AddRoutineWithTask = ({
  departmentId,
  cadence,
  onRoutineCreated,
}: AddRoutineWithTaskProps) => {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
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
      const newItem = {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        description: "",
        order: 1,
      };

      const { error } = await supabase.from("department_routines").insert({
        department_id: departmentId,
        title: CADENCE_TITLES[cadence],
        cadence,
        items: [newItem],
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Routine created",
        description: `"${trimmedTitle}" has been added as your first ${cadence} task`,
      });

      setTitle("");
      setIsAdding(false);
      onRoutineCreated();
    } catch (error: any) {
      console.error("Error creating routine:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create routine",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
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
        className="mt-3 text-muted-foreground hover:text-foreground gap-2"
        onClick={() => setIsAdding(true)}
      >
        <Plus className="h-4 w-4" />
        Add task
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3 w-full max-w-xs">
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
        onClick={handleCreate}
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
