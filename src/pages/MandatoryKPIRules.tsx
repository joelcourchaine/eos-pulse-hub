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
import { ArrowLeft, Check, AlertTriangle, Save, Shield, Pencil, X } from "lucide-react";
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

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [groupsRes, typesRes, kpisRes] = await Promise.all([
          supabase.from("store_groups").select("id, name").order("name"),
          supabase.from("department_types").select("id, name").order("display_order"),
          supabase.from("preset_kpis").select("id, name, metric_type").order("display_order"),
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

      toast({
        title: "Rules saved",
        description: `${selectedKpis.size} mandatory KPI(s) configured.`,
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
              <CardHeader>
                <CardTitle className="text-lg">📊 Mandatory KPIs for Department Managers</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm mb-4">
                  Select which KPIs must be tracked by department managers in this configuration.
                  These KPIs will be auto-added and cannot be deleted.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {presetKpis.map((kpi) => (
                    <label
                      key={kpi.id}
                      className="flex items-center gap-3 p-3 border rounded-md cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedKpis.has(kpi.id)}
                        onCheckedChange={() => handleKpiToggle(kpi.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{kpi.name}</span>
                        <span className="text-muted-foreground text-xs block">
                          {kpi.metric_type}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

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
          </>
        )}
      </div>
    </div>
  );
};

export default MandatoryKPIRules;
