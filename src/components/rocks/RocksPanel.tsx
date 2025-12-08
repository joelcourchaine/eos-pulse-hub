import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Trash2, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RockManagementDialog } from "./RockManagementDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Fireworks } from "@/components/ui/fireworks";

interface Rock {
  id: string;
  title: string;
  description: string | null;
  progress_percentage: number;
  status: "on_track" | "at_risk" | "off_track" | "completed";
  due_date: string | null;
  assigned_to: string | null;
  year: number;
  quarter: number;
  department_id: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "on_track":
      return "success";
    case "at_risk":
      return "warning";
    case "off_track":
      return "destructive";
    case "completed":
      return "default";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string) => {
  return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

interface RocksPanelProps {
  departmentId?: string;
}

const RocksPanel = ({ departmentId }: RocksPanelProps) => {
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRockId, setDeleteRockId] = useState<string | null>(null);
  const { toast } = useToast();
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.ceil((currentDate.getMonth() + 1) / 3);

  useEffect(() => {
    if (departmentId) {
      loadRocks();
    }
  }, [departmentId]);

  const loadRocks = async () => {
    if (!departmentId) return;
    
    setLoading(true);
    // Clear existing data to prevent stale data from showing
    setRocks([]);
    
    const { data, error } = await supabase
      .from("rocks")
      .select("*")
      .eq("department_id", departmentId)
      .eq("year", currentYear)
      .eq("quarter", currentQuarter)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading rocks:", error);
      toast({ title: "Error", description: "Failed to load rocks", variant: "destructive" });
    } else {
      setRocks((data || []) as Rock[]);
    }
    setLoading(false);
  };

  const handleDeleteRock = async (id: string) => {
    const { error } = await supabase
      .from("rocks")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Rock deleted successfully" });
      setDeleteRockId(null);
      loadRocks();
    }
  };

  if (!departmentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Rocks (Quarterly Priorities)
          </CardTitle>
          <CardDescription>
            Select a department to view rocks
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Rocks (Quarterly Priorities)
              </CardTitle>
              <CardDescription>
                Q{currentQuarter} {currentYear} - Focus on 3-5 key objectives
              </CardDescription>
            </div>
            <RockManagementDialog
              departmentId={departmentId}
              year={currentYear}
              quarter={currentQuarter}
              onRocksChange={loadRocks}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rocks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No rocks defined for this quarter. Add your first priority above.
            </p>
          ) : (
            <div className="space-y-6">
              {rocks.map((rock) => (
                <div
                  key={rock.id}
                  className="relative p-4 border rounded-lg hover:shadow-md transition-shadow overflow-hidden"
                >
                  {rock.progress_percentage >= 100 && (
                    <Fireworks />
                  )}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground mb-1">
                        {rock.title}
                      </h4>
                      {rock.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {rock.description}
                        </p>
                      )}
                      {rock.due_date && (
                        <p className="text-sm text-muted-foreground">
                          Due: {new Date(rock.due_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {rock.progress_percentage >= 100 ? (
                        <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0">
                          🏆 Goal Achieved!
                        </Badge>
                      ) : (
                        <Badge variant={getStatusColor(rock.status) as any}>
                          {getStatusLabel(rock.status)}
                        </Badge>
                      )}
                      <RockManagementDialog
                        departmentId={departmentId}
                        year={currentYear}
                        quarter={currentQuarter}
                        onRocksChange={loadRocks}
                        rock={rock}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteRockId(rock.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{rock.progress_percentage}%</span>
                    </div>
                    <Progress value={rock.progress_percentage} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRockId} onOpenChange={() => setDeleteRockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rock?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this rock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRockId && handleDeleteRock(deleteRockId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RocksPanel;
