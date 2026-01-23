import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, LayoutGrid, Info } from "lucide-react";
import { STANDARD_COLUMN_MAPPINGS } from "@/utils/scorecardImportMatcher";

interface ColumnMapping {
  id: string;
  import_profile_id: string;
  source_column: string;
  pay_type_filter: string | null;
  target_kpi_name: string;
  is_per_user: boolean;
  metric_type: string;
  display_order: number;
}

interface ScorecardColumnMappingsPanelProps {
  selectedProfileId: string | null;
  onSelectProfile: (id: string | null) => void;
}

export const ScorecardColumnMappingsPanel = ({
  selectedProfileId,
  onSelectProfile,
}: ScorecardColumnMappingsPanelProps) => {
  const [localMappings, setLocalMappings] = useState<ColumnMapping[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles } = useQuery({
    queryKey: ["scorecard-import-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["scorecard-import-mappings", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data, error } = await supabase
        .from("scorecard_import_mappings")
        .select("*")
        .eq("import_profile_id", selectedProfileId)
        .order("display_order");
      if (error) throw error;
      return data as ColumnMapping[];
    },
    enabled: !!selectedProfileId,
  });

  // Fetch column templates from Visual Mapper
  const { data: columnTemplates } = useQuery({
    queryKey: ["column-templates-for-panel", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data, error } = await supabase
        .from("scorecard_column_templates")
        .select("kpi_name, col_index")
        .eq("import_profile_id", selectedProfileId)
        .order("col_index");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProfileId,
  });

  const { data: presetKpis } = useQuery({
    queryKey: ["preset-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preset_kpis")
        .select("name, metric_type")
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  // Get unique KPI names from column templates
  const mappedKpiNames = columnTemplates
    ? [...new Set(columnTemplates.map((t) => t.kpi_name))].sort()
    : [];

  useEffect(() => {
    if (mappings) {
      setLocalMappings(mappings);
      setHasChanges(false);
    }
  }, [mappings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfileId) return;

      // Delete existing mappings
      await supabase
        .from("scorecard_import_mappings")
        .delete()
        .eq("import_profile_id", selectedProfileId);

      // Insert new mappings
      if (localMappings.length > 0) {
        const { error } = await supabase
          .from("scorecard_import_mappings")
          .insert(
            localMappings.map((m, idx) => ({
              import_profile_id: selectedProfileId,
              source_column: m.source_column,
              pay_type_filter: m.pay_type_filter,
              target_kpi_name: m.target_kpi_name,
              is_per_user: m.is_per_user,
              metric_type: m.metric_type,
              display_order: idx,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scorecard-import-mappings", selectedProfileId] });
      toast({ title: "Mappings saved" });
      setHasChanges(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addMapping = () => {
    const newMapping: ColumnMapping = {
      id: `temp-${Date.now()}`,
      import_profile_id: selectedProfileId || "",
      source_column: "",
      pay_type_filter: null,
      target_kpi_name: "",
      is_per_user: true,
      metric_type: "unit",
      display_order: localMappings.length,
    };
    setLocalMappings([...localMappings, newMapping]);
    setHasChanges(true);
  };

  const removeMapping = (index: number) => {
    const updated = [...localMappings];
    updated.splice(index, 1);
    setLocalMappings(updated);
    setHasChanges(true);
  };

  const updateMapping = (index: number, field: keyof ColumnMapping, value: any) => {
    const updated = [...localMappings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-set metric type based on KPI name
    if (field === "target_kpi_name" && presetKpis) {
      const preset = presetKpis.find(p => p.name === value);
      if (preset) {
        updated[index].metric_type = preset.metric_type;
      }
    }
    
    setLocalMappings(updated);
    setHasChanges(true);
  };

  const populateDefaults = () => {
    const defaults: ColumnMapping[] = [];
    let order = 0;
    
    // Create default mappings from STANDARD_COLUMN_MAPPINGS
    for (const [payType, columns] of Object.entries(STANDARD_COLUMN_MAPPINGS)) {
      for (const [sourceCol, kpiName] of Object.entries(columns)) {
        defaults.push({
          id: `default-${order}`,
          import_profile_id: selectedProfileId || "",
          source_column: sourceCol,
          pay_type_filter: payType === "total" ? null : payType,
          target_kpi_name: kpiName,
          is_per_user: true,
          metric_type: kpiName.toLowerCase().includes("sales") ? "dollar" : "unit",
          display_order: order++,
        });
      }
    }
    
    setLocalMappings(defaults);
    setHasChanges(true);
  };

  if (!selectedProfileId) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Select value="" onValueChange={onSelectProfile}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an import profile..." />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Select an import profile to configure its column mappings
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-60 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedProfileId} onValueChange={onSelectProfile}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select an import profile..." />
            </SelectTrigger>
            <SelectContent>
              {profiles?.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {localMappings.length === 0 && (
            <Button variant="outline" onClick={populateDefaults}>
              Populate Defaults
            </Button>
          )}
          <Button variant="outline" onClick={addMapping}>
            <Plus className="h-4 w-4 mr-2" />
            Add Mapping
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Visual Mapper KPI Summary */}
      {selectedProfileId && (
        <Alert className="border-primary/20 bg-primary/5">
          <LayoutGrid className="h-4 w-4" />
          <AlertTitle className="flex items-center gap-2">
            Visual Mapper Configuration
          </AlertTitle>
          <AlertDescription className="mt-2">
            {mappedKpiNames.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {mappedKpiNames.length} KPI{mappedKpiNames.length !== 1 ? "s" : ""} mapped from the Visual Mapper:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {mappedKpiNames.map((kpiName) => (
                    <Badge key={kpiName} variant="secondary" className="text-xs">
                      {kpiName}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                  <Info className="h-3 w-3" />
                  Edit these mappings in the Visual Mapper (Super Admin Dashboard)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No KPIs mapped yet. Use the Visual Mapper to configure column-to-KPI mappings.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source Column</TableHead>
              <TableHead>Pay Type</TableHead>
              <TableHead>Target KPI</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Per User</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localMappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No mappings configured. Click "Populate Defaults" or "Add Mapping" to get started.
                </TableCell>
              </TableRow>
            ) : (
              localMappings.map((mapping, index) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <Input
                      value={mapping.source_column}
                      onChange={(e) => updateMapping(index, "source_column", e.target.value)}
                      placeholder="e.g., Sold Hrs"
                      className="w-full"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.pay_type_filter || "all"}
                      onValueChange={(v) => updateMapping(index, "pay_type_filter", v === "all" ? null : v)}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All/Total</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                        <SelectItem value="warranty">Warranty</SelectItem>
                        <SelectItem value="internal">Internal</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.target_kpi_name}
                      onValueChange={(v) => updateMapping(index, "target_kpi_name", v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select KPI..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presetKpis?.map((kpi) => (
                          <SelectItem key={kpi.name} value={kpi.name}>
                            {kpi.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapping.metric_type}
                      onValueChange={(v) => updateMapping(index, "metric_type", v)}
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dollar">Dollar</SelectItem>
                        <SelectItem value="unit">Unit</SelectItem>
                        <SelectItem value="percentage">%</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={mapping.is_per_user}
                      onCheckedChange={(v) => updateMapping(index, "is_per_user", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMapping(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
