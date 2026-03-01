import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Check, AlertCircle, Loader2, UserPlus, Settings } from "lucide-react";
import {
  TechnicianHoursParseResult,
  TechnicianData,
} from "@/utils/parsers/parseTechnicianHoursReport";

interface TechnicianImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseResult: TechnicianHoursParseResult;
  fileName: string;
  file?: File | null;
  departmentId: string;
  storeId: string;
  month: string;
  onImportSuccess: () => void;
}

interface TechMapping {
  tech: TechnicianData;
  selectedUserId: string | null;
  isNew: boolean;
}

interface NewUserForm {
  techIndex: number | null;
  fullName: string;
  email: string;
  isSubmitting: boolean;
}

// KPI label options
const SOLD_HOURS_OPTIONS = [
  { value: "open_and_closed_hours", label: "Open and Closed Hours" },
  { value: "closed_hours", label: "Closed Hours" },
] as const;

const getSoldHrsKpiName = (label: string) =>
  label === "open_and_closed_hours" ? "Open and Closed Hours" : "Closed Hours";

export const TechnicianImportPreviewDialog = ({
  open,
  onOpenChange,
  parseResult,
  fileName,
  file,
  departmentId,
  storeId,
  month,
  onImportSuccess,
}: TechnicianImportPreviewDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mappings, setMappings] = useState<TechMapping[]>([]);
  const mappingsRef = useRef<TechMapping[]>([]);
  useEffect(() => { mappingsRef.current = mappings; }, [mappings]);
  const [soldHrsLabel, setSoldHrsLabel] = useState<string>("closed_hours");
  const [labelSaved, setLabelSaved] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    techIndex: null,
    fullName: "",
    email: "",
    isSubmitting: false,
  });

  // Fetch department to get saved technician_sold_hours_label
  const { data: department } = useQuery({
    queryKey: ["department-tech-label", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, technician_sold_hours_label")
        .eq("id", departmentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!departmentId,
  });

  // Fetch store users (technicians preferred)
  const { data: storeUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["store-users-tech-import", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("store_id", storeId)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!storeId,
  });

  // Fetch user aliases for pre-population
  const { data: userAliases } = useQuery({
    queryKey: ["user-aliases-tech", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_user_aliases")
        .select("user_id, alias_name")
        .eq("store_id", storeId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!storeId,
  });

  // Set sold hours label from saved department preference
  useEffect(() => {
    if (department?.technician_sold_hours_label) {
      setSoldHrsLabel(department.technician_sold_hours_label);
      setLabelSaved(true);
    }
  }, [department]);

  const hasInitialized = useRef(false);

  // Build initial mappings when data is ready — runs once per dialog open
  useEffect(() => {
    if (!open) { hasInitialized.current = false; return; }
    if (hasInitialized.current) return;
    if (!parseResult.technicians || !userAliases) return;
    hasInitialized.current = true;

    const aliasMap = new Map<string, string>();
    for (const alias of userAliases) {
      aliasMap.set(alias.alias_name.toLowerCase().trim(), alias.user_id);
    }

    // Deduplicate technicians by normalized name (safety net over parser)
    const seen = new Map<string, typeof parseResult.technicians[0]>();
    for (const tech of parseResult.technicians) {
      const key = tech.rawName.toLowerCase().replace(/\s+/g, " ").trim();
      if (!seen.has(key)) seen.set(key, tech);
    }
    const uniqueTechs = Array.from(seen.values());

    const initialMappings: TechMapping[] = uniqueTechs.map((tech) => {
      const byDisplay = aliasMap.get(tech.displayName.toLowerCase().trim());
      const byRaw = aliasMap.get(tech.rawName.toLowerCase().trim());
      let matchedUserId = byDisplay || byRaw || null;

      // Fallback: first-name match
      if (!matchedUserId && storeUsers) {
        const firstName = tech.displayName.split(/\s+/)[0]?.toLowerCase();
        if (firstName && firstName.length >= 2) {
          const matches = storeUsers.filter(
            (u) => u.full_name?.split(/\s+/)[0]?.toLowerCase() === firstName
          );
          if (matches.length === 1) matchedUserId = matches[0].id;
        }
      }

      return { tech, selectedUserId: matchedUserId, isNew: false };
    });

    setMappings(initialMappings);
  }, [open, parseResult.technicians, userAliases]);

  const saveLabelMutation = useMutation({
    mutationFn: async (label: string) => {
      const { error } = await supabase
        .from("departments")
        .update({ technician_sold_hours_label: label })
        .eq("id", departmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      setLabelSaved(true);
      queryClient.invalidateQueries({ queryKey: ["department-tech-label", departmentId] });
      toast({ title: "KPI label preference saved" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ fullName, email }: { fullName: string; email: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const resp = await supabase.functions.invoke("create-user", {
        body: {
          email,
          full_name: fullName,
          role: "technician",
          store_id: storeId,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (resp.error) throw new Error(resp.error.message);
      return resp.data;
    },
    onSuccess: async (data, _vars) => {
      toast({ title: "User created", description: `${_vars.fullName} added as Technician` });
      // Wait for edge function to finish writing store_id to profile
      await new Promise((resolve) => setTimeout(resolve, 600));
      // Invalidate + refetch so the new user appears in the list
      await queryClient.invalidateQueries({ queryKey: ["store-users-tech-import", storeId] });
      await refetchUsers();
      // Auto-select newly created user (after refetch so they're in the list)
      if (data?.user?.id && newUserForm.techIndex !== null) {
        setMappings((prev) => {
          const updated = [...prev];
          updated[newUserForm.techIndex!] = {
            ...updated[newUserForm.techIndex!],
            selectedUserId: data.user.id,
            isNew: false,
          };
          return updated;
        });
      }
      setNewUserForm({ techIndex: null, fullName: "", email: "", isSubmitting: false });
    },
    onError: (err: any) => {
      toast({ title: "Failed to create user", description: err.message, variant: "destructive" });
      setNewUserForm((prev) => ({ ...prev, isSubmitting: false }));
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData.user?.id;

      const kpiLabel = getSoldHrsKpiName(soldHrsLabel);

      // Save label to department if not saved yet
      if (!labelSaved) {
        await supabase
          .from("departments")
          .update({ technician_sold_hours_label: soldHrsLabel })
          .eq("id", departmentId);
      }

      // Upload file
      let reportFilePath: string | null = null;
      if (file) {
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${storeId}/${departmentId}/${month}/${timestamp}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("scorecard-imports")
          .upload(path, file);
        if (!uploadError) reportFilePath = path;
      }

      // For each mapped technician — use ref to get latest mappings (avoid stale closure)
      const currentMappings = mappingsRef.current;
      const metricsImported: Record<string, number> = {};
      for (let i = 0; i < currentMappings.length; i++) {
        const { tech, selectedUserId } = currentMappings[i];
        if (!selectedUserId) continue;

        // Save alias
        await supabase.from("scorecard_user_aliases").upsert(
          {
            store_id: storeId,
            alias_name: tech.rawName,
            user_id: selectedUserId,
          },
          { onConflict: "store_id,alias_name" }
        );

        // Ensure the 3 KPIs exist for this technician
        const kpiSpecs = [
          {
            name: "Available Hours",
            metric_type: "unit",
            target_direction: "above",
            aggregation_type: "sum",
          },
          {
            name: kpiLabel,
            metric_type: "unit",
            target_direction: "above",
            aggregation_type: "sum",
          },
          {
            name: "Productive",
            metric_type: "percentage",
            target_direction: "above",
            aggregation_type: "average",
          },
        ];

        const kpiIdMap: Record<string, string> = {};
        for (const spec of kpiSpecs) {
          // Check existing
          const { data: existing } = await supabase
            .from("kpi_definitions")
            .select("id, name")
            .eq("department_id", departmentId)
            .eq("assigned_to", selectedUserId)
            .ilike("name", spec.name)
            .maybeSingle();

          if (existing) {
            kpiIdMap[spec.name] = existing.id;
          } else {
            const { data: created, error: createErr } = await supabase
              .from("kpi_definitions")
              .insert({
                department_id: departmentId,
                assigned_to: selectedUserId,
                name: spec.name,
                metric_type: spec.metric_type,
                target_direction: spec.target_direction,
                aggregation_type: spec.aggregation_type,
                display_order: 9999,
              })
              .select("id")
              .single();
            if (createErr) throw createErr;
            kpiIdMap[spec.name] = created.id;
          }
        }

        const availableId = kpiIdMap["Available Hours"];
        const soldId = kpiIdMap[kpiLabel];
        const productiveId = kpiIdMap["Productive"];

        // Upsert weekly entries
        for (const week of tech.weeklyTotals) {
          const baseEntry = {
            kpi_id: "",
            week_start_date: week.weekStartDate,
            entry_type: "weekly",
            created_by: currentUserId,
          };

          const entries = [
            { ...baseEntry, kpi_id: availableId, actual_value: week.clockedInHrs },
            { ...baseEntry, kpi_id: soldId, actual_value: week.soldHrs },
            {
              ...baseEntry,
              kpi_id: productiveId,
              actual_value: week.productive !== null ? parseFloat((week.productive * 100).toFixed(2)) : null,
            },
          ].filter((e) => e.actual_value !== null);

          for (const entry of entries) {
            await supabase.from("scorecard_entries").upsert(
              {
                kpi_id: entry.kpi_id,
                week_start_date: entry.week_start_date,
                entry_type: entry.entry_type,
                actual_value: entry.actual_value,
                created_by: entry.created_by,
              },
              { onConflict: "kpi_id,week_start_date,entry_type" }
            );
          }
        }

        // Upsert monthly entries
        for (const mo of tech.monthlyTotals) {
          const monthEntries = [
            { kpi_id: availableId, actual_value: mo.clockedInHrs, week_start_date: mo.month + "-01" },
            { kpi_id: soldId, actual_value: mo.soldHrs, week_start_date: mo.month + "-01" },
            {
              kpi_id: productiveId,
              actual_value: mo.productive !== null ? parseFloat((mo.productive * 100).toFixed(2)) : null,
              week_start_date: mo.month + "-01",
            },
          ].filter((e) => e.actual_value !== null);

          for (const entry of monthEntries) {
            await supabase.from("scorecard_entries").upsert(
              {
                kpi_id: entry.kpi_id,
                week_start_date: entry.week_start_date,
                entry_type: "monthly",
                actual_value: entry.actual_value,
                created_by: currentUserId,
              },
              { onConflict: "kpi_id,week_start_date,entry_type" }
            );
          }
        }

        // Track KPI count for this technician in the log
        metricsImported[tech.rawName] = Object.keys(kpiIdMap).length;
      }

      // Log the import
      await supabase.from("scorecard_import_logs").insert({
        department_id: departmentId,
        store_id: storeId,
        month,
        file_name: fileName,
        report_file_path: reportFilePath,
        imported_by: currentUserId,
        import_source: "technician_hours",
        metrics_imported: metricsImported,
        status: "success",
      });
    },
    onSuccess: () => {
      toast({ title: "Import complete", description: "Technician KPIs updated" });
      onImportSuccess();
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const mappedCount = mappings.filter((m) => m.selectedUserId).length;
  const unmappedCount = mappings.length - mappedCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Preview Technician Import</DialogTitle>
          <DialogDescription>
            {fileName} — {parseResult.technicians.length} technician(s) detected
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <div className="space-y-5">
            {/* Sold Hours KPI Label Setting */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings className="h-4 w-4 text-muted-foreground" />
                Sold Hours KPI Name
                {labelSaved && (
                  <Badge variant="secondary" className="text-xs ml-auto">
                    <Check className="h-3 w-3 mr-1" /> Saved for this department
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Select value={soldHrsLabel} onValueChange={(v) => { setSoldHrsLabel(v); setLabelSaved(false); }}>
                  <SelectTrigger className="w-[260px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOLD_HOURS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!labelSaved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => saveLabelMutation.mutate(soldHrsLabel)}
                    disabled={saveLabelMutation.isPending}
                  >
                    {saveLabelMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save preference"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This sets the KPI name used for sold/productive hours. It will be remembered for future imports.
              </p>
            </div>

            {/* Technician Mappings */}
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Map technicians to users ({mappedCount}/{mappings.length} mapped)
              </div>

              {mappings.map((mapping, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{mapping.tech.rawName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {mapping.tech.weeklyTotals.length} week(s) ·{" "}
                        Sold: {mapping.tech.weeklyTotals.reduce((s, w) => s + w.soldHrs, 0).toFixed(1)} hrs ·{" "}
                        Available: {mapping.tech.weeklyTotals.reduce((s, w) => s + w.clockedInHrs, 0).toFixed(1)} hrs
                      </div>
                    </div>

                    {mapping.selectedUserId ? (
                      <Badge variant="secondary" className="shrink-0">
                        <Check className="h-3 w-3 mr-1" />
                        {storeUsers?.find((u) => u.id === mapping.selectedUserId)?.full_name ?? "Mapped"}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="shrink-0">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Unmapped
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={mapping.selectedUserId ?? ""}
                      onValueChange={(v) => {
                        setMappings((prev) => {
                          const u = [...prev];
                          u[idx] = { ...u[idx], selectedUserId: v || null };
                          return u;
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="Select user…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(storeUsers ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name}
                            {u.role === "technician" && (
                              <span className="ml-1 text-muted-foreground">(Tech)</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 shrink-0"
                      onClick={() =>
                        setNewUserForm({
                          techIndex: idx,
                          fullName: mapping.tech.displayName,
                          email: "",
                          isSubmitting: false,
                        })
                      }
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Inline create user form */}
                  {newUserForm.techIndex === idx && (
                    <div className="rounded bg-muted/50 p-3 space-y-2 border">
                      <div className="text-xs font-medium">Create new user</div>
                       <div>
                        <Label className="text-xs">Full Name</Label>
                        <Input
                          className="h-8 text-xs"
                          value={newUserForm.fullName}
                          onChange={(e) =>
                            setNewUserForm((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                        />
                        {newUserForm.fullName && storeUsers?.some(
                          (u) => u.full_name?.toLowerCase().trim() === newUserForm.fullName.toLowerCase().trim()
                        ) && (
                          <p className="text-xs text-destructive mt-1">This name already exists at this store.</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={!newUserForm.fullName || createUserMutation.isPending || !!storeUsers?.some(
                            (u) => u.full_name?.toLowerCase().trim() === newUserForm.fullName.toLowerCase().trim()
                          )}
                          onClick={() => {
                            const nameExists = storeUsers?.some(
                              (u) => u.full_name?.toLowerCase().trim() === newUserForm.fullName.toLowerCase().trim()
                            );
                            if (nameExists) {
                              toast({ title: "User already exists", description: `${newUserForm.fullName} is already a user at this store.`, variant: "destructive" });
                              return;
                            }
                            createUserMutation.mutate({
                              fullName: newUserForm.fullName,
                              email: newUserForm.email,
                            });
                          }}
                        >
                          {createUserMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : null}
                          Create Technician
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            setNewUserForm({ techIndex: null, fullName: "", email: "", isSubmitting: false })
                          }
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Weekly totals preview */}
            {mappings.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="text-sm font-medium">Weekly totals preview (first technician)</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground border-b">
                        <th className="text-left py-1 pr-3">Week starting</th>
                        <th className="text-right py-1 pr-3">Available Hrs</th>
                        <th className="text-right py-1 pr-3">{getSoldHrsKpiName(soldHrsLabel)}</th>
                        <th className="text-right py-1">Productive %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings[0].tech.weeklyTotals.map((w) => (
                        <tr key={w.weekStartDate} className="border-b border-border/50">
                          <td className="py-1 pr-3">{w.weekStartDate}</td>
                          <td className="text-right py-1 pr-3">{w.clockedInHrs.toFixed(1)}</td>
                          <td className="text-right py-1 pr-3">{w.soldHrs.toFixed(1)}</td>
                          <td className="text-right py-1">
                            {w.productive !== null ? `${(w.productive * 100).toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t mt-2">
          <div className="text-xs text-muted-foreground">
            {unmappedCount > 0 && (
              <span className="text-destructive">{unmappedCount} unmapped (will be skipped)</span>
            )}
            {unmappedCount === 0 && mappedCount > 0 && (
              <span className="text-primary">All technicians mapped ✓</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={mappedCount === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importing…
                </>
              ) : (
                `Import ${mappedCount} Technician${mappedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
