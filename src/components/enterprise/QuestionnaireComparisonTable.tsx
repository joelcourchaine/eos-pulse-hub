import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, HelpCircle } from "lucide-react";

interface QuestionnaireAnswer {
  storeName: string;
  departmentName: string;
  departmentId: string;
  questionId: string;
  questionText: string;
  answerValue: string | null;
  answerType: string;
  questionCategory: string;
}

interface QuestionnaireComparisonTableProps {
  data: QuestionnaireAnswer[];
  selectedQuestions: string[];
  loading?: boolean;
}

export function QuestionnaireComparisonTable({ 
  data, 
  selectedQuestions,
  loading = false 
}: QuestionnaireComparisonTableProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No questionnaire data available for the selected stores and questions.
      </div>
    );
  }

  // Group data by store+department
  const storeMap = new Map<string, { storeName: string; departmentName: string; answers: Map<string, string | null> }>();
  
  data.forEach((item) => {
    const key = `${item.storeName}|${item.departmentName}`;
    if (!storeMap.has(key)) {
      storeMap.set(key, {
        storeName: item.storeName,
        departmentName: item.departmentName,
        answers: new Map(),
      });
    }
    storeMap.get(key)!.answers.set(item.questionText, item.answerValue);
  });

  // Get unique questions in order
  const uniqueQuestions = selectedQuestions.filter(q => 
    data.some(d => d.questionText === q)
  );

  // Convert to array for rendering
  const stores = Array.from(storeMap.values()).sort((a, b) => 
    a.storeName.localeCompare(b.storeName)
  );

  // Render answer value based on type
  const renderAnswer = (value: string | null, questionText: string) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-muted-foreground italic">—</span>;
    }

    // Check for yes/no type answers
    const lowerValue = value.toLowerCase().trim();
    if (lowerValue === 'yes' || lowerValue === 'true') {
      return (
        <span className="inline-flex items-center justify-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          Yes
        </span>
      );
    }
    if (lowerValue === 'no' || lowerValue === 'false') {
      return (
        <span className="inline-flex items-center justify-center gap-1 text-red-500">
          <XCircle className="h-4 w-4" />
          No
        </span>
      );
    }
    if (lowerValue === 'n/a' || lowerValue === 'na') {
      return (
        <span className="inline-flex items-center justify-center gap-1 text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
          N/A
        </span>
      );
    }

    // For longer text, truncate with title
    if (value.length > 50) {
      return (
        <span title={value} className="block max-w-[200px] truncate mx-auto">
          {value}
        </span>
      );
    }

    return value;
  };

  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="min-w-full">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[200px] font-bold">
                Question
              </TableHead>
              {stores.map((store) => (
                <TableHead 
                  key={`${store.storeName}-${store.departmentName}`}
                  className="text-center min-w-[150px]"
                >
                  <div className="font-bold">{store.storeName}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    {store.departmentName}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {uniqueQuestions.map((question) => (
              <TableRow key={question}>
                <TableCell className="sticky left-0 bg-background z-10 font-medium max-w-[300px]">
                  <span className="block truncate" title={question}>
                    {question}
                  </span>
                </TableCell>
                {stores.map((store) => (
                  <TableCell 
                    key={`${store.storeName}-${store.departmentName}-${question}`}
                    className="text-center"
                  >
                    {renderAnswer(store.answers.get(question) || null, question)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
