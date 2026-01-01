import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Info } from "lucide-react";

interface QuestionAnswer {
  questionNumber: number;
  questionText: string;
  answerValue: string | null;
}

interface SubMetricQuestionTooltipProps {
  subMetricName: string;
  questions: QuestionAnswer[];
  children: React.ReactNode;
}

export const SubMetricQuestionTooltip: React.FC<SubMetricQuestionTooltipProps> = ({
  subMetricName,
  questions,
  children,
}) => {
  if (questions.length === 0) {
    return <>{children}</>;
  }

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {children}
          <Info className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
        </span>
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-80 p-3" 
        side="right" 
        align="start"
        sideOffset={8}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary">
              {subMetricName}
            </span>
            <span className="text-xs text-muted-foreground">
              Department Info
            </span>
          </div>
          <div className="space-y-2">
            {questions.map((qa) => (
              <div 
                key={qa.questionNumber} 
                className="border-l-2 border-primary/30 pl-2 py-1"
              >
                <div className="flex items-start gap-1.5">
                  <span className="inline-flex items-center justify-center min-w-[20px] h-4 px-1 text-[10px] font-semibold rounded bg-primary/10 text-primary flex-shrink-0">
                    Q{qa.questionNumber}
                  </span>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {qa.questionText}
                  </p>
                </div>
                <div className="mt-1 ml-5">
                  {qa.answerValue ? (
                    <p className="text-xs font-medium text-foreground">
                      {qa.answerValue}
                    </p>
                  ) : (
                    <p className="text-xs italic text-muted-foreground/60">
                      No answer provided
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
