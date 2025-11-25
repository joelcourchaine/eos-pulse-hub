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
import { useUserRole } from "@/hooks/use-user-role";

interface PresetKPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_direction: "above" | "below";
  dependencies: string[];
  display_order: number;
}

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
  const [deleteKpiId, setDeleteKpiId] = useState<string | null>(null);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [draggedKpiId, setDraggedKpiId] = useState<string | null>(null);
  const [dragOverKpiId, setDragOverKpiId] = useState<string | null>(null);
  const [customKPIName, setCustomKPIName] = useState("");
  const [customKPIType, setCustomKPIType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [customKPIDirection, setCustomKPIDirection] = useState<"above" | "below">("above");
  const [addingPresetKpi, setAddingPresetKpi] = useState<string | null>(null);
  const [presetKpis, setPresetKpis] = useState<PresetKPI[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetType, setNewPresetType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [newPresetDirection, setNewPresetDirection] = useState<"above" | "below">("above");
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const { toast } = useToast();
  
  const { isSuperAdmin } = useUserRole(userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadPresetKpis();
    }
  }, [open]);

  const loadPresetKpis = async () => {
    const { data, error } = await supabase
      .from("preset_kpis")
      .select("*")
      .order("display_order");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setPresetKpis((data || []) as PresetKPI[]);
  };

  const loadProfiles = async () => {
    // First get the store_id from the department
    const { data: departmentData, error: deptError } = await supabase
      .from("departments")
      .select("store_id")
      .eq("id", departmentId)
      .single();

    if (deptError) {
      toast({ title: "Error", description: deptError.message, variant: "destructive" });
      return;
    }

    // Then get profiles for that store only
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("store_id", departmentData.store_id)
      .order("full_name");

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    // Filter out any profiles with invalid IDs
    setProfiles((data || []).filter(p => p.id && p.id.trim() !== ""));
  };

  const handleAddPresetKPI = async (preset: PresetKPI) => {
    setAddingPresetKpi(preset.name);

    try {
      // Check if dependencies exist, add them first if needed
      for (const depName of preset.dependencies) {
        const dependencyExists = kpis.some(k => k.name === depName);
        if (!dependencyExists) {
          const depPreset = presetKpis.find(p => p.name === depName);
          if (depPreset) {
            const { error: depError } = await supabase
              .from("kpi_definitions")
              .insert({
                name: depPreset.name,
                metric_type: depPreset.metric_type,
                target_value: 0,
                target_direction: depPreset.target_direction,
                department_id: departmentId,
                display_order: kpis.length + 1
              });

            if (depError) {
              toast({ title: "Error", description: `Failed to add dependency: ${depName}`, variant: "destructive" });
              setAddingPresetKpi(null);
              return;
            }
          }
        }
      }

      // Add the main KPI
      const { error } = await supabase
        .from("kpi_definitions")
        .insert({
          name: preset.name,
          metric_type: preset.metric_type,
          target_value: 0,
          target_direction: preset.target_direction,
          department_id: departmentId,
          display_order: kpis.length + preset.dependencies.length + 1
        });

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setAddingPresetKpi(null);
        return;
      }

      toast({ 
        title: "Success", 
        description: `Added "${preset.name}" KPI` 
      });
      onKPIsChange();
    } finally {
      setAddingPresetKpi(null);
    }
  };

  const handleAddNewPreset = async () => {
    if (!newPresetName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a preset name",
        variant: "destructive"
      });
      return;
    }

    setIsAddingPreset(true);

    const { error } = await supabase
      .from("preset_kpis")
      .insert({
        name: newPresetName.trim(),
        metric_type: newPresetType,
        target_direction: newPresetDirection,
        dependencies: [],
        display_order: presetKpis.length + 1
      });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsAddingPreset(false);
      return;
    }

    toast({ 
      title: "Success", 
      description: "New preset KPI added successfully" 
    });
    
    // Reset form
    setNewPresetName("");
    setNewPresetType("dollar");
    setNewPresetDirection("above");
    setIsAddingPreset(false);
    
    loadPresetKpis();
  };

  const handleDeletePreset = async (presetId: string) => {
    const { error } = await supabase
      .from("preset_kpis")
      .delete()
      .eq("id", presetId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Preset KPI deleted successfully" });
    loadPresetKpis();
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
              Add KPIs to track for this department. You can add the same KPI multiple times with different owners.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Preset KPIs Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Add Preset KPIs</h3>
                  <p className="text-xs text-muted-foreground">You can add the same KPI multiple times with different owners</p>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium">Create New Preset (Super Admin)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <Label htmlFor="new-preset-name">Name</Label>
                      <Input
                        id="new-preset-name"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g., Total Parts Sales"
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-preset-type">Type</Label>
                      <Select value={newPresetType} onValueChange={(v: any) => setNewPresetType(v)}>
                        <SelectTrigger id="new-preset-type">
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
                      <Label htmlFor="new-preset-direction">Goal</Label>
                      <Select value={newPresetDirection} onValueChange={(v: any) => setNewPresetDirection(v)}>
                        <SelectTrigger id="new-preset-direction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="above">Above Target</SelectItem>
                          <SelectItem value="below">Below Target</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddNewPreset} 
                        disabled={isAddingPreset}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Preset
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presetKpis.map((preset) => {
                  const isAdding = addingPresetKpi === preset.name;
                  
                  return (
                    <div 
                      key={preset.id}
                      className="flex items-start justify-between p-3 rounded-lg border hover:bg-muted/30"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {preset.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Type: {preset.metric_type === "dollar" ? "$" : preset.metric_type === "percentage" ? "%" : "units"}
                          {preset.dependencies.length > 0 && (
                            <span className="ml-2">
                              • Requires: {preset.dependencies.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddPresetKPI(preset)}
                          disabled={isAdding}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePreset(preset.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
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
                      <TableHead>Goal</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {kpis.filter(kpi => kpi.metric_type && kpi.metric_type.trim() !== "" && kpi.target_direction && kpi.target_direction.trim() !== "").map((kpi) => {
                      const owner = profiles.find(p => p.id === kpi.assigned_to);
                      const isEditingThis = editingKpiId === kpi.id;
                      const isDragging = draggedKpiId === kpi.id;
                      const isDragOver = dragOverKpiId === kpi.id && !isDragging;
                      
                      // Ensure we have valid values with fallbacks
                      const safeMetricType = kpi.metric_type && kpi.metric_type.trim() !== "" ? kpi.metric_type : "dollar";
                      const safeTargetDirection = kpi.target_direction && kpi.target_direction.trim() !== "" ? kpi.target_direction : "above";
                      
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
                      {presetKpis.some(p => p.name === kpi.name) ? (
                              <div className="text-sm font-medium min-w-[250px] px-3 py-2">
                                {kpi.name}
                              </div>
                            ) : (
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
                            )}
                          </TableCell>
                          <TableCell>
                            {presetKpis.some(p => p.name === kpi.name) ? (
                              <div className="text-sm text-muted-foreground">
                                {safeMetricType === "dollar" ? "Dollar ($)" : safeMetricType === "percentage" ? "Percentage (%)" : "Unit Count"}
                              </div>
                            ) : (
                              <Select
                                value={safeMetricType}
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
                            )}
                          </TableCell>
                          <TableCell>
                            {presetKpis.some(p => p.name === kpi.name) ? (
                              <div className="text-sm text-muted-foreground">
                                {safeTargetDirection === "above" ? "Above Target" : "Below Target"}
                              </div>
                            ) : (
                              <Select
                                value={safeTargetDirection}
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
                            )}
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
