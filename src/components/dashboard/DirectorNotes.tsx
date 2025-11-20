import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { format, subMonths } from "date-fns";

interface DirectorNotesProps {
  departmentId: string;
  userRole: string;
}

export const DirectorNotes = ({ departmentId, userRole }: DirectorNotesProps) => {
  // Generate list of current month + 4 previous months
  const getAvailableMonths = () => {
    const months = [];
    for (let i = 0; i < 5; i++) {
      const date = subMonths(new Date(), i);
      months.push({
        value: format(date, "yyyy-MM"),
        label: format(date, "MMMM yyyy")
      });
    }
    return months;
  };

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [notes, setNotes] = useState("");
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const canEdit = userRole === "super_admin" || userRole === "store_gm";
  const availableMonths = getAvailableMonths();

  useEffect(() => {
    loadNotes();
  }, [departmentId, selectedMonth]);

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("director_notes")
        .select("*")
        .eq("department_id", departmentId)
        .eq("period_type", "monthly")
        .eq("period_date", selectedMonth)
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
            period_type: "monthly",
            period_date: selectedMonth,
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
                Add observations and suggestions for the selected month
              </CardDescription>
            </div>
            {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canEdit && (
                <Button onClick={handleSave} disabled={isSaving} size="sm">
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              )}
            </div>
            <div className="resize-y overflow-auto min-h-[200px] max-h-[800px] border rounded-md">
              <RichTextEditor
                value={notes}
                onChange={setNotes}
                placeholder="Enter your observations, suggestions, and recommendations. You can paste images directly here..."
                className="min-h-[200px] p-3"
              />
            </div>
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
