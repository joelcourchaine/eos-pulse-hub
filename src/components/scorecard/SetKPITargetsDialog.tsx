import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
  target_direction: "above" | "below";
}

interface SetKPITargetsDialogProps {
  departmentId: string;
  kpis: KPI[];
  currentYear: number;
  currentQuarter: number;
  onTargetsChange: () => void;
}

export const SetKPITargetsDialog = ({ 
  departmentId, 
  kpis, 
  currentYear, 
  currentQuarter,
  onTargetsChange 
}: SetKPITargetsDialogProps) => {
  const [open, setOpen] = useState(false);
  const [targetYear, setTargetYear] = useState(currentYear);
  const [targetType, setTargetType] = useState<"weekly" | "monthly">("weekly");
  const [editTargets, setEditTargets] = useState<{ [quarter: number]: { [kpiId: string]: string } }>({ 
    1: {}, 2: {}, 3: {}, 4: {} 
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadTargets();
    }
  }, [open, targetYear, targetType, kpis]);

  const loadTargets = async () => {
    if (kpis.length === 0) return;

    const kpiIds = kpis.map(k => k.id);
    const { data, error } = await supabase
      .from("kpi_targets")
      .select("*")
      .in("kpi_id", kpiIds)
      .eq("year", targetYear)
      .eq("entry_type", targetType);

    if (error) {
      console.error("Error loading targets:", error);
      return;
    }

    const newTargets: { [quarter: number]: { [kpiId: string]: string } } = { 1: {}, 2: {}, 3: {}, 4: {} };
    
    data?.forEach(target => {
      newTargets[target.quarter][target.kpi_id] = String(target.target_value || "");
    });

    // Fill in default values for KPIs without quarterly targets
    kpis.forEach(kpi => {
      [1, 2, 3, 4].forEach(q => {
        if (!newTargets[q][kpi.id]) {
          newTargets[q][kpi.id] = String(kpi.target_value || "");
        }
      });
    });

    setEditTargets(newTargets);
  };

  const handleSaveTargets = async () => {
    const updates = [];

    for (const q of [1, 2, 3, 4]) {
      for (const kpi of kpis) {
        const value = editTargets[q]?.[kpi.id];
        if (value && value !== "") {
          updates.push({
            kpi_id: kpi.id,
            quarter: q,
            year: targetYear,
            entry_type: targetType,
            target_value: parseFloat(value),
          });
        }
      }
    }

    if (updates.length > 0) {
      const { error } = await supabase
        .from("kpi_targets")
        .upsert(updates);

      if (error) {
        console.error("Target save error:", error);
        toast({
          title: "Error",
          description: "Failed to save targets",
          variant: "destructive",
        });
        return;
      }
    }

    toast({ title: "Success", description: "KPI targets saved successfully" });
    onTargetsChange();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Set Targets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Set KPI Targets</DialogTitle>
          <DialogDescription>
            Define target values for each KPI by quarter
          </DialogDescription>
        </DialogHeader>
        
        <div className="mb-4 flex gap-4">
          <div>
            <Label htmlFor="target-year">Target Year</Label>
            <Select
              value={targetYear.toString()}
              onValueChange={(value) => setTargetYear(parseInt(value))}
            >
              <SelectTrigger id="target-year" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={(currentYear - 1).toString()}>{currentYear - 1} (Last Year)</SelectItem>
                <SelectItem value={currentYear.toString()}>{currentYear} (Current Year)</SelectItem>
                <SelectItem value={(currentYear + 1).toString()}>{currentYear + 1} (Next Year)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="target-type">Target Type</Label>
            <Select
              value={targetType}
              onValueChange={(value: "weekly" | "monthly") => setTargetType(value)}
            >
              <SelectTrigger id="target-type" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly Targets</SelectItem>
                <SelectItem value="monthly">Monthly Targets</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">KPI</TableHead>
                <TableHead className="text-center">Q1</TableHead>
                <TableHead className="text-center">Q2</TableHead>
                <TableHead className="text-center">Q3</TableHead>
                <TableHead className="text-center">Q4</TableHead>
                <TableHead className="w-[100px] text-center">Type</TableHead>
                <TableHead className="w-[140px]">Goal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis.map((kpi) => (
                <TableRow key={kpi.id}>
                  <TableCell className="font-medium">
                    {kpi.name}
                  </TableCell>
                  {[1, 2, 3, 4].map((q) => (
                    <TableCell key={q}>
                      <div className="flex items-center justify-center gap-1">
                        {kpi.metric_type === "dollar" && (
                          <span className="text-muted-foreground text-sm">$</span>
                        )}
                        <Input
                          type="number"
                          step="any"
                          value={editTargets[q]?.[kpi.id] || ""}
                          onChange={(e) => {
                            setEditTargets(prev => ({ 
                              ...prev, 
                              [q]: { ...prev[q], [kpi.id]: e.target.value }
                            }));
                          }}
                          placeholder="-"
                          className="text-center w-24"
                        />
                        {kpi.metric_type === "percentage" && (
                          <span className="text-muted-foreground text-sm">%</span>
                        )}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="text-center">
                    <span className="text-xs">
                      {kpi.metric_type === "dollar" ? "$" : kpi.metric_type === "percentage" ? "%" : "units"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {kpi.target_direction === "above" ? "Higher is Better" : "Lower is Better"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveTargets}>
            Save Targets
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
