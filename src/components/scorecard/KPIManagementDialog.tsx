import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Trash2, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
  target_direction: "above" | "below";
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface KPIManagementDialogProps {
  departmentId: string;
  kpis: KPI[];
  onKPIsChange: () => void;
}

export const KPIManagementDialog = ({ departmentId, kpis, onKPIsChange }: KPIManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [metricType, setMetricType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [targetValue, setTargetValue] = useState("");
  const [targetDirection, setTargetDirection] = useState<"above" | "below">("above");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }

    setProfiles(data || []);
  };

  const handleAddKPI = async () => {
    if (!name || !targetValue) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const maxOrder = kpis.length > 0 ? Math.max(...kpis.map(k => k.display_order)) : 0;

    const { error } = await supabase
      .from("kpi_definitions")
      .insert({
        name,
        metric_type: metricType,
        target_value: parseFloat(targetValue),
        target_direction: targetDirection,
        department_id: departmentId,
        display_order: maxOrder + 1,
        assigned_to: assignedTo && assignedTo !== "unassigned" ? assignedTo : null,
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "KPI added successfully" });
    setName("");
    setTargetValue("");
    setTargetDirection("above");
    setAssignedTo("unassigned");
    onKPIsChange();
  };

  const handleUpdateOwner = async (kpiId: string, newOwnerId: string | null) => {
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ assigned_to: newOwnerId })
      .eq("id", kpiId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Owner updated successfully" });
    onKPIsChange();
  };

  const handleUpdateKPI = async (kpiId: string, field: string, value: any) => {
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ [field]: value })
      .eq("id", kpiId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    onKPIsChange();
  };

  const handleTargetBlur = async (kpiId: string) => {
    if (editingKpiId !== kpiId) return;
    
    const newValue = parseFloat(editingTargetValue);
    if (isNaN(newValue)) {
      toast({ title: "Error", description: "Please enter a valid number", variant: "destructive" });
      setEditingKpiId(null);
      return;
    }

    await handleUpdateKPI(kpiId, "target_value", newValue);
    toast({ title: "Success", description: "Target updated successfully" });
    setEditingKpiId(null);
  };

  const handleDeleteKPI = async (id: string) => {
    const { error } = await supabase
      .from("kpi_definitions")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "KPI deleted successfully" });
    setDeleteKpiId(null);
    onKPIsChange();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Manage KPIs
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage KPIs</DialogTitle>
            <DialogDescription>
              Add, edit, or remove KPIs for this department. Changes affect the scorecard immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-sm">Add New KPI</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <Label htmlFor="name">KPI Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Wholesale Sales"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Metric Type</Label>
                  <Select value={metricType} onValueChange={(v: any) => setMetricType(v)}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dollar">Dollar ($)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="unit">Unit Count</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target">Target Value</Label>
                  <Input
                    id="target"
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="10000"
                  />
                </div>
                <div>
                  <Label htmlFor="direction">Target Goal</Label>
                  <Select value={targetDirection} onValueChange={(v: any) => setTargetDirection(v)}>
                    <SelectTrigger id="direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Target</SelectItem>
                      <SelectItem value="below">Below Target</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="owner">Owner (Optional)</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger id="owner">
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">None</SelectItem>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddKPI} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add KPI
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Current KPIs ({kpis.length})</h3>
              {kpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No KPIs defined yet. Add your first KPI above.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {kpis.map((kpi) => {
                      const owner = profiles.find(p => p.id === kpi.assigned_to);
                      return (
                        <TableRow key={kpi.id}>
                          <TableCell>{kpi.display_order}</TableCell>
                          <TableCell className="font-medium">{kpi.name}</TableCell>
                          <TableCell className="capitalize">{kpi.metric_type}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {kpi.metric_type === "dollar" && <span>$</span>}
                              <Input
                                type="number"
                                className="h-8 w-24"
                                value={editingKpiId === kpi.id ? editingTargetValue : kpi.target_value}
                                onFocus={() => {
                                  setEditingKpiId(kpi.id);
                                  setEditingTargetValue(kpi.target_value.toString());
                                }}
                                onChange={(e) => setEditingTargetValue(e.target.value)}
                                onBlur={() => handleTargetBlur(kpi.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                              {kpi.metric_type === "percentage" && <span>%</span>}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            <Select
                              value={kpi.target_direction}
                              onValueChange={(value: "above" | "below") => handleUpdateKPI(kpi.id, "target_direction", value)}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="above">Above</SelectItem>
                                <SelectItem value="below">Below</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={kpi.assigned_to || "unassigned"}
                              onValueChange={(value) => handleUpdateOwner(kpi.id, value === "unassigned" ? null : value)}
                            >
                              <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder="Select owner" />
                              </SelectTrigger>
                              <SelectContent className="bg-popover z-50">
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {profiles.map((profile) => (
                                  <SelectItem key={profile.id} value={profile.id}>
                                    {profile.full_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteKpiId(kpi.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteKpiId} onOpenChange={() => setDeleteKpiId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete KPI?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this KPI and all associated scorecard entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteKpiId && handleDeleteKPI(deleteKpiId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
