import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface QuestionAnswer {
  questionNumber: number;
  questionText: string;
  answerValue: string | null;
}

// Mapping of sub-metric names to question display_order numbers
// Add mappings here as needed
const SUB_METRIC_QUESTION_MAP: Record<string, number[]> = {
  "Tools & Supplies": [12, 13, 14],
  "Shop Supplies": [12, 13, 14],
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

      // Create a map of display_order -> { questionText, answerValue }
      const questionMap = new Map<number, { questionText: string; answerValue: string | null }>();
      questions?.forEach((q) => {
        questionMap.set(q.display_order, {
          questionText: q.question_text,
          answerValue: answerMap.get(q.id) || null,
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

    const questionNumbers = SUB_METRIC_QUESTION_MAP[subMetricName];
    if (!questionNumbers) return [];

    return questionNumbers
      .map((num) => {
        const qa = questionsAndAnswers.get(num);
        if (!qa) return null;
        return {
          questionNumber: num,
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
