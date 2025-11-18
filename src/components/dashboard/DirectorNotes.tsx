import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DirectorNotesProps {
  departmentId: string;
  periodType: "monthly" | "quarterly" | "yearly";
  periodDate: string; // e.g., "2025-11", "Q4-2025", "2025"
  userRole: string;
}

export const DirectorNotes = ({ departmentId, periodType, periodDate, userRole }: DirectorNotesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const canEdit = userRole === "super_admin" || userRole === "store_gm";

  useEffect(() => {
    loadNotes();
  }, [departmentId, periodType, periodDate]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("director_notes")
        .select("*")
        .eq("department_id", departmentId)
        .eq("period_type", periodType)
        .eq("period_date", periodDate)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setNotes(data.notes || "");
        setExistingNoteId(data.id);
      } else {
        setNotes("");
        setExistingNoteId(null);
      }
    } catch (error) {
      console.error("Error loading director notes:", error);
    }
  };

  const handleSave = async () => {
    if (!canEdit) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      if (existingNoteId) {
        // Update existing note
        const { error } = await supabase
          .from("director_notes")
          .update({
            notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingNoteId);

        if (error) throw error;
      } else {
        // Create new note
        const { data, error } = await supabase
          .from("director_notes")
          .insert({
            department_id: departmentId,
            period_type: periodType,
            period_date: periodDate,
            notes,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw error;
        setExistingNoteId(data.id);
      }

      toast({
        title: "Notes saved",
        description: "Director's notes have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving director notes:", error);
      toast({
        title: "Error",
        description: "Failed to save director notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
          <CollapsibleTrigger className="flex items-center justify-between w-full">
            <div className="flex flex-col items-start">
              <CardTitle className="text-lg">Director's Notes</CardTitle>
              <CardDescription>
                Add observations and suggestions for this {periodType} period
              </CardDescription>
            </div>
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter your observations, suggestions, and recommendations for this period..."
              className="min-h-[120px]"
              disabled={!canEdit}
            />
            {canEdit && (
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save Notes"}
                </Button>
              </div>
            )}
            {!canEdit && (
              <p className="text-sm text-muted-foreground">
                Only Store GMs and Super Admins can edit director notes.
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
