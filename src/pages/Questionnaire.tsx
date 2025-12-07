import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: string;
  question_text: string;
  answer_type: string;
  answer_description: string | null;
  reference_image_url: string | null;
}

interface Answer {
  question_id: string;
  answer_value: string | null;
}

export default function Questionnaire() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [departmentName, setDepartmentName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tokenValid, setTokenValid] = useState(true);

  useEffect(() => {
    loadQuestionnaire();
  }, [token]);

  const loadQuestionnaire = async () => {
    if (!token) {
      setTokenValid(false);
      setLoading(false);
      return;
    }

    try {
      // Verify token and get department
      const { data: tokenData, error: tokenError } = await supabase
        .from("questionnaire_tokens")
        .select(`
          department_id,
          expires_at,
          departments (
            id,
            name,
            department_type_id
          )
        `)
        .eq("token", token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        setTokenValid(false);
        setLoading(false);
        return;
      }

      // Check if token is expired
      if (new Date(tokenData.expires_at) < new Date()) {
        setTokenValid(false);
        setLoading(false);
        return;
      }

      const department = tokenData.departments as any;
      setDepartmentName(department.name);

      // Load questions for this department type
      const { data: questionsData, error: questionsError } = await supabase
        .from("department_questions")
        .select("*")
        .eq("is_active", true)
        .order("display_order");

      console.log("Questions lookup result:", { questionsData, questionsError });

      if (questionsError) {
        console.error("Questions error:", questionsError);
        throw questionsError;
      }

      // Load existing answers
      const { data: answersData, error: answersError } = await supabase
        .from("department_answers")
        .select("question_id, answer_value")
        .eq("department_id", department.id);

      console.log("Answers lookup result:", { answersData, answersError });

      // Convert answers array to object
      const answersMap: Record<string, string> = {};
      answersData?.forEach((answer: Answer) => {
        answersMap[answer.question_id] = answer.answer_value || "";
      });

      setQuestions(questionsData || []);
      setAnswers(answersMap);
    } catch (error) {
      console.error("Error loading questionnaire:", error);
      toast.error("Failed to load questionnaire");
      setTokenValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Prepare answers for the edge function
      const answerUpdates = Object.entries(answers).map(([questionId, value]) => ({
        question_id: questionId,
        answer_value: value || null,
      }));

      // Submit via edge function which validates the token server-side
      const { data, error } = await supabase.functions.invoke('questionnaire-submit', {
        body: {
          token,
          answers: answerUpdates,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
      toast.success("Questionnaire submitted successfully!");
    } catch (error) {
      console.error("Error submitting questionnaire:", error);
      toast.error("Failed to submit questionnaire");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid or Expired Link</CardTitle>
            <CardDescription>
              This questionnaire link is no longer valid. Please contact your administrator for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <CardTitle>Thank You!</CardTitle>
            </div>
            <CardDescription>
              Your responses have been saved successfully. You can close this page or submit again to update your answers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setSubmitted(false)} variant="outline" className="w-full">
              Edit My Answers
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Department Questionnaire</CardTitle>
            <CardDescription>
              {departmentName} - Please answer the following questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-2">
                  <label className="text-sm font-medium">
                    {index + 1}. {question.question_text}
                  </label>
                  {question.answer_description && (
                    <p className="text-xs text-muted-foreground">{question.answer_description}</p>
                  )}
                  {question.reference_image_url && (
                    <img 
                      src={question.reference_image_url} 
                      alt="Reference" 
                      className="mt-2 max-w-md rounded-lg border border-border"
                    />
                  )}
                  
                  {question.answer_type === "textarea" ? (
                    <Textarea
                      value={answers[question.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      placeholder="Enter your answer..."
                      rows={4}
                    />
                  ) : question.answer_type === "number" ? (
                    <Input
                      type="number"
                      value={answers[question.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      placeholder="Enter a number..."
                    />
                  ) : (
                    <Input
                      type="text"
                      value={answers[question.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
                      placeholder="Enter your answer..."
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-4 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Answers"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}