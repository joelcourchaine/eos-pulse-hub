import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ClipboardList, Save, History, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_category: string;
  answer_type: string;
  display_order: number;
  answer_description: string | null;
  reference_image_url: string | null;
}

interface Answer {
  id?: string;
  question_id: string;
  answer_value: string | null;
}

interface HistoryEntry {
  id: string;
  question_text: string;
  previous_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by_name: string | null;
}

interface DepartmentQuestionnaireDialogProps {
  departmentId: string;
  departmentName: string;
  departmentTypeId?: string;
  managerEmail?: string;
}

export const DepartmentQuestionnaireDialog = ({
  departmentId,
  departmentName,
  departmentTypeId,
  managerEmail,
}: DepartmentQuestionnaireDialogProps) => {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadQuestionsAndAnswers();
      loadHistory();
    }
  }, [open, departmentId]);

  const loadQuestionsAndAnswers = async () => {
    try {
      // Load questions filtered by department type
      let query = supabase
        .from("department_questions")
        .select(`
          *,
          question_department_types!inner(department_type_id)
        `)
        .eq("is_active", true);

      if (departmentTypeId) {
        query = query.eq("question_department_types.department_type_id", departmentTypeId);
      }

      const { data: questionsData, error: questionsError } = await query.order("display_order");

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);

      // Load existing answers
      const { data: answersData, error: answersError } = await supabase
        .from("department_answers")
        .select("*")
        .eq("department_id", departmentId);

      if (answersError) throw answersError;

      // Convert answers array to object for easy access
      const answersMap: Record<string, string> = {};
      answersData?.forEach((answer) => {
        answersMap[answer.question_id] = answer.answer_value || "";
      });
      setAnswers(answersMap);
    } catch (error) {
      console.error("Error loading questions:", error);
      toast({
        title: "Error",
        description: "Failed to load questionnaire data.",
        variant: "destructive",
      });
    }
  };

  const loadHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("department_answer_history")
        .select(`
          id,
          previous_value,
          new_value,
          changed_at,
          question_id,
          department_questions!inner(question_text),
          changed_by,
          profiles!department_answer_history_changed_by_fkey(full_name)
        `)
        .eq("department_id", departmentId)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedHistory: HistoryEntry[] = data?.map((entry: any) => ({
        id: entry.id,
        question_text: entry.department_questions.question_text,
        previous_value: entry.previous_value,
        new_value: entry.new_value,
        changed_at: entry.changed_at,
        changed_by_name: entry.profiles?.full_name || "Unknown",
      })) || [];

      setHistory(formattedHistory);
    } catch (error) {
      console.error("Error loading history:", error);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upsert all answers
      const upsertPromises = questions.map(async (question) => {
        const answerValue = answers[question.id] || null;
        
        return supabase
          .from("department_answers")
          .upsert({
            department_id: departmentId,
            question_id: question.id,
            answer_value: answerValue,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "department_id,question_id",
          });
      });

      const results = await Promise.all(upsertPromises);
      const errors = results.filter((r) => r.error);
      
      if (errors.length > 0) {
        throw new Error("Some answers failed to save");
      }

      toast({
        title: "Success",
        description: "All answers have been saved successfully.",
      });

      // Reload history to show new changes
      await loadHistory();
    } catch (error) {
      console.error("Error saving answers:", error);
      toast({
        title: "Error",
        description: "Failed to save answers. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!managerEmail) {
      toast({
        title: "Error",
        description: "No manager email found for this department.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("send-questionnaire-email", {
        body: {
          departmentId,
          departmentName,
          managerEmail,
          questions,
        },
      });

      if (error) throw error;

      toast({
        title: "Email sent",
        description: `Questionnaire sent to ${managerEmail}`,
      });
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const groupedQuestions = questions.reduce((acc, question) => {
    if (!acc[question.question_category]) {
      acc[question.question_category] = [];
    }
    acc[question.question_category].push(question);
    return acc;
  }, {} as Record<string, Question[]>);

  const renderInput = (question: Question) => {
    const value = answers[question.id] || "";

    if (question.answer_type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => handleAnswerChange(question.id, e.target.value)}
          placeholder="Enter your answer..."
          className="min-h-[80px]"
        />
      );
    }

    return (
      <Input
        type={question.answer_type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => handleAnswerChange(question.id, e.target.value)}
        placeholder="Enter your answer..."
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList className="mr-2 h-4 w-4" />
          Department Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Department Information - {departmentName}</DialogTitle>
          <DialogDescription>
            Answer questions about your department. Changes are tracked automatically.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="questions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="questions">Questions</TabsTrigger>
            <TabsTrigger value="history">Change History</TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save All Answers"}
              </Button>
              {managerEmail && (
                <Button
                  variant="outline"
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  {isSendingEmail ? "Sending..." : "Email Questions"}
                </Button>
              )}
            </div>

            {Object.entries(groupedQuestions).map(([category, categoryQuestions]) => (
              <Collapsible key={category} defaultOpen>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg hover:bg-muted/80">
                  <h3 className="font-semibold">{category}</h3>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {categoryQuestions.map((question) => (
                    <div key={question.id} className="space-y-2">
                      <Label htmlFor={question.id}>{question.question_text}</Label>
                      {question.answer_description && (
                        <p className="text-sm text-muted-foreground">{question.answer_description}</p>
                      )}
                      {question.reference_image_url && (
                        <img
                          src={question.reference_image_url}
                          alt="Reference"
                          className="max-w-md rounded-lg border mb-2"
                        />
                      )}
                      {renderInput(question)}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {history.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No changes have been recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((entry) => (
                  <div key={entry.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{entry.question_text}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Changed by {entry.changed_by_name} on{" "}
                          {new Date(entry.changed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Previous:</p>
                        <p className="text-sm mt-1">{entry.previous_value || "(empty)"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">New:</p>
                        <p className="text-sm mt-1">{entry.new_value || "(empty)"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
