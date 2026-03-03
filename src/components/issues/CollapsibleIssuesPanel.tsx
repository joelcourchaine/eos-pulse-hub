import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, NotebookPen } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IssuesAndTodosPanel } from "./IssuesAndTodosPanel";
import { EmailTodosDialog } from "./EmailTodosDialog";

interface CollapsibleIssuesPanelProps {
  departmentId: string;
  userId?: string;
}

export function CollapsibleIssuesPanel({ departmentId, userId }: CollapsibleIssuesPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [expandAllNotes, setExpandAllNotes] = useState(false);

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    Issues & To-Dos
                  </CardTitle>
                  <CardDescription>
                    Track issues and action items for this department
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setExpandAllNotes(v => !v)}
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    {expandAllNotes ? "Collapse Notes" : "Expand Notes"}
                  </Button>
                  <EmailTodosDialog departmentId={departmentId} />
                </div>
              </div>
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <IssuesAndTodosPanel departmentId={departmentId} userId={userId} expandAllNotes={expandAllNotes} />
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
