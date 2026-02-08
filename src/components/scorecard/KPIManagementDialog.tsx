import { useState, useEffect } from "react";
import { getUserFriendlyError } from "@/lib/errorMessages";
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
  aggregation_type: "sum" | "average";
}

interface KPI {
  id: string;
  name: string;
  metric_type: "dollar" | "percentage" | "unit";
  target_value: number;
  display_order: number;
  assigned_to: string | null;
  target_direction: "above" | "below";
  aggregation_type: "sum" | "average";
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
  const [customKPIAggregation, setCustomKPIAggregation] = useState<"sum" | "average">("sum");
  const [addingPresetKpi, setAddingPresetKpi] = useState<string | null>(null);
  const [presetKpis, setPresetKpis] = useState<PresetKPI[]>([]);
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetType, setNewPresetType] = useState<"dollar" | "percentage" | "unit">("dollar");
  const [newPresetDirection, setNewPresetDirection] = useState<"above" | "below">("above");
  const [newPresetAggregation, setNewPresetAggregation] = useState<"sum" | "average">("sum");
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [selectedKpiIds, setSelectedKpiIds] = useState<Set<string>>(new Set());
  const [bulkAssignRole, setBulkAssignRole] = useState<"department_manager" | "sales_advisor" | "service_advisor" | "parts_advisor" | "technician" | "read_only" | "">("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [copyToUserId, setCopyToUserId] = useState<string>("");
  const [isCopyingToOwner, setIsCopyingToOwner] = useState(false);
  const { toast } = useToast();

  const { isSuperAdmin, isStoreGM, isDepartmentManager } = useUserRole(userId);

  const canBulkAssign = isSuperAdmin || isStoreGM || isDepartmentManager;

  const availableRoles = [
    { value: "department_manager", label: "Department Manager" },
    { value: "fixed_ops_manager", label: "Fixed Ops Manager" },
    { value: "sales_advisor", label: "Sales Advisor" },
    { value: "service_advisor", label: "Service Advisor" },
    { value: "parts_advisor", label: "Parts Advisor" },
    { value: "technician", label: "Technician" },
    { value: "read_only", label: "Read Only" },
  ];

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
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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

    const storeId = departmentData.store_id;

    // Get profiles directly assigned to this store
    const { data: directProfiles, error: directError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("store_id", storeId);

    if (directError) {
      toast({ title: "Error", description: directError.message, variant: "destructive" });
      return;
    }

    // Get users with multi-store access to this store
    const { data: storeAccessUsers } = await supabase
      .from("user_store_access")
      .select("user_id")
      .eq("store_id", storeId);

    const storeAccessUserIds = storeAccessUsers?.map(u => u.user_id) || [];

    // Fetch profiles for users with store access
    let accessProfiles: Profile[] = [];
    if (storeAccessUserIds.length > 0) {
      const { data: accessData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", storeAccessUserIds);

      accessProfiles = accessData || [];
    }

    // Combine and deduplicate profiles
    const allProfiles = [...(directProfiles || []), ...accessProfiles];
    const uniqueProfiles = allProfiles.filter((profile, index, self) =>
      profile.id && profile.id.trim() !== "" &&
      index === self.findIndex(p => p.id === profile.id)
    );

    setProfiles(uniqueProfiles.sort((a, b) => a.full_name.localeCompare(b.full_name)));
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
                aggregation_type: depPreset.aggregation_type,
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
          aggregation_type: preset.aggregation_type,
          department_id: departmentId,
          display_order: kpis.length + preset.dependencies.length + 1
        });

      if (error) {
        toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
        aggregation_type: newPresetAggregation,
        dependencies: [],
        display_order: presetKpis.length + 1
      });

    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
    setNewPresetAggregation("sum");
    setIsAddingPreset(false);

    loadPresetKpis();
  };

  const handleDeletePreset = async (presetId: string) => {
    const { error } = await supabase
      .from("preset_kpis")
      .delete()
      .eq("id", presetId);

    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
        aggregation_type: customKPIAggregation,
        department_id: departmentId,
        display_order: kpis.length + 1
      });

    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
    setCustomKPIAggregation("sum");

    onKPIsChange();
  };

  const handleUpdateKPI = async (id: string, field: string, value: any) => {
    const { error } = await supabase
      .from("kpi_definitions")
      .update({ [field]: value })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
        toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
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
      toast({ title: "Error", description: getUserFriendlyError(error), variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "KPI deleted successfully" });
    setDeleteKpiId(null);
    onKPIsChange();
  };

  const handleBulkAssignKPIsToRole = async () => {
    if (!bulkAssignRole || selectedKpiIds.size === 0) {
      toast({
        title: "Error",
        description: "Please select a role and at least one KPI",
        variant: "destructive"
      });
      return;
    }

    setIsBulkAssigning(true);

    try {
      // Get users with the selected role from this store
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", bulkAssignRole as any);

      if (rolesError) throw rolesError;

      // Filter to users in this store
      const userIds = userRoles?.map(ur => ur.user_id) || [];
      const storeUserIds = profiles
        .filter(p => userIds.includes(p.id))
        .map(p => p.id);

      if (storeUserIds.length === 0) {
        toast({
          title: "No Users Found",
          description: `No users with role "${availableRoles.find(r => r.value === bulkAssignRole)?.label}" found in this store`,
          variant: "destructive"
        });
        setIsBulkAssigning(false);
        return;
      }

      // For each selected KPI, create copies assigned to each user
      const selectedKpis = kpis.filter(k => selectedKpiIds.has(k.id));
      const insertions = [];

      for (const kpi of selectedKpis) {
        for (const userId of storeUserIds) {
          insertions.push({
            name: kpi.name,
            metric_type: kpi.metric_type,
            target_value: kpi.target_value,
            target_direction: kpi.target_direction,
            aggregation_type: kpi.aggregation_type,
            department_id: departmentId,
            assigned_to: userId,
            display_order: kpis.length + insertions.length + 1
          });
        }
      }

      const { error: insertError } = await supabase
        .from("kpi_definitions")
        .insert(insertions);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Assigned ${selectedKpiIds.size} KPI(s) to ${storeUserIds.length} users with role "${availableRoles.find(r => r.value === bulkAssignRole)?.label}"`
      });

      setSelectedKpiIds(new Set());
      setBulkAssignRole("");
      onKPIsChange();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleAssignAllKPIsToRole = async () => {
    if (!bulkAssignRole) {
      toast({
        title: "Error",
        description: "Please select a role",
        variant: "destructive"
      });
      return;
    }

    setIsBulkAssigning(true);

    try {
      // Get users with the selected role from this store
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", bulkAssignRole as any);

      if (rolesError) throw rolesError;

      // Filter to users in this store
      const userIds = userRoles?.map(ur => ur.user_id) || [];
      const storeUserIds = profiles
        .filter(p => userIds.includes(p.id))
        .map(p => p.id);

      if (storeUserIds.length === 0) {
        toast({
          title: "No Users Found",
          description: `No users with role "${availableRoles.find(r => r.value === bulkAssignRole)?.label}" found in this store`,
          variant: "destructive"
        });
        setIsBulkAssigning(false);
        return;
      }

      // Create copies of ALL KPIs assigned to each user
      const insertions = [];
      for (const kpi of kpis) {
        for (const userId of storeUserIds) {
          insertions.push({
            name: kpi.name,
            metric_type: kpi.metric_type,
            target_value: kpi.target_value,
            target_direction: kpi.target_direction,
            aggregation_type: kpi.aggregation_type,
            department_id: departmentId,
            assigned_to: userId,
            display_order: kpis.length + insertions.length + 1
          });
        }
      }

      const { error: insertError } = await supabase
        .from("kpi_definitions")
        .insert(insertions);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Assigned all ${kpis.length} KPI(s) to ${storeUserIds.length} users with role "${availableRoles.find(r => r.value === bulkAssignRole)?.label}"`
      });

      setBulkAssignRole("");
      onKPIsChange();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const toggleKpiSelection = (kpiId: string) => {
    const newSelection = new Set(selectedKpiIds);
    if (newSelection.has(kpiId)) {
      newSelection.delete(kpiId);
    } else {
      newSelection.add(kpiId);
    }
    setSelectedKpiIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedKpiIds.size === kpis.length) {
      setSelectedKpiIds(new Set());
    } else {
      setSelectedKpiIds(new Set(kpis.map(k => k.id)));
    }
  };

  const handleCopyKPIsToOwner = async () => {
    if (!copyToUserId || selectedKpiIds.size === 0) {
      toast({
        title: "Error",
        description: "Please select at least one KPI and a target owner",
        variant: "destructive"
      });
      return;
    }

    setIsCopyingToOwner(true);

    try {
      const selectedKpis = kpis.filter(k => selectedKpiIds.has(k.id));
      const targetOwner = profiles.find(p => p.id === copyToUserId);

      const insertions = selectedKpis.map((kpi, index) => ({
        name: kpi.name,
        metric_type: kpi.metric_type,
        target_value: kpi.target_value,
        target_direction: kpi.target_direction,
        aggregation_type: kpi.aggregation_type,
        department_id: departmentId,
        assigned_to: copyToUserId,
        display_order: kpis.length + index + 1
      }));

      const { error: insertError } = await supabase
        .from("kpi_definitions")
        .insert(insertions);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: `Copied ${selectedKpiIds.size} KPI(s) to ${targetOwner?.full_name || "selected owner"}`
      });

      setSelectedKpiIds(new Set());
      setCopyToUserId("");
      onKPIsChange();
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive"
      });
    } finally {
      setIsCopyingToOwner(false);
    }
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
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
                    <div>
                      <Label htmlFor="new-preset-aggregation">Totals</Label>
                      <Select value={newPresetAggregation} onValueChange={(v: any) => setNewPresetAggregation(v)}>
                        <SelectTrigger id="new-preset-aggregation">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="average">Average</SelectItem>
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                <div>
                  <Label htmlFor="custom-aggregation">Totals</Label>
                  <Select value={customKPIAggregation} onValueChange={(v: any) => setCustomKPIAggregation(v)}>
                    <SelectTrigger id="custom-aggregation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sum">Sum</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
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

            {/* Bulk Assignment Section */}
            {canBulkAssign && kpis.length > 0 && (
              <div className="border rounded-lg p-4 space-y-6 bg-muted/20">
                <div>
                  <h3 className="font-semibold text-sm">Bulk Assignment by Role</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign selected KPIs to all users with a specific role in this store
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor="bulk-role">Select Role</Label>
                    <Select value={bulkAssignRole} onValueChange={(v) => setBulkAssignRole(v as any)}>
                      <SelectTrigger id="bulk-role">
                        <SelectValue placeholder="Choose a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2 flex items-end gap-2">
                    <Button
                      onClick={handleBulkAssignKPIsToRole}
                      disabled={!bulkAssignRole || selectedKpiIds.size === 0 || isBulkAssigning}
                      variant="secondary"
                    >
                      Assign Selected KPIs ({selectedKpiIds.size}) to Role
                    </Button>
                    <Button
                      onClick={handleAssignAllKPIsToRole}
                      disabled={!bulkAssignRole || isBulkAssigning}
                      variant="secondary"
                    >
                      Assign All KPIs to Role
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="mb-3">
                    <h4 className="font-medium text-sm">Copy to Specific Owner</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Copy selected KPIs to a single user
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <Label htmlFor="copy-owner">Select Owner</Label>
                      <Select value={copyToUserId} onValueChange={setCopyToUserId}>
                        <SelectTrigger id="copy-owner">
                          <SelectValue placeholder="Choose a user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.filter(p => p.id && p.id.trim() !== "").map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="md:col-span-2 flex items-end">
                      <Button
                        onClick={handleCopyKPIsToOwner}
                        disabled={!copyToUserId || selectedKpiIds.size === 0 || isCopyingToOwner}
                        variant="secondary"
                      >
                        Copy Selected KPIs ({selectedKpiIds.size}) to Owner
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Current KPIs Table */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Current KPIs ({kpis.length})</h3>
              {kpis.length === 0 ? (
                <p className="text-sm text-muted-foreground">No KPIs selected. Choose KPIs above to get started.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {canBulkAssign && <TableHead className="w-12">
                        <Checkbox
                          checked={selectedKpiIds.size === kpis.length && kpis.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>}
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="min-w-[250px]">Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Goal</TableHead>
                      <TableHead>Totals</TableHead>
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
                          {canBulkAssign && (
                            <TableCell className="text-center">
                              <Checkbox
                                checked={selectedKpiIds.has(kpi.id)}
                                onCheckedChange={() => toggleKpiSelection(kpi.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                          )}
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
                              value={kpi.aggregation_type || "sum"}
                              onValueChange={(v) => handleUpdateKPI(kpi.id, "aggregation_type", v)}
                            >
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="sum">Sum</SelectItem>
                                <SelectItem value="average">Average</SelectItem>
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
