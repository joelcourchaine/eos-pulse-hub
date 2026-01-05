import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Check, AlertTriangle, Save, Shield, Pencil, X, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StoreGroup {
  id: string;
  name: string;
}

interface DepartmentType {
  id: string;
  name: string;
}

interface PresetKPI {
  id: string;
  name: string;
  metric_type: string;
  target_direction: string;
}

interface DepartmentManager {
  department_id: string;
  department_name: string;
  store_id: string;
  store_name: string;
  manager_id: string | null;
  manager_name: string | null;
  manager_email: string | null;
}

interface MandatoryRule {
  id: string;
  preset_kpi_id: string;
}

interface EligibleUser {
  id: string;
  full_name: string;
  email: string;
}

const MandatoryKPIRules: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [storeGroups, setStoreGroups] = useState<StoreGroup[]>([]);
  const [departmentTypes, setDepartmentTypes] = useState<DepartmentType[]>([]);
  const [presetKpis, setPresetKpis] = useState<PresetKPI[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedDeptTypeId, setSelectedDeptTypeId] = useState<string>("");

  const [departmentManagers, setDepartmentManagers] = useState<DepartmentManager[]>([]);
  const [mandatoryRules, setMandatoryRules] = useState<MandatoryRule[]>([]);
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Manager editing state
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingManagerId, setEditingManagerId] = useState<string>("");
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingManager, setSavingManager] = useState(false);

  // KPI editing state
  const [isAddingKpi, setIsAddingKpi] = useState(false);
  const [newKpiName, setNewKpiName] = useState("");
  const [newKpiType, setNewKpiType] = useState<string>("dollar");
  const [newKpiDirection, setNewKpiDirection] = useState<string>("above");
  const [savingNewKpi, setSavingNewKpi] = useState(false);

  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [editingKpiName, setEditingKpiName] = useState("");
  const [editingKpiType, setEditingKpiType] = useState("");
  const [editingKpiDirection, setEditingKpiDirection] = useState("");
  const [savingKpiEdit, setSavingKpiEdit] = useState(false);

  const [deletingKpiId, setDeletingKpiId] = useState<string | null>(null);
  const [kpiInUseWarning, setKpiInUseWarning] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [groupsRes, typesRes, kpisRes] = await Promise.all([
          supabase.from("store_groups").select("id, name").order("name"),
          supabase.from("department_types").select("id, name").order("display_order"),
          supabase.from("preset_kpis").select("id, name, metric_type, target_direction").order("display_order"),
        ]);

        if (groupsRes.data) setStoreGroups(groupsRes.data);
        if (typesRes.data) setDepartmentTypes(typesRes.data);
        if (kpisRes.data) setPresetKpis(kpisRes.data);
      } catch (error) {
        console.error("Error loading initial data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Load department managers and rules when selections change
  useEffect(() => {
    if (!selectedGroupId || !selectedDeptTypeId) {
      setDepartmentManagers([]);
      setMandatoryRules([]);
      setSelectedKpis(new Set());
      return;
    }

    const loadData = async () => {
      try {
        // Load department managers for selected group and department type
        const { data: deptData, error: deptError } = await supabase
          .from("departments")
          .select(`
            id,
            name,
            manager_id,
            stores!inner(id, name, group_id),
            profiles:manager_id(full_name, email)
          `)
          .eq("department_type_id", selectedDeptTypeId)
          .eq("stores.group_id", selectedGroupId);

        if (deptError) throw deptError;

        const managers: DepartmentManager[] = (deptData || []).map((d: any) => ({
          department_id: d.id,
          department_name: d.name,
          store_id: d.stores?.id || "",
          store_name: d.stores?.name || "Unknown Store",
          manager_id: d.manager_id,
          manager_name: d.profiles?.full_name || null,
          manager_email: d.profiles?.email || null,
        }));

        setDepartmentManagers(managers.sort((a, b) => a.store_name.localeCompare(b.store_name)));

        // Load existing mandatory rules
        const { data: rulesData, error: rulesError } = await supabase
          .from("mandatory_kpi_rules")
          .select("id, preset_kpi_id")
          .eq("store_group_id", selectedGroupId)
          .eq("department_type_id", selectedDeptTypeId)
          .eq("is_active", true);

        if (rulesError) throw rulesError;

        setMandatoryRules(rulesData || []);
        setSelectedKpis(new Set((rulesData || []).map((r) => r.preset_kpi_id)));
      } catch (error) {
        console.error("Error loading data:", error);
        toast({
          title: "Error loading data",
          description: "Failed to load department managers and rules.",
          variant: "destructive",
        });
      }
    };

    loadData();
  }, [selectedGroupId, selectedDeptTypeId, toast]);

  const handleEditManager = async (dm: DepartmentManager) => {
    setEditingDeptId(dm.department_id);
    setEditingManagerId(dm.manager_id || "none");
    setLoadingUsers(true);

    try {
      // Fetch eligible users for this store (department managers and store GMs)
      const { data: users, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("store_id", dm.store_id)
        .in("role", ["department_manager", "store_gm"])
        .order("full_name");

      if (error) throw error;
      setEligibleUsers(users || []);
    } catch (error) {
      console.error("Error loading eligible users:", error);
      toast({
        title: "Error",
        description: "Failed to load eligible users.",
        variant: "destructive",
      });
      setEditingDeptId(null);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingDeptId(null);
    setEditingManagerId("");
    setEligibleUsers([]);
  };

  const handleSaveManager = async (departmentId: string) => {
    setSavingManager(true);
    try {
      const newManagerId = editingManagerId === "none" ? null : editingManagerId;
      
      const { error } = await supabase
        .from("departments")
        .update({ manager_id: newManagerId })
        .eq("id", departmentId);

      if (error) throw error;

      // Update local state
      setDepartmentManagers((prev) =>
        prev.map((dm) => {
          if (dm.department_id === departmentId) {
            const newManager = eligibleUsers.find((u) => u.id === newManagerId);
            return {
              ...dm,
              manager_id: newManagerId,
              manager_name: newManager?.full_name || null,
              manager_email: newManager?.email || null,
            };
          }
          return dm;
        })
      );

      toast({
        title: "Manager updated",
        description: "Department manager has been updated.",
      });

      handleCancelEdit();
    } catch (error) {
      console.error("Error updating manager:", error);
      toast({
        title: "Error",
        description: "Failed to update department manager.",
        variant: "destructive",
      });
    } finally {
      setSavingManager(false);
    }
  };

  const handleKpiToggle = (kpiId: string) => {
    setSelectedKpis((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(kpiId)) {
        newSet.delete(kpiId);
      } else {
        newSet.add(kpiId);
      }
      return newSet;
    });
  };

  // Sync mandatory KPIs to all matching department scorecards
  const syncMandatoryKpisToScorecards = async (
    storeGroupId: string,
    departmentTypeId: string,
    mandatoryPresetIds: string[]
  ): Promise<number> => {
    if (mandatoryPresetIds.length === 0) return 0;

    // 1. Get all preset KPIs that are mandatory
    const { data: presets } = await supabase
      .from("preset_kpis")
      .select("id, name, metric_type, target_direction")
      .in("id", mandatoryPresetIds);

    if (!presets || presets.length === 0) return 0;

    // 2. Get all stores in this group first
    const { data: stores } = await supabase
      .from("stores")
      .select("id")
      .eq("group_id", storeGroupId);

    if (!stores || stores.length === 0) return 0;

    const storeIds = stores.map((s) => s.id);

    // 3. Find all departments matching the type and belonging to these stores
    const { data: departments } = await supabase
      .from("departments")
      .select("id")
      .eq("department_type_id", departmentTypeId)
      .in("store_id", storeIds);

    if (!departments || departments.length === 0) return 0;

    let syncedCount = 0;

    // 4. For each department, add missing KPIs
    for (const dept of departments) {
      // Get existing KPIs for this department
      const { data: existingKpis } = await supabase
        .from("kpi_definitions")
        .select("name")
        .eq("department_id", dept.id);

      const existingNames = new Set(existingKpis?.map((k) => k.name) || []);

      // Find presets that don't exist yet
      const missingPresets = presets.filter((p) => !existingNames.has(p.name));

      // Insert missing KPIs
      if (missingPresets.length > 0) {
        const newKpis = missingPresets.map((preset, index) => ({
          name: preset.name,
          metric_type: preset.metric_type,
          target_value: 0,
          target_direction: preset.target_direction,
          department_id: dept.id,
          display_order: (existingKpis?.length || 0) + index + 1,
        }));

        const { error } = await supabase.from("kpi_definitions").insert(newKpis);
        if (!error) {
          syncedCount += missingPresets.length;
        }
      }
    }

    return syncedCount;
  };

  const handleSave = async () => {
    if (!selectedGroupId || !selectedDeptTypeId) return;

    setSaving(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Delete existing rules for this combination
      await supabase
        .from("mandatory_kpi_rules")
        .delete()
        .eq("store_group_id", selectedGroupId)
        .eq("department_type_id", selectedDeptTypeId);

      // Insert new rules
      if (selectedKpis.size > 0) {
        const newRules = Array.from(selectedKpis).map((kpiId) => ({
          preset_kpi_id: kpiId,
          store_group_id: selectedGroupId,
          department_type_id: selectedDeptTypeId,
          created_by: user?.id,
        }));

        const { error } = await supabase
          .from("mandatory_kpi_rules")
          .insert(newRules);

        if (error) throw error;
      }

      // Sync mandatory KPIs to all matching department scorecards
      const mandatoryIds = Array.from(selectedKpis);
      const syncedCount = await syncMandatoryKpisToScorecards(
        selectedGroupId,
        selectedDeptTypeId,
        mandatoryIds
      );

      toast({
        title: "Rules saved and synced",
        description: syncedCount > 0
          ? `${selectedKpis.size} mandatory KPI(s) configured. Added ${syncedCount} KPI(s) to department scorecards.`
          : `${selectedKpis.size} mandatory KPI(s) configured.`,
      });

      // Reload rules
      const { data: rulesData } = await supabase
        .from("mandatory_kpi_rules")
        .select("id, preset_kpi_id")
        .eq("store_group_id", selectedGroupId)
        .eq("department_type_id", selectedDeptTypeId)
        .eq("is_active", true);

      setMandatoryRules(rulesData || []);
    } catch (error) {
      console.error("Error saving rules:", error);
      toast({
        title: "Error saving",
        description: "Failed to save mandatory KPI rules.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = departmentManagers.filter((m) => m.manager_id).length;
  const totalCount = departmentManagers.length;

  const hasChanges = () => {
    const currentRuleIds = new Set(mandatoryRules.map((r) => r.preset_kpi_id));
    if (currentRuleIds.size !== selectedKpis.size) return true;
    for (const id of selectedKpis) {
      if (!currentRuleIds.has(id)) return true;
    }
    return false;
  };

  const refreshPresetKpis = async () => {
    const { data } = await supabase
      .from("preset_kpis")
      .select("id, name, metric_type, target_direction")
      .order("display_order");
    if (data) setPresetKpis(data);
  };

  const handleAddKpi = async () => {
    if (!newKpiName.trim()) return;
    setSavingNewKpi(true);
    try {
      const { error } = await supabase.from("preset_kpis").insert({
        name: newKpiName.trim(),
        metric_type: newKpiType,
        target_direction: newKpiDirection,
        display_order: presetKpis.length + 1,
        dependencies: [],
      });
      if (error) throw error;
      toast({ title: "KPI added", description: `"${newKpiName.trim()}" has been added.` });
      setNewKpiName("");
      setNewKpiType("dollar");
      setNewKpiDirection("above");
      setIsAddingKpi(false);
      await refreshPresetKpis();
    } catch (error) {
      console.error("Error adding KPI:", error);
      toast({ title: "Error", description: "Failed to add KPI.", variant: "destructive" });
    } finally {
      setSavingNewKpi(false);
    }
  };

  const handleStartEditKpi = (kpi: PresetKPI) => {
    setEditingKpiId(kpi.id);
    setEditingKpiName(kpi.name);
    setEditingKpiType(kpi.metric_type);
    setEditingKpiDirection(kpi.target_direction);
  };

  const handleCancelEditKpi = () => {
    setEditingKpiId(null);
    setEditingKpiName("");
    setEditingKpiType("");
    setEditingKpiDirection("");
  };

  const handleSaveKpiEdit = async () => {
    if (!editingKpiId || !editingKpiName.trim()) return;
    setSavingKpiEdit(true);
    try {
      const { error } = await supabase
        .from("preset_kpis")
        .update({
          name: editingKpiName.trim(),
          metric_type: editingKpiType,
          target_direction: editingKpiDirection,
        })
        .eq("id", editingKpiId);
      if (error) throw error;
      toast({ title: "KPI updated", description: "Changes saved successfully." });
      handleCancelEditKpi();
      await refreshPresetKpis();
    } catch (error) {
      console.error("Error updating KPI:", error);
      toast({ title: "Error", description: "Failed to update KPI.", variant: "destructive" });
    } finally {
      setSavingKpiEdit(false);
    }
  };

  const handleDeleteKpiClick = async (kpiId: string) => {
    // Check if in use by any mandatory rules
    const { data: rules } = await supabase
      .from("mandatory_kpi_rules")
      .select("id")
      .eq("preset_kpi_id", kpiId);

    if (rules && rules.length > 0) {
      setKpiInUseWarning(true);
      setDeletingKpiId(kpiId);
    } else {
      setKpiInUseWarning(false);
      setDeletingKpiId(kpiId);
    }
  };

  const handleConfirmDeleteKpi = async () => {
    if (!deletingKpiId) return;
    try {
      // If in use, first delete the mandatory rules
      if (kpiInUseWarning) {
        await supabase
          .from("mandatory_kpi_rules")
          .delete()
          .eq("preset_kpi_id", deletingKpiId);
      }

      const { error } = await supabase
        .from("preset_kpis")
        .delete()
        .eq("id", deletingKpiId);

      if (error) throw error;

      toast({ title: "KPI deleted", description: "The KPI has been removed." });
      setSelectedKpis((prev) => {
        const newSet = new Set(prev);
        newSet.delete(deletingKpiId);
        return newSet;
      });
      await refreshPresetKpis();
    } catch (error) {
      console.error("Error deleting KPI:", error);
      toast({ title: "Error", description: "Failed to delete KPI.", variant: "destructive" });
    } finally {
      setDeletingKpiId(null);
      setKpiInUseWarning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Mandatory KPI Rules</h1>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Store Group</label>
                <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a store group" />
                  </SelectTrigger>
                  <SelectContent>
                    {storeGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Department Type</label>
                <Select value={selectedDeptTypeId} onValueChange={setSelectedDeptTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department type" />
                  </SelectTrigger>
                  <SelectContent>
                    {departmentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedGroupId && selectedDeptTypeId && (
          <>
            {/* Department Managers Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  📋 Department Managers for This Configuration
                  {totalCount > 0 && (
                    <Badge variant={assignedCount === totalCount ? "default" : "secondary"}>
                      {assignedCount}/{totalCount} assigned
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {departmentManagers.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No departments found for this configuration.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Store</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Manager</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departmentManagers.map((dm) => (
                        <TableRow key={dm.department_id}>
                          <TableCell className="font-medium">{dm.store_name}</TableCell>
                          <TableCell>{dm.department_name}</TableCell>
                          <TableCell>
                            {editingDeptId === dm.department_id ? (
                              <div className="flex items-center gap-2">
                                {loadingUsers ? (
                                  <span className="text-muted-foreground text-sm">Loading...</span>
                                ) : (
                                  <Select
                                    value={editingManagerId}
                                    onValueChange={setEditingManagerId}
                                  >
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue placeholder="Select manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No manager</SelectItem>
                                      {eligibleUsers.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                          {user.full_name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ) : dm.manager_name ? (
                              <div>
                                <span>{dm.manager_name}</span>
                                {dm.manager_email && (
                                  <span className="text-muted-foreground text-xs block">
                                    {dm.manager_email}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {dm.manager_id ? (
                              <Badge variant="default" className="gap-1">
                                <Check className="h-3 w-3" />
                                Assigned
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1 text-amber-600">
                                <AlertTriangle className="h-3 w-3" />
                                Not Assigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {editingDeptId === dm.department_id ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSaveManager(dm.department_id)}
                                  disabled={savingManager || loadingUsers}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={handleCancelEdit}
                                  disabled={savingManager}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditManager(dm)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Mandatory KPIs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">📊 Mandatory KPIs for Department Managers</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddingKpi(true)}
                  disabled={isAddingKpi}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add KPI
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  Select which KPIs must be tracked by department managers in this configuration.
                  These KPIs will be auto-added and cannot be deleted.
                </p>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Required</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Add new KPI row */}
                    {isAddingKpi && (
                      <TableRow>
                        <TableCell></TableCell>
                        <TableCell>
                          <Input
                            placeholder="KPI name"
                            value={newKpiName}
                            onChange={(e) => setNewKpiName(e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={newKpiType} onValueChange={setNewKpiType}>
                            <SelectTrigger className="h-8 w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dollar">Dollar</SelectItem>
                              <SelectItem value="percentage">Percentage</SelectItem>
                              <SelectItem value="unit">Unit</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={newKpiDirection} onValueChange={setNewKpiDirection}>
                            <SelectTrigger className="h-8 w-[100px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="above">Above</SelectItem>
                              <SelectItem value="below">Below</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleAddKpi}
                              disabled={savingNewKpi || !newKpiName.trim()}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setIsAddingKpi(false);
                                setNewKpiName("");
                                setNewKpiType("dollar");
                                setNewKpiDirection("above");
                              }}
                              disabled={savingNewKpi}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}

                    {/* Existing KPIs */}
                    {presetKpis.map((kpi) => (
                      <TableRow key={kpi.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedKpis.has(kpi.id)}
                            onCheckedChange={() => handleKpiToggle(kpi.id)}
                            disabled={editingKpiId === kpi.id}
                          />
                        </TableCell>
                        <TableCell>
                          {editingKpiId === kpi.id ? (
                            <Input
                              value={editingKpiName}
                              onChange={(e) => setEditingKpiName(e.target.value)}
                              className="h-8"
                            />
                          ) : (
                            <span className="font-medium">{kpi.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingKpiId === kpi.id ? (
                            <Select value={editingKpiType} onValueChange={setEditingKpiType}>
                              <SelectTrigger className="h-8 w-[110px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="dollar">Dollar</SelectItem>
                                <SelectItem value="percentage">Percentage</SelectItem>
                                <SelectItem value="unit">Unit</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">{kpi.metric_type}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingKpiId === kpi.id ? (
                            <Select value={editingKpiDirection} onValueChange={setEditingKpiDirection}>
                              <SelectTrigger className="h-8 w-[100px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="above">Above</SelectItem>
                                <SelectItem value="below">Below</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{kpi.target_direction}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingKpiId === kpi.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleSaveKpiEdit}
                                disabled={savingKpiEdit || !editingKpiName.trim()}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEditKpi}
                                disabled={savingKpiEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleStartEditKpi(kpi)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteKpiClick(kpi.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="mt-6 flex items-center justify-between border-t pt-4">
                  <span className="text-sm text-muted-foreground">
                    {selectedKpis.size} KPI(s) selected as mandatory
                  </span>
                  <Button onClick={handleSave} disabled={saving || !hasChanges()}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingKpiId} onOpenChange={(open) => !open && setDeletingKpiId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete KPI?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {kpiInUseWarning
                      ? "This KPI is currently used in mandatory rules. Deleting it will also remove it from all mandatory rule configurations."
                      : "Are you sure you want to delete this KPI? This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmDeleteKpi} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
};

export default MandatoryKPIRules;
