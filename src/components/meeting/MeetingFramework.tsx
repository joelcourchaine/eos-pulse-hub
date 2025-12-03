import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Clock, LayoutGrid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { IssuesAndTodosPanel } from "@/components/issues/IssuesAndTodosPanel";

export type MeetingViewMode = "view-all" | "segue" | "scorecard" | "rocks" | "headlines" | "issues-todos" | "conclude";

interface MeetingSection {
  id: string;
  title: string;
  duration: string;
  description: string;
}

const meetingSections: MeetingSection[] = [
  { id: "segue", title: "Segue", duration: "5 min", description: "Good news and wins" },
  { id: "scorecard", title: "Scorecard Review", duration: "15 min", description: "Review KPIs and trends" },
  { id: "rocks", title: "Rock Review", duration: "10 min", description: "Quarterly priorities update" },
  { id: "headlines", title: "Headlines", duration: "5 min", description: "People or customer updates" },
  { id: "issues-todos", title: "Issues & To-Dos", duration: "20 min", description: "IDS and action items" },
  { id: "conclude", title: "Conclude", duration: "5 min", description: "Recap and ratings" },
];

interface MeetingFrameworkProps {
  departmentId: string;
  onViewModeChange?: (mode: MeetingViewMode) => void;
}

const MeetingFramework = ({ departmentId, onViewModeChange }: MeetingFrameworkProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saveTimeouts, setSaveTimeouts] = useState<{ [key: string]: NodeJS.Timeout }>({});
  const [userId, setUserId] = useState<string>();
  const [activeTab, setActiveTab] = useState<string>("view-all");
  const meetingDate = format(new Date(), 'yyyy-MM-dd');

  // Notify parent when view mode changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    onViewModeChange?.(value as MeetingViewMode);
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  // Load existing notes from database
  useEffect(() => {
    const loadNotes = async () => {
      if (!departmentId) return;
      
      setLoading(true);
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('department_id', departmentId)
        .eq('meeting_date', meetingDate);

      if (error) {
        console.error('Error loading meeting notes:', error);
        toast({
          title: "Error loading notes",
          description: "Failed to load meeting notes",
          variant: "destructive"
        });
      } else if (data) {
        const notesMap: { [key: string]: string } = {};
        data.forEach(note => {
          notesMap[note.section] = note.notes || '';
        });
        setNotes(notesMap);
      }
      setLoading(false);
    };

    loadNotes();
  }, [departmentId, meetingDate]);

  // Save notes to database with debouncing
  const saveNote = async (section: string, content: string) => {
    if (!departmentId) return;

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Error saving note",
        description: "You must be logged in to save notes",
        variant: "destructive"
      });
      return;
    }

    const { data: existing, error: fetchError } = await supabase
      .from('meeting_notes')
      .select('id')
      .eq('department_id', departmentId)
      .eq('meeting_date', meetingDate)
      .eq('section', section)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing note:', fetchError);
      return;
    }

    if (existing) {
      // Update existing note
      const { error } = await supabase
        .from('meeting_notes')
        .update({ notes: content })
        .eq('id', existing.id);

      if (error) {
        console.error('Error updating note:', error);
        toast({
          title: "Error saving note",
          description: `Failed to save: ${error.message}`,
          variant: "destructive"
        });
      }
    } else {
      // Insert new note
      const { error } = await supabase
        .from('meeting_notes')
        .insert({
          department_id: departmentId,
          meeting_date: meetingDate,
          section: section,
          notes: content,
          created_by: user.id
        });

      if (error) {
        console.error('Error inserting note:', error);
        toast({
          title: "Error saving note",
          description: `Failed to save: ${error.message}`,
          variant: "destructive"
        });
      }
    }
  };

  // Debounced save handler
  const handleNoteChange = (section: string, content: string) => {
    setNotes(prev => ({ ...prev, [section]: content }));
    
    // Clear existing timeout for this section
    if (saveTimeouts[section]) {
      clearTimeout(saveTimeouts[section]);
    }
    
    // Debounce the save
    const timeoutId = setTimeout(() => {
      saveNote(section, content);
    }, 1000);
    
    setSaveTimeouts(prev => ({ ...prev, [section]: timeoutId }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">GO Meeting Framework</CardTitle>
        <CardDescription>
          Structured 60-minute weekly meeting agenda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-2 h-auto bg-transparent p-0">
            <TabsTrigger
              value="view-all"
              className="flex flex-col items-start p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <span className="font-medium text-sm flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" />
                View All
              </span>
              <Badge variant="secondary" className="mt-1 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                60 min
              </Badge>
            </TabsTrigger>
            {meetingSections.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="flex flex-col items-start p-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span className="font-medium text-sm">{section.title}</span>
                <Badge variant="secondary" className="mt-1 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {section.duration}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* View All shows the segue notes only - other sections are shown externally */}
          <TabsContent value="view-all" className="mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Segue</h3>
                <p className="text-sm text-muted-foreground">
                  Good news and wins
                </p>
              </div>
              <RichTextEditor
                placeholder="Add notes and images for segue..."
                value={notes["segue"] || ""}
                onChange={(value) => handleNoteChange("segue", value)}
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>
          
          {meetingSections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-6">
              {section.id === "issues-todos" ? (
                <IssuesAndTodosPanel departmentId={departmentId} userId={userId} />
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{section.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <RichTextEditor
                    placeholder={`Add notes and images for ${section.title.toLowerCase()}...`}
                    value={notes[section.id] || ""}
                    onChange={(value) => handleNoteChange(section.id, value)}
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MeetingFramework;
