import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";

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
  { id: "todos", title: "To-Dos Review", duration: "5 min", description: "Action items status" },
  { id: "issues", title: "Issues List (IDS)", duration: "15 min", description: "Identify, Discuss, Solve" },
  { id: "conclude", title: "Conclude", duration: "5 min", description: "Recap and ratings" },
];

const MeetingFramework = () => {
  const [notes, setNotes] = useState<{ [key: string]: string }>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">GO Meeting Framework</CardTitle>
        <CardDescription>
          Structured 60-minute weekly meeting agenda
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="segue" className="w-full">
          <TabsList className="grid grid-cols-4 lg:grid-cols-7 gap-2 h-auto bg-transparent p-0">
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
          {meetingSections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{section.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <Textarea
                  placeholder={`Add notes for ${section.title.toLowerCase()}...`}
                  value={notes[section.id] || ""}
                  onChange={(e) =>
                    setNotes({ ...notes, [section.id]: e.target.value })
                  }
                  className="min-h-[200px]"
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default MeetingFramework;
