import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface QuestionAnswer {
  questionId: string;
  questionNumber: number; // display_order for display purposes
  questionText: string;
  answerValue: string | null;
}

// Mapping of sub-metric names to question UUIDs (stable - never changes regardless of display_order)
// Add mappings here as needed
const SUB_METRIC_QUESTION_MAP: Record<string, string[]> = {
  "Tools & Supplies": [
    "a8c8878d-0d10-4045-9571-b813411d4db8", // Shop Supplies Labour Calculation
    "1d287b03-446c-401e-968d-7ddab314d6d1", // What is your max shop supplies amount?
    "eca6c439-9e54-43f0-ab51-1433c573b078", // Do you charge shop supplies based on parts?
  ],
  "Shop Supplies": [
    "a8c8878d-0d10-4045-9571-b813411d4db8", // Shop Supplies Labour Calculation
    "1d287b03-446c-401e-968d-7ddab314d6d1", // What is your max shop supplies amount?
    "eca6c439-9e54-43f0-ab51-1433c573b078", // Do you charge shop supplies based on parts?
  ],
  // Add more mappings as needed
};

export function useSubMetricQuestions(departmentId: string | undefined) {
  const { data: questionsAndAnswers, isLoading } = useQuery({
    queryKey: ["department-questions-answers", departmentId],
    queryFn: async () => {
      if (!departmentId) return null;

      // Fetch all questions
      const { data: questions, error: qError } = await supabase
        .from("department_questions")
        .select("id, question_text, display_order")
        .eq("is_active", true)
        .order("display_order");

      if (qError) throw qError;

      // Fetch answers for this department
      const { data: answers, error: aError } = await supabase
        .from("department_answers")
        .select("question_id, answer_value")
        .eq("department_id", departmentId);

      if (aError) throw aError;

      // Create a map of question_id -> answer_value
      const answerMap = new Map<string, string | null>();
      answers?.forEach((a) => {
        answerMap.set(a.question_id, a.answer_value);
      });

      // Create a map of question UUID -> { questionText, answerValue, displayOrder }
      const questionMap = new Map<string, { questionText: string; answerValue: string | null; displayOrder: number }>();
      questions?.forEach((q) => {
        questionMap.set(q.id, {
          questionText: q.question_text,
          answerValue: answerMap.get(q.id) || null,
          displayOrder: q.display_order,
        });
      });

      return questionMap;
    },
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Get questions for a specific sub-metric
  const getQuestionsForSubMetric = (subMetricName: string): QuestionAnswer[] => {
    if (!questionsAndAnswers) return [];

    const questionIds = SUB_METRIC_QUESTION_MAP[subMetricName];
    if (!questionIds) return [];

    return questionIds
      .map((id) => {
        const qa = questionsAndAnswers.get(id);
        if (!qa) return null;
        return {
          questionId: id,
          questionNumber: qa.displayOrder,
          questionText: qa.questionText,
          answerValue: qa.answerValue,
        };
      })
      .filter((qa): qa is QuestionAnswer => qa !== null);
  };

  // Check if a sub-metric has associated questions
  const hasQuestionsForSubMetric = (subMetricName: string): boolean => {
    return !!SUB_METRIC_QUESTION_MAP[subMetricName];
  };

  return {
    getQuestionsForSubMetric,
    hasQuestionsForSubMetric,
    isLoading,
  };
}

// Export the mapping so it can be extended from outside if needed
export { SUB_METRIC_QUESTION_MAP };
