import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Loader2, Mountain, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getMetricsForBrand, type FinancialMetric } from "@/config/financialMetrics";

interface Profile {
  id: string;
  full_name: string;
}

interface MonthlyTarget {
  month: string;
  targetValue: string;
}

interface RockManagementDialogProps {
  departmentId: string;
  year: number;
  quarter: number;
  onRocksChange: () => void;
  rock?: any;
}

const getQuarterMonths = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const months: { label: string; identifier: string }[] = [];
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

export const RockManagementDialog = ({ departmentId, year, quarter, onRocksChange, rock }: RockManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [storeBrand, setStoreBrand] = useState<string | null>(null);
  const [existingSubMetrics, setExistingSubMetrics] = useState<{ [parentKey: string]: string[] }>({});
  
  const [formData, setFormData] = useState({
    title: rock?.title || "",
    description: rock?.description || "",
    assigned_to: rock?.assigned_to || "",
    progress_percentage: rock?.progress_percentage || 0,
    status: rock?.status || "on_track",
    due_date: rock?.due_date || "",
    // New metric linking fields
    linkToMetric: !!rock?.linked_metric_key,
    linkedMetricType: rock?.linked_metric_type || "metric",
    linkedMetricKey: rock?.linked_metric_key || "",
    linkedSubmetricName: rock?.linked_submetric_name || "",
    linkedParentMetricKey: rock?.linked_parent_metric_key || "",
    targetDirection: rock?.target_direction || "above",
  });
  
  const [monthlyTargets, setMonthlyTargets] = useState<MonthlyTarget[]>([]);
  const [existingTargetIds, setExistingTargetIds] = useState<{ [month: string]: string }>({});
  
  const { toast } = useToast();
  
  const quarterMonths = useMemo(() => getQuarterMonths(quarter, year), [quarter, year]);
  
  const FINANCIAL_METRICS = useMemo(() => {
    return getMetricsForBrand(storeBrand);
  }, [storeBrand]);

  useEffect(() => {
    if (open) {
      loadProfiles();
      loadStoreBrand();
      loadExistingSubMetrics();
      
      // Initialize monthly targets for the quarter
      if (!rock) {
        setMonthlyTargets(quarterMonths.map(m => ({ month: m.identifier, targetValue: "" })));
      }
    }
  }, [open, quarterMonths]);

  useEffect(() => {
    if (rock && open) {
      setFormData({
        title: rock.title || "",
        description: rock.description || "",
        assigned_to: rock.assigned_to || "",
        progress_percentage: rock.progress_percentage || 0,
        status: rock.status || "on_track",
        due_date: rock.due_date || "",
        linkToMetric: !!rock.linked_metric_key,
        linkedMetricType: rock.linked_metric_type || "metric",
        linkedMetricKey: rock.linked_metric_key || "",
        linkedSubmetricName: rock.linked_submetric_name || "",
        linkedParentMetricKey: rock.linked_parent_metric_key || "",
        targetDirection: rock.target_direction || "above",
      });
      
      // Load existing monthly targets for this rock
      loadExistingTargets(rock.id);
    }
  }, [rock, open]);

  const loadExistingTargets = async (rockId: string) => {
    const { data, error } = await supabase
      .from("rock_monthly_targets")
      .select("*")
      .eq("rock_id", rockId);
    
    if (error) {
      console.error("Error loading rock targets:", error);
      return;
    }
    
    const targetMap: { [month: string]: string } = {};
    const targets = quarterMonths.map(m => {
      const existing = data?.find(t => t.month === m.identifier);
      if (existing) {
        targetMap[m.identifier] = existing.id;
      }
      return {
        month: m.identifier,
        targetValue: existing ? String(existing.target_value) : "",
      };
    });
    
    setMonthlyTargets(targets);
    setExistingTargetIds(targetMap);
  };

  const loadStoreBrand = async () => {
    const { data: department } = await supabase
      .from("departments")
      .select("store_id")
      .eq("id", departmentId)
      .maybeSingle();
    
    if (department?.store_id) {
      const { data: store } = await supabase
        .from("stores")
        .select("brand, brand_id, brands(name)")
        .eq("id", department.store_id)
        .maybeSingle();
      
      // Use brand name from brands table if available, otherwise fall back to legacy brand field
      const brandName = (store as any)?.brands?.name || store?.brand || null;
      setStoreBrand(brandName);
    }
  };

  const loadExistingSubMetrics = async () => {
    // Fetch existing sub-metrics for this department to populate the sub-metric dropdown
    const quarterMonthIds = quarterMonths.map(m => m.identifier);
    
    const { data } = await supabase
      .from("financial_entries")
      .select("metric_name")
      .eq("department_id", departmentId)
      .in("month", quarterMonthIds)
      .like("metric_name", "sub:%");
    
    if (data) {
      const subMetricsByParent: { [parentKey: string]: Set<string> } = {};
      
      data.forEach(entry => {
        // Parse sub-metric format: sub:parent_key:name
        const parts = entry.metric_name.split(":");
        if (parts.length >= 3) {
          const parentKey = parts[1];
          const name = parts.slice(2).join(":");
          
          if (!subMetricsByParent[parentKey]) {
            subMetricsByParent[parentKey] = new Set();
          }
          subMetricsByParent[parentKey].add(name);
        }
      });
      
      const result: { [parentKey: string]: string[] } = {};
      Object.entries(subMetricsByParent).forEach(([key, names]) => {
        result[key] = Array.from(names).sort();
      });
      
      setExistingSubMetrics(result);
    }
  };

  const loadProfiles = async () => {
    const { data: department } = await supabase
      .from("departments")
      .select("store_id, manager_id")
      .eq("id", departmentId)
      .maybeSingle();

    if (!department?.store_id) {
      setProfiles([]);
      return;
    }

    const { data: accessData } = await supabase
      .from("user_department_access")
      .select("user_id")
      .eq("department_id", departmentId);

    const userIdsWithAccess = new Set<string>();
    if (department.manager_id) {
      userIdsWithAccess.add(department.manager_id);
    }
    if (accessData) {
      accessData.forEach(access => userIdsWithAccess.add(access.user_id));
    }

    const { data, error } = await supabase.rpc("get_profiles_basic");

    if (error) {
      console.error("Error loading profiles:", error);
      return;
    }

    const filteredProfiles = (data || []).filter(
      (profile: { id: string; full_name: string; store_id: string }) => 
        profile.store_id === department.store_id && userIdsWithAccess.has(profile.id)
    ).map((p: { id: string; full_name: string }) => ({ id: p.id, full_name: p.full_name }));

    filteredProfiles.sort((a: { full_name: string }, b: { full_name: string }) => 
      a.full_name.localeCompare(b.full_name)
    );

    setProfiles(filteredProfiles);
  };

  const handleSubmit = async () => {
    if (!formData.title) {
      toast({ title: "Error", description: "Please enter a title", variant: "destructive" });
      return;
    }

    if (formData.linkToMetric && !formData.linkedMetricKey) {
      toast({ title: "Error", description: "Please select a metric to link", variant: "destructive" });
      return;
    }

    if (formData.linkToMetric && formData.linkedMetricType === "submetric" && !formData.linkedSubmetricName) {
      toast({ title: "Error", description: "Please select a sub-metric", variant: "destructive" });
      return;
    }

    setLoading(true);

    const rockData = {
      department_id: departmentId,
      year,
      quarter,
      title: formData.title,
      description: formData.description,
      assigned_to: formData.assigned_to === "unassigned" ? null : formData.assigned_to || null,
      progress_percentage: parseInt(formData.progress_percentage.toString()) || 0,
      status: formData.status,
      due_date: formData.due_date || null,
      // Metric linking fields
      linked_metric_key: formData.linkToMetric 
        ? (formData.linkedMetricType === "submetric" ? formData.linkedParentMetricKey : formData.linkedMetricKey)
        : null,
      linked_metric_type: formData.linkToMetric ? formData.linkedMetricType : null,
      linked_submetric_name: formData.linkToMetric && formData.linkedMetricType === "submetric" 
        ? formData.linkedSubmetricName 
        : null,
      linked_parent_metric_key: formData.linkToMetric && formData.linkedMetricType === "submetric"
        ? formData.linkedParentMetricKey
        : null,
      target_direction: formData.linkToMetric ? formData.targetDirection : null,
    };

    let error;
    let rockId = rock?.id;
    
    if (rock) {
      ({ error } = await supabase
        .from("rocks")
        .update(rockData)
        .eq("id", rock.id));
    } else {
      const { data: newRock, error: insertError } = await supabase
        .from("rocks")
        .insert(rockData)
        .select("id")
        .single();
      
      error = insertError;
      rockId = newRock?.id;
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Save monthly targets if metric is linked
    if (formData.linkToMetric && rockId) {
      for (const target of monthlyTargets) {
        const targetValue = parseFloat(target.targetValue);
        
        if (!isNaN(targetValue)) {
          const existingId = existingTargetIds[target.month];
          
          if (existingId) {
            // Update existing target
            await supabase
              .from("rock_monthly_targets")
              .update({ target_value: targetValue })
              .eq("id", existingId);
          } else {
            // Insert new target
            await supabase
              .from("rock_monthly_targets")
              .insert({
                rock_id: rockId,
                month: target.month,
                target_value: targetValue,
              });
          }
        } else if (existingTargetIds[target.month]) {
          // Delete target if value is cleared
          await supabase
            .from("rock_monthly_targets")
            .delete()
            .eq("id", existingTargetIds[target.month]);
        }
      }
    }

    toast({ title: "Success", description: rock ? "Rock updated successfully" : "Rock added successfully" });
    setOpen(false);
    resetForm();
    onRocksChange();
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      assigned_to: "",
      progress_percentage: 0,
      status: "on_track",
      due_date: "",
      linkToMetric: false,
      linkedMetricType: "metric",
      linkedMetricKey: "",
      linkedSubmetricName: "",
      linkedParentMetricKey: "",
      targetDirection: "above",
    });
    setMonthlyTargets(quarterMonths.map(m => ({ month: m.identifier, targetValue: "" })));
    setExistingTargetIds({});
  };

  const updateMonthlyTarget = (month: string, value: string) => {
    setMonthlyTargets(prev => 
      prev.map(t => t.month === month ? { ...t, targetValue: value } : t)
    );
  };

  // Get the selected metric for display
  const selectedMetric = FINANCIAL_METRICS.find(m => m.key === formData.linkedMetricKey);
  const selectedParentMetric = FINANCIAL_METRICS.find(m => m.key === formData.linkedParentMetricKey);
  const availableSubMetrics = formData.linkedParentMetricKey 
    ? existingSubMetrics[formData.linkedParentMetricKey] || []
    : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {rock ? (
          <Button variant="ghost" size="sm">Edit</Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rock ? "Edit Rock" : "Add New Rock"}</DialogTitle>
          <DialogDescription>
            Define a quarterly priority for Q{quarter} {year}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Reduce Personnel Expense to 35%"
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional details about this rock..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="assigned_to">Assigned To</Label>
              <Select
                value={formData.assigned_to}
                onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
              >
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profiles.filter(p => p.id && p.id.trim() !== "").map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on_track">On Track</SelectItem>
                  <SelectItem value="at_risk">At Risk</SelectItem>
                  <SelectItem value="off_track">Off Track</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min="0"
                max="100"
                value={formData.progress_percentage}
                onChange={(e) => setFormData({ ...formData, progress_percentage: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>

          {/* Link to Financial Metric Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mountain className="h-4 w-4 text-primary" />
                <Label htmlFor="linkToMetric" className="font-medium">Link to Financial Metric</Label>
              </div>
              <Switch
                id="linkToMetric"
                checked={formData.linkToMetric}
                onCheckedChange={(checked) => setFormData({ ...formData, linkToMetric: checked })}
              />
            </div>

            {formData.linkToMetric && (
              <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                {/* Metric Type Selector */}
                <div>
                  <Label className="mb-2 block">Metric Type</Label>
                  <RadioGroup
                    value={formData.linkedMetricType}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      linkedMetricType: value,
                      linkedMetricKey: "",
                      linkedSubmetricName: "",
                      linkedParentMetricKey: "",
                    })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="metric" id="metric-type" />
                      <Label htmlFor="metric-type" className="font-normal cursor-pointer">Metric</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="submetric" id="submetric-type" />
                      <Label htmlFor="submetric-type" className="font-normal cursor-pointer">Sub-Metric</Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.linkedMetricType === "metric" && (
                  <div>
                    <Label htmlFor="metricSelect">Select Metric</Label>
                    <Select
                      value={formData.linkedMetricKey}
                      onValueChange={(value) => setFormData({ ...formData, linkedMetricKey: value })}
                    >
                      <SelectTrigger id="metricSelect">
                        <SelectValue placeholder="Choose a metric" />
                      </SelectTrigger>
                      <SelectContent>
                        {FINANCIAL_METRICS.map((metric) => (
                          <SelectItem key={metric.key} value={metric.key}>
                            {metric.name} ({metric.type === "dollar" ? "$" : "%"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.linkedMetricType === "submetric" && (
                  <>
                    <div>
                      <Label htmlFor="parentMetricSelect">Parent Metric</Label>
                      <Select
                        value={formData.linkedParentMetricKey}
                        onValueChange={(value) => setFormData({ 
                          ...formData, 
                          linkedParentMetricKey: value,
                          linkedSubmetricName: "",
                        })}
                      >
                        <SelectTrigger id="parentMetricSelect">
                          <SelectValue placeholder="Choose parent metric" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(existingSubMetrics).map((parentKey) => {
                            const parentMetric = FINANCIAL_METRICS.find(m => m.key === parentKey);
                            return (
                              <SelectItem key={parentKey} value={parentKey}>
                                {parentMetric?.name || parentKey}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.linkedParentMetricKey && (
                      <div>
                        <Label htmlFor="submetricSelect">Sub-Metric</Label>
                        <Select
                          value={formData.linkedSubmetricName}
                          onValueChange={(value) => setFormData({ ...formData, linkedSubmetricName: value })}
                        >
                          <SelectTrigger id="submetricSelect">
                            <SelectValue placeholder="Choose sub-metric" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubMetrics.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                {/* Target Direction */}
                <div>
                  <Label className="mb-2 block">Target Direction</Label>
                  <RadioGroup
                    value={formData.targetDirection}
                    onValueChange={(value) => setFormData({ ...formData, targetDirection: value })}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="above" id="dir-above" />
                      <Label htmlFor="dir-above" className="font-normal cursor-pointer">Above Target</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="below" id="dir-below" />
                      <Label htmlFor="dir-below" className="font-normal cursor-pointer">Below Target</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Monthly Targets */}
                <div>
                  <Label className="mb-2 block flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Monthly Targets
                  </Label>
                  <div className="grid grid-cols-3 gap-3">
                    {quarterMonths.map((month, idx) => (
                      <div key={month.identifier}>
                        <Label htmlFor={`target-${month.identifier}`} className="text-xs text-muted-foreground">
                          {month.label}
                        </Label>
                        <Input
                          id={`target-${month.identifier}`}
                          type="number"
                          step="any"
                          value={monthlyTargets[idx]?.targetValue || ""}
                          onChange={(e) => updateMonthlyTarget(month.identifier, e.target.value)}
                          placeholder={
                            formData.linkedMetricType === "metric" && selectedMetric?.type === "percentage"
                              ? "e.g., 38"
                              : formData.linkedMetricType === "submetric"
                              ? "e.g., 15000"
                              : "e.g., 50000"
                          }
                          className="mt-1"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formData.linkedMetricType === "metric" && selectedMetric?.type === "percentage"
                      ? "Enter percentage values (e.g., 38 for 38%)"
                      : "Enter dollar amounts without commas or symbols"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rock ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
