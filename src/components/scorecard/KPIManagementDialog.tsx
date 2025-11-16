import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, Trash2, GripVertical, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";

const PRESET_KPIS = [
  { name: "CP Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "Warranty Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "Internal Labour Sales", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "Total Service Gross", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "Total Service Gross %", metricType: "percentage" as const, targetDirection: "above" as const, dependencies: ["Total Service Gross"] },
  { name: "CP Hours", metricType: "unit" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "CP RO's", metricType: "unit" as const, targetDirection: "above" as const, dependencies: [] },
  { name: "CP Labour Sales Per RO", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: ["CP Labour Sales", "CP RO's"] },
  { name: "CP Hours Per RO", metricType: "unit" as const, targetDirection: "above" as const, dependencies: ["CP Hours", "CP RO's"] },
  { name: "CP ELR", metricType: "dollar" as const, targetDirection: "above" as const, dependencies: [] },
];

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
  year: number;
  quarter: number;
}

export const KPIManagementDialog = ({ departmentId, kpis, onKPIsChange, year, quarter }: KPIManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedKPIs, setSelectedKPIs] = useState<Set<string>>(new Set());
  const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editingTargetValue, setEditingTargetValue] = useState<string>("");
  const [editingName, setEditingName] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [draggedKpiId, setDraggedKpiId] = useState<string | null>(null);
  const [dragOverKpiId, setDragOverKpiId] = useState<string | null>(null);
  const [kpiTargets, setKpiTargets] = useState<{ [key: string]: number }>({});
  const [customKPIName, setCustomKPIName] = useState("");
  const [customKPIType, setCustomKPIType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [customKPIDirection, setCustomKPIDirection] = useState<"above" | "below">("above");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadKPITargets();
      // Initialize selected KPIs based on existing KPIs
      const existingKPINames = new Set(kpis.map(k => k.name));
      setSelectedKPIs(existingKPINames);
    }
  }, [open, kpis]);

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Filter out any profiles with invalid IDs
    setProfiles((data || []).filter(p => p.id && p.id.trim() !== ""));
  };

  const loadKPITargets = async () => {
    const { data, error } = await supabase
      .from("kpi_targets")
      .select("kpi_id, target_value")
      .in("kpi_id", kpis.map(k => k.id))
      .eq("quarter", quarter)
      .eq("year", year);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    const targetsMap: { [key: string]: number } = {};
    data?.forEach(target => {
      targetsMap[target.kpi_id] = target.target_value || 0;
    });
    setKpiTargets(targetsMap);
  };

  const handleKPIToggle = (kpiName: string, checked: boolean) => {
    const preset = PRESET_KPIS.find(p => p.name === kpiName);
    if (!preset) return;

    const newSelected = new Set(selectedKPIs);

    if (checked) {
      // Add the KPI
      newSelected.add(kpiName);
      // Auto-add dependencies
      preset.dependencies.forEach(dep => newSelected.add(dep));
    } else {
      // Check if any selected KPIs depend on this one
      const dependentKPIs = PRESET_KPIS.filter(p => 
        selectedKPIs.has(p.name) && p.dependencies.includes(kpiName)
      );

      if (dependentKPIs.length > 0) {
        toast({
          title: "Cannot remove KPI",
          description: `"${kpiName}" is required by: ${dependentKPIs.map(k => k.name).join(", ")}`,
          variant: "destructive"
        });
        return;
      }

      newSelected.delete(kpiName);
    }

    setSelectedKPIs(newSelected);
  };

  const handleApplyKPIs = async () => {
    // Get currently active KPI names
    const existingKPINames = new Set(kpis.map(k => k.name));
    
    // Find KPIs to add
    const kpisToAdd = Array.from(selectedKPIs).filter(name => !existingKPINames.has(name));
    
    // Find KPIs to remove
    const kpisToRemove = kpis.filter(k => !selectedKPIs.has(k.name));

    // Remove unchecked KPIs
    for (const kpi of kpisToRemove) {
      const { error } = await supabase
        .from("kpi_definitions")
        .delete()
        .eq("id", kpi.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    // Add new KPIs
    for (const kpiName of kpisToAdd) {
      const preset = PRESET_KPIS.find(p => p.name === kpiName);
      if (!preset) continue;

      const { error } = await supabase
        .from("kpi_definitions")
        .insert({
          name: preset.name,
          metric_type: preset.metricType,
          target_value: 0,
          target_direction: preset.targetDirection,
          department_id: departmentId,
          display_order: kpis.length + kpisToAdd.indexOf(kpiName) + 1
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
    }

    toast({ 
      title: "Success", 
      description: `Updated KPIs: ${kpisToAdd.length} added, ${kpisToRemove.length} removed` 
    });
    onKPIsChange();
  };

  const handleAddCustomKPI = async () => {
    if (!customKPIName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a KPI name",
        variant: "destructive"
      });
      return;
    }

    const { error } = await supabase
      .from("kpi_definitions")
      .insert({
        name: customKPIName.trim(),
        metric_type: customKPIType,
        target_value: 0,
        target_direction: customKPIDirection,
        department_id: departmentId,
        display_order: kpis.length + 1
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ 
      title: "Success", 
      description: "Custom KPI added successfully" 
    });
    
    // Reset form
    setCustomKPIName("");
    setCustomKPIType("dollar");
    setCustomKPIDirection("above");
    
    onKPIsChange();
  };

  const handleUpdateKPI = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ [field]: value })
      .eq("id", id);

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

    const { error } = await supabase
      .from("kpi_targets")
      .upsert({
        kpi_id: kpiId,
        quarter,
        year,
        target_value: newValue,
      }, {
        onConflict: "kpi_id,quarter,year"
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setEditingKpiId(null);
      return;
    }

    toast({ title: "Success", description: "Target updated successfully" });
    setEditingKpiId(null);
    loadKPITargets();
  };

  const handleNameBlur = async (kpiId: string) => {
    if (editingKpiId !== kpiId || !editingName.trim()) return;
    
    await handleUpdateKPI(kpiId, "name", editingName.trim());
    toast({ title: "Success", description: "Name updated successfully" });
    setEditingKpiId(null);
  };

  const handleDragStart = (e: React.DragEvent, kpiId: string) => {
    setDraggedKpiId(kpiId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, kpiId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKpiId(kpiId);
  };

  const handleDragLeave = () => {
    setDragOverKpiId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetKpiId: string) => {
    e.preventDefault();
    setDragOverKpiId(null);
    
    if (!draggedKpiId || draggedKpiId === targetKpiId) {
      setDraggedKpiId(null);
      return;
    }

    const draggedIndex = kpis.findIndex(k => k.id === draggedKpiId);
    const targetIndex = kpis.findIndex(k => k.id === targetKpiId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedKpiId(null);
      return;
    }

    const reorderedKpis = [...kpis];
    const [removed] = reorderedKpis.splice(draggedIndex, 1);
    reorderedKpis.splice(targetIndex, 0, removed);

    const updates = reorderedKpis.map((kpi, index) => ({
      id: kpi.id,
      display_order: index + 1
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from("kpi_definitions")
        .update({ display_order: update.display_order })
        .eq("id", update.id);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setDraggedKpiId(null);
        return;
      }
    }

    toast({ title: "Success", description: "KPI order updated successfully" });
    setDraggedKpiId(null);
    onKPIsChange();
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

  const isKPIDependency = (kpiName: string) => {
    return PRESET_KPIS.some(p => 
      selectedKPIs.has(p.name) && p.dependencies.includes(kpiName)
    );
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
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage KPIs</DialogTitle>
            <DialogDescription>
              Select KPIs to track for this department. Dependencies will be automatically selected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* KPI Selection */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Select KPIs</h3>
                <Button onClick={handleApplyKPIs} size="sm">
                  Apply Changes
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PRESET_KPIS.map((preset) => {
                  const isSelected = selectedKPIs.has(preset.name);
                  const isDependency = isKPIDependency(preset.name);
                  
                  return (
                    <div 
                      key={preset.name}
                      className={`flex items-start space-x-3 p-3 rounded-lg border ${
                        isDependency ? 'bg-muted/50 border-primary/30' : 'hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        id={preset.name}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleKPIToggle(preset.name, checked as boolean)}
                        disabled={isDependency}
                      />
                      <div className="flex-1">
                        <Label 
                          htmlFor={preset.name}
                          className={`text-sm font-medium cursor-pointer ${
                            isDependency ? 'text-muted-foreground' : ''
                          }`}
                        >
                          {preset.name}
                        </Label>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {preset.metricType === "dollar" ? "$" : preset.metricType === "percentage" ? "%" : "units"}
                          {preset.dependencies.length > 0 && (
                            <span className="ml-2">
                              • Requires: {preset.dependencies.join(", ")}
                            </span>
                          )}
                          {isDependency && (
                            <span className="ml-2 text-primary">
                              • Required by other KPI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom KPI Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-sm">Add Custom KPI</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="custom-name">KPI Name</Label>
                  <Input
                    id="custom-name"
                    value={customKPIName}
                    onChange={(e) => setCustomKPIName(e.target.value)}
                    placeholder="e.g., Customer Satisfaction"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-type">Metric Type</Label>
                  <Select value={customKPIType} onValueChange={(v: any) => setCustomKPIType(v)}>
                    <SelectTrigger id="custom-type">
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
                  <Label htmlFor="custom-direction">Target Goal</Label>
                  <Select value={customKPIDirection} onValueChange={(v: any) => setCustomKPIDirection(v)}>
                    <SelectTrigger id="custom-direction">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above Target</SelectItem>
                      <SelectItem value="below">Below Target</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddCustomKPI} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom KPI
                  </Button>
                </div>
              </div>
            </div>

            {/* Current KPIs Table */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Current KPIs ({kpis.length})</h3>
              {kpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No KPIs selected. Choose KPIs above to get started.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="min-w-[250px]">Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Q{quarter} Target</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {kpis.map((kpi) => {
                      const owner = profiles.find(p => p.id === kpi.assigned_to);
                      const isEditingThis = editingKpiId === kpi.id;
                      const isDragging = draggedKpiId === kpi.id;
                      const isDragOver = dragOverKpiId === kpi.id && !isDragging;
                      return (
                        <TableRow 
                          key={kpi.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, kpi.id)}
                          onDragOver={(e) => handleDragOver(e, kpi.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, kpi.id)}
                          className={`${isDragging ? "opacity-50" : "cursor-move"} ${isDragOver ? "border-t-2 border-primary" : ""}`}
                        >
                          <TableCell className="text-center">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 font-medium min-w-[250px]"
                              value={isEditingThis && editingName ? editingName : kpi.name}
                              onFocus={() => {
                                setEditingKpiId(kpi.id);
                                setEditingName(kpi.name);
                              }}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleNameBlur(kpi.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={kpi.metric_type || "dollar"}
                              onValueChange={(v) => handleUpdateKPI(kpi.id, "metric_type", v)}
                            >
                              <SelectTrigger className="h-8 w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dollar">Dollar ($)</SelectItem>
                                <SelectItem value="percentage">Percentage (%)</SelectItem>
                                <SelectItem value="unit">Unit Count</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              className="h-8 w-24"
                              value={isEditingThis ? editingTargetValue : (kpiTargets[kpi.id] ?? kpi.target_value)}
                              onFocus={() => {
                                setEditingKpiId(kpi.id);
                                setEditingTargetValue(String(kpiTargets[kpi.id] ?? kpi.target_value));
                              }}
                              onChange={(e) => setEditingTargetValue(e.target.value)}
                              onBlur={() => handleTargetBlur(kpi.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={kpi.target_direction || "above"}
                              onValueChange={(v) => handleUpdateKPI(kpi.id, "target_direction", v)}
                            >
                              <SelectTrigger className="h-8 w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="above">Above Target</SelectItem>
                                <SelectItem value="below">Below Target</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={kpi.assigned_to || "unassigned"}
                              onValueChange={(v) => handleUpdateKPI(kpi.id, "assigned_to", v === "unassigned" ? null : v)}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue placeholder="None" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">None</SelectItem>
                                {profiles.filter(p => p.id && p.id.trim() !== "").map((profile) => (
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
                              <Trash2 className="h-4 w-4" />
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this KPI and all associated scorecard data. This action cannot be undone.
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
