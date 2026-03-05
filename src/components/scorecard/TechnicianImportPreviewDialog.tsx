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
import { Check, AlertCircle, Loader2, UserPlus, Copy, CheckCheck } from "lucide-react";
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

const SOLD_HRS_KPI_NAME = "Open and Closed Hours";

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
  const [debugCopied, setDebugCopied] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    techIndex: null,
    fullName: "",
    email: "",
    isSubmitting: false,
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

  const createUserMutation = useMutation({
    mutationFn: async ({ fullName, email }: { fullName: string; email: string }) => {
      // 1. Check aliases first (most reliable — set at end of successful import)
      const { data: alias } = await supabase
        .from("scorecard_user_aliases")
        .select("user_id")
        .eq("store_id", storeId)
        .eq("alias_name", fullName)
        .maybeSingle();

      if (alias) return { user: { id: alias.user_id } };

      // 2. Then check profiles by exact name match
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("store_id", storeId)
        .eq("full_name", fullName)
        .maybeSingle();

      if (existingProfile) {
        return { user: { id: existingProfile.id } };
      }

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
      const allWeeklyEntries: Array<{ kpi_id: string; week_start_date: string; entry_type: string; actual_value: number; created_by: string | undefined }> = [];
      const allMonthlyEntries: Array<{ kpi_id: string; month: string; entry_type: string; actual_value: number; created_by: string | undefined }> = [];
      // Productivity is calculated, never manually edited — collect IDs to exclude from protection filter
      const productivityKpiIdSet = new Set<string>();

      // Query current max display_order in this department so we can assign unique values per technician
      const { data: maxOrderRow } = await supabase
        .from("kpi_definitions")
        .select("display_order")
        .eq("department_id", departmentId)
        .order("display_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      let nextDisplayOrder = Math.max((maxOrderRow?.display_order ?? 9989), 9989) + 1;

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
            name: SOLD_HRS_KPI_NAME,
            metric_type: "unit",
            target_direction: "above",
            aggregation_type: "sum",
          },
          {
            name: "Productivity",
            metric_type: "percentage",
            target_direction: "above",
            aggregation_type: "average",
          },
        ];

        const kpiIdMap: Record<string, string> = {};
        // Track the base display_order for this technician's KPI block
        const techBaseOrder = nextDisplayOrder;

        for (const spec of kpiSpecs) {
          // Check existing — exact match to prevent duplicates
          const { data: existingList } = await supabase
            .from("kpi_definitions")
            .select("id, name")
            .eq("department_id", departmentId)
            .eq("assigned_to", selectedUserId)
            .eq("name", spec.name);

          if (existingList && existingList.length > 0) {
            kpiIdMap[spec.name] = existingList[0].id;
            // Clean up any duplicate KPI definitions
            if (existingList.length > 1) {
              const idsToDelete = existingList.slice(1).map((e) => e.id);
              await supabase.from("kpi_definitions").delete().in("id", idsToDelete);
            }
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
                display_order: nextDisplayOrder++,
              })
              .select("id")
              .single();
            if (createErr) throw createErr;
            kpiIdMap[spec.name] = created.id;
          }
        }

        // Enforce correct display_order sequence: Available=N, O&C=N+1, Productivity=N+2
        // This fixes ordering even if KPIs already existed with wrong order
        if (kpiIdMap["Available Hours"] && kpiIdMap[SOLD_HRS_KPI_NAME] && kpiIdMap["Productivity"]) {
          await Promise.all([
            supabase.from("kpi_definitions").update({ display_order: techBaseOrder }).eq("id", kpiIdMap["Available Hours"]),
            supabase.from("kpi_definitions").update({ display_order: techBaseOrder + 1 }).eq("id", kpiIdMap[SOLD_HRS_KPI_NAME]),
            supabase.from("kpi_definitions").update({ display_order: techBaseOrder + 2 }).eq("id", kpiIdMap["Productivity"]),
          ]);
          nextDisplayOrder = techBaseOrder + 3;
        }

        const availableId = kpiIdMap["Available Hours"];
        const soldId = kpiIdMap[SOLD_HRS_KPI_NAME];
        const productiveId = kpiIdMap["Productivity"];

        // Collect weekly entries for batch upsert
        for (const week of tech.weeklyTotals) {
          const base = { week_start_date: week.weekStartDate, entry_type: "weekly" as const, created_by: currentUserId };
          allWeeklyEntries.push(
            { ...base, kpi_id: availableId, actual_value: week.clockedInHrs },
            { ...base, kpi_id: soldId, actual_value: week.soldHrs },
          );
          if (week.productive !== null) {
            allWeeklyEntries.push({ ...base, kpi_id: productiveId, actual_value: parseFloat((week.productive * 100).toFixed(2)) });
          }
        }

        // Collect monthly entries for batch upsert
        for (const mo of tech.monthlyTotals) {
          const base = { month: mo.month, entry_type: "monthly" as const, created_by: currentUserId };
          allMonthlyEntries.push(
            { ...base, kpi_id: availableId, actual_value: mo.clockedInHrs },
            { ...base, kpi_id: soldId, actual_value: mo.soldHrs },
          );
          if (mo.productive !== null) {
            allMonthlyEntries.push({ ...base, kpi_id: productiveId, actual_value: parseFloat((mo.productive * 100).toFixed(2)) });
          }
        }

        // Track KPI count for this technician in the log
        metricsImported[tech.rawName] = Object.keys(kpiIdMap).length;
        // Collect Productivity KPI ID to exclude it from the manual-edit protection filter
        if (productiveId) productivityKpiIdSet.add(productiveId);
      }

      // Pre-fetch manually-edited entries to protect them from being overwritten

      const allKpiIds = [...new Set([
        ...allWeeklyEntries.map(e => e.kpi_id),
        ...allMonthlyEntries.map(e => e.kpi_id),
      ])];

      const [{ data: protectedWeekly }, { data: protectedMonthly }] = await Promise.all([
        supabase
          .from("scorecard_entries")
          .select("kpi_id, week_start_date")
          .in("kpi_id", allKpiIds)
          .eq("manually_edited", true)
          .eq("entry_type", "weekly"),
        supabase
          .from("scorecard_entries")
          .select("kpi_id, month")
          .in("kpi_id", allKpiIds)
          .eq("manually_edited", true)
          .eq("entry_type", "monthly"),
      ]);

      // Exclude Productivity KPI IDs from protection — they are always calculated, never manual
      const protectedWeeklyKeys = new Set(
        (protectedWeekly ?? [])
          .filter(e => !productivityKpiIdSet.has(e.kpi_id))
          .map(e => `${e.kpi_id}|${e.week_start_date}`)
      );
      const protectedMonthlyKeys = new Set(
        (protectedMonthly ?? [])
          .filter(e => !productivityKpiIdSet.has(e.kpi_id))
          .map(e => `${e.kpi_id}|${e.month}`)
      );

      const filteredWeekly = allWeeklyEntries.filter(
        e => !protectedWeeklyKeys.has(`${e.kpi_id}|${e.week_start_date}`)
      );
      const filteredMonthly = allMonthlyEntries.filter(
        e => !protectedMonthlyKeys.has(`${e.kpi_id}|${e.month}`)
      );

      // Deduplicate weekly entries — keep last value per kpi_id+week_start_date
      const weeklyMap = new Map<string, typeof filteredWeekly[0]>();
      for (const e of filteredWeekly) {
        weeklyMap.set(`${e.kpi_id}|${e.week_start_date}`, e);
      }
      const dedupedWeekly = Array.from(weeklyMap.values());

      // Deduplicate monthly entries — keep last value per kpi_id+month+entry_type
      const monthlyMap = new Map<string, typeof filteredMonthly[0]>();
      for (const e of filteredMonthly) {
        monthlyMap.set(`${e.kpi_id}|${e.month}|${e.entry_type}`, e);
      }
      const dedupedMonthly = Array.from(monthlyMap.values());

      // Batch upsert weekly entries (500 per batch)
      const BATCH = 500;
      for (let b = 0; b < dedupedWeekly.length; b += BATCH) {
        await supabase.from("scorecard_entries").upsert(
          dedupedWeekly.slice(b, b + BATCH),
          { onConflict: "kpi_id,week_start_date" }
        );
        if (b + BATCH < dedupedWeekly.length) await new Promise(r => setTimeout(r, 50));
      }

      // Batch upsert monthly entries
      for (let b = 0; b < dedupedMonthly.length; b += BATCH) {
        await supabase.from("scorecard_entries").upsert(
          dedupedMonthly.slice(b, b + BATCH),
          { onConflict: "kpi_id,month,entry_type" }
        );
        if (b + BATCH < dedupedMonthly.length) await new Promise(r => setTimeout(r, 50));
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
            {/* Debug panel — shown only when 0 technicians detected */}
            {parseResult.technicians.length === 0 && parseResult.debugInfo && (() => {
              const d = parseResult.debugInfo!;
              const debugText = [
                `Sheet: "${d.sheetName}"   Total rows: ${d.totalRows}`,
                `Header row: ${d.headerRowIndex}   Layout: "${d.detectedLayout}"`,
                `Date col: ${d.dateColIdx}   Sold col: ${d.soldColIdx}   Clock col: ${d.clockColIdx}`,
                ``,
                `Header row content:`,
                `  [${d.headerRowContent.map(c => c || "—").join("] [")}]`,
                ``,
                `First 10 data rows (after header):`,
                ...d.first10DataRows.map((r, i) =>
                  `  Row ${d.headerRowIndex + 1 + i}: [${r.map(c => c || "—").join("] [")}]`
                ),
              ].join("\n");

              return (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    No technicians detected in this file
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The parser could not find any technician blocks. The debug info below shows what was actually detected — share this with support to help fix the parser for this report format.
                  </p>
                  <div className="relative">
                    <pre className="text-xs bg-muted rounded p-3 overflow-x-auto whitespace-pre font-mono leading-5">
                      {debugText}
                    </pre>
                    <button
                      className="absolute top-2 right-2 p-1 rounded hover:bg-muted-foreground/20 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(debugText);
                        setDebugCopied(true);
                        setTimeout(() => setDebugCopied(false), 2000);
                      }}
                      title="Copy debug info"
                    >
                      {debugCopied
                        ? <CheckCheck className="h-3.5 w-3.5 text-primary" />
                        : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Technician Mappings */}
            {parseResult.technicians.length > 0 && <div className="space-y-2">
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
            </div>}

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
                        <th className="text-right py-1 pr-3">{SOLD_HRS_KPI_NAME}</th>
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
