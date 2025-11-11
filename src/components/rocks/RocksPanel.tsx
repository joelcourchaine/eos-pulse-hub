import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Plus } from "lucide-react";

interface Rock {
  id: string;
  title: string;
  progress: number;
  status: "on_track" | "at_risk" | "off_track";
  dueDate: string;
}

const mockRocks: Rock[] = [
  {
    id: "1",
    title: "Reduce Parts Personnel Expense to 35% by Q4 2025",
    progress: 65,
    status: "on_track",
    dueDate: "Dec 31, 2025",
  },
  {
    id: "2",
    title: "Implement new inventory management system",
    progress: 40,
    status: "at_risk",
    dueDate: "Dec 15, 2025",
  },
  {
    id: "3",
    title: "Increase wholesale sales by 20%",
    progress: 75,
    status: "on_track",
    dueDate: "Dec 31, 2025",
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "on_track":
      return "success";
    case "at_risk":
      return "warning";
    case "off_track":
      return "destructive";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string) => {
  return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const RocksPanel = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Rocks (Quarterly Priorities)
            </CardTitle>
            <CardDescription>
              Q4 2025 - Focus on 3-5 key objectives
            </CardDescription>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rock
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {mockRocks.map((rock) => (
            <div
              key={rock.id}
              className="p-4 border rounded-lg hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    {rock.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Due: {rock.dueDate}
                  </p>
                </div>
                <Badge variant={getStatusColor(rock.status) as any}>
                  {getStatusLabel(rock.status)}
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{rock.progress}%</span>
                </div>
                <Progress value={rock.progress} className="h-2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RocksPanel;
