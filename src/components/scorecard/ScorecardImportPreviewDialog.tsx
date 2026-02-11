import React, { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Check, AlertCircle, Loader2, UserPlus } from "lucide-react";
import { CSRParseResult, AdvisorData } from "@/utils/parsers/parseCSRProductivityReport";
import { createUserAlias, getStandardKpiName } from "@/utils/scorecardImportMatcher";

interface ScorecardImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseResult: CSRParseResult;
  fileName: string;
  file?: File | null;
  departmentId: string;
  storeId: string;
  month: string;
  /** For weekly imports - ISO date string like "2026-01-06" */
  weekStartDate?: string;
  onImportSuccess: () => void;
}

interface AdvisorMapping {
  advisor: AdvisorData;
  selectedUserId: string | null;
  prefilledFromAlias: boolean;
}

export const ScorecardImportPreviewDialog = ({
  open,
  onOpenChange,
  parseResult,
  fileName,
  file,
  departmentId,
  storeId,
  month,
  weekStartDate,
  onImportSuccess,
}: ScorecardImportPreviewDialogProps) => {
  const [advisorMappings, setAdvisorMappings] = useState<AdvisorMapping[]>([]);
  const [deptTotalsUserId, setDeptTotalsUserId] = useState<string | null>(null);
  const [deptTotalsPrefilledFromAlias, setDeptTotalsPrefilledFromAlias] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const { toast } = useToast();

  // Fetch KPI definitions for this department
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["kpi-definitions-for-import", departmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("id, name, metric_type, target_direction, assigned_to")
        .eq("department_id", departmentId);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch the store's group to find the right import profile
  const { data: storeData } = useQuery({
    queryKey: ["store-group-for-import", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, group_id")
        .eq("id", storeId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId,
  });

  // Fetch store users for manual matching (current store only)
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-for-import", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, store_id, store_group_id")
        .eq("store_id", storeId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId,
  });

  // Fetch the active import profile for this store group (or universal profile if none exists)
  const { data: importProfile } = useQuery({
    queryKey: ["import-profile-for-store", storeData?.group_id],
    queryFn: async () => {
      if (!storeData?.group_id) return null;
      
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("*")
        .eq("is_active", true)
        .or(`store_group_id.eq.${storeData.group_id},store_group_id.is.null`);
      
      if (error) throw error;
      if (!data || data.length === 0) return null;
      
      const specificMatch = data.find(p => p.store_group_id === storeData.group_id);
      const universalMatch = data.find(p => p.store_group_id === null);
      
      return specificMatch || universalMatch || null;
    },
    enabled: open && !!storeData?.group_id,
  });

  // Fetch cell mappings filtered to users belonging to the current store
  const { data: cellMappings } = useQuery({
    queryKey: ["cell-mappings-for-import", importProfile?.id, storeId],
    queryFn: async () => {
      if (!importProfile?.id || !storeId) return [];
      
      const { data: storeProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id")
        .eq("store_id", storeId);
      if (profilesError) throw profilesError;
      
      const storeUserIds = storeProfiles?.map(p => p.id) || [];
      if (storeUserIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("scorecard_cell_mappings")
        .select("*, kpi_definitions(name)")
        .eq("import_profile_id", importProfile.id)
        .in("user_id", storeUserIds);
      if (error) throw error;
      
      const mappingsWithNames = (data || []).map(cm => ({
        ...cm,
        kpi_name: cm.kpi_definitions?.name || cm.kpi_name || 'Unknown KPI'
      }));
      
      return mappingsWithNames;
    },
    enabled: open && !!importProfile?.id && !!storeId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Fetch user aliases for pre-populating dropdowns
  const { data: userAliases } = useQuery({
    queryKey: ["user-aliases-for-import", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_user_aliases")
        .select("user_id, alias_name")
        .eq("store_id", storeId);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!storeId,
  });

  // Build a universal mapping template from cell mappings
  const universalMappingTemplate = useMemo(() => {
    if (!cellMappings || cellMappings.length === 0) return new Map<string, { kpiName: string; colIndex: number; rowOffset: number }>();
    
    const template = new Map<string, { kpiName: string; colIndex: number; rowOffset: number }>();
    for (const cm of cellMappings) {
      const key = `${cm.col_index}:${cm.row_index ?? 0}`;
      if (!template.has(key)) {
        template.set(key, {
          kpiName: cm.kpi_name,
          colIndex: cm.col_index,
          rowOffset: cm.row_index ?? 0,
        });
      }
    }
    return template;
  }, [cellMappings]);

  // Initialize mappings from aliases when data is ready - no fuzzy matching
  useEffect(() => {
    if (!open) return;
    
    if (!parseResult.advisors || parseResult.advisors.length === 0) {
      setAdvisorMappings([]);
      setIsInitializing(false);
      return;
    }

    if (!userAliases) return; // Wait for aliases to load

    setIsInitializing(true);

    // Build alias lookup: lowercase alias_name -> user_id
    const aliasMap = new Map<string, string>();
    for (const alias of userAliases) {
      aliasMap.set(alias.alias_name.toLowerCase().trim(), alias.user_id);
    }

    // Map each advisor row, pre-filling from aliases only
    const mappings: AdvisorMapping[] = parseResult.advisors.map(advisor => {
      // Check both displayName and rawName against aliases
      const byDisplay = aliasMap.get(advisor.displayName.toLowerCase().trim());
      const byRaw = aliasMap.get(advisor.rawName.toLowerCase().trim());
      const matchedUserId = byDisplay || byRaw || null;

      return {
        advisor,
        selectedUserId: matchedUserId,
        prefilledFromAlias: !!matchedUserId,
      };
    });

    setAdvisorMappings(mappings);

    // Pre-fill dept totals from alias (e.g. "All Repair Orders" -> some user)
    const deptTotalsPatterns = [
      /all repair orders/i,
      /total repair orders/i,
      /department total/i,
      /dept total/i,
    ];
    
    let deptTotalsMatch: string | null = null;
    for (const alias of userAliases) {
      if (deptTotalsPatterns.some(p => p.test(alias.alias_name))) {
        deptTotalsMatch = alias.user_id;
        break;
      }
    }
    setDeptTotalsUserId(deptTotalsMatch);
    setDeptTotalsPrefilledFromAlias(!!deptTotalsMatch);
    
    setIsInitializing(false);
  }, [open, parseResult.advisors, userAliases]);

  const handleUserSelect = (advisorIndex: number, userId: string) => {
    setAdvisorMappings(prev => {
      const updated = [...prev];
      updated[advisorIndex] = {
        ...updated[advisorIndex],
        selectedUserId: userId,
        prefilledFromAlias: false,
      };
      return updated;
    });
  };

  const handleDeptTotalsUserSelect = (userId: string) => {
    setDeptTotalsUserId(userId);
    setDeptTotalsPrefilledFromAlias(false);
  };

  // Check if dept totals data exists
  const hasDeptTotals = parseResult?.departmentTotals && (
    Object.keys(parseResult.departmentTotals.total || {}).length > 0 ||
    Object.keys(parseResult.departmentTotals.customer || {}).length > 0
  );

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const isWeeklyImport = !!weekStartDate;
      const periodIdentifier = isWeeklyImport ? weekStartDate : month;
      const entryType = isWeeklyImport ? "weekly" : "monthly";

      // Upload original report file
      let reportFilePath: string | null = null;
      if (file) {
        const safeName = (file.name || fileName || "report.xlsx")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(-120);
        const storagePath = `${storeId}/${departmentId}/${periodIdentifier}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("scorecard-imports")
          .upload(storagePath, file, {
            upsert: true,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) throw uploadError;
        reportFilePath = storagePath;
      }

      // Create aliases for newly assigned users (not pre-filled from alias)
      for (const mapping of advisorMappings) {
        if (mapping.selectedUserId && !mapping.prefilledFromAlias) {
          await createUserAlias(
            storeId,
            mapping.advisor.displayName,
            mapping.selectedUserId,
            userId || ""
          );
        }
      }

      // Save dept totals alias if newly assigned
      if (deptTotalsUserId && !deptTotalsPrefilledFromAlias) {
        await createUserAlias(
          storeId,
          "All Repair Orders",
          deptTotalsUserId,
          userId || ""
        );
      }

      // Prepare entries to upsert
      const entriesToUpsert: Array<{
        kpi_id: string;
        month?: string;
        week_start_date?: string;
        entry_type: string;
        actual_value: number;
      }> = [];

      const createEntry = (kpiId: string, value: number) => {
        if (isWeeklyImport) {
          return { kpi_id: kpiId, week_start_date: periodIdentifier, entry_type: entryType, actual_value: value };
        } else {
          return { kpi_id: kpiId, month: periodIdentifier, entry_type: entryType, actual_value: value };
        }
      };

      const hasUniversalMappings = universalMappingTemplate.size > 0;

      if (kpiDefinitions) {
        if (hasUniversalMappings) {
          // Process matched advisors using the universal template
          for (const mapping of advisorMappings) {
            if (!mapping.selectedUserId) continue;

            const userKpis = kpiDefinitions.filter(k => k.assigned_to === mapping.selectedUserId);
            
            for (const [, tmpl] of universalMappingTemplate) {
              const { kpiName, colIndex, rowOffset } = tmpl;
              const userKpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
              if (!userKpi) continue;
              
              const payType = (mapping.advisor as any).payTypeByRowOffset?.[rowOffset];
              let value: number | undefined;
              if (payType) {
                value = mapping.advisor.metricsByIndex[payType]?.[colIndex];
              }
              
              if (typeof value === 'number') {
                entriesToUpsert.push(createEntry(userKpi.id, value));
              }
            }
          }
          
          // Process dept totals user
          if (deptTotalsUserId) {
            const userKpis = kpiDefinitions.filter(k => k.assigned_to === deptTotalsUserId);
            
            for (const [, tmpl] of universalMappingTemplate) {
              const { kpiName, colIndex, rowOffset } = tmpl;
              const userKpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
              if (!userKpi) continue;
              
              // Determine intended pay type from advisor row offsets
              let intendedPayType: "customer" | "warranty" | "internal" | "total" | null = null;
              for (const am of advisorMappings) {
                const pt = am.advisor.payTypeByRowOffset?.[rowOffset];
                if (pt) { intendedPayType = pt as any; break; }
              }
              
              let value: number | undefined;
              if (intendedPayType) {
                value = parseResult.departmentTotalsByIndex[intendedPayType]?.[colIndex];
              } else {
                for (const pt of ["customer", "warranty", "internal", "total"] as const) {
                  const v = parseResult.departmentTotalsByIndex[pt]?.[colIndex];
                  if (typeof v === 'number') { value = v; break; }
                }
              }
              
              if (typeof value === 'number') {
                entriesToUpsert.push(createEntry(userKpi.id, value));
              }
            }
          }
        }

        // Fallback: department totals with standard mappings for un-assigned KPIs
        for (const [columnName, value] of Object.entries(parseResult.departmentTotals.total)) {
          const kpiName = getStandardKpiName(columnName, "total");
          if (kpiName) {
            const kpi = kpiDefinitions.find(k => k.name.toLowerCase() === kpiName.toLowerCase() && !k.assigned_to);
            if (kpi) entriesToUpsert.push(createEntry(kpi.id, value));
          }
        }

        for (const [columnName, value] of Object.entries(parseResult.departmentTotals.customer)) {
          const kpiName = getStandardKpiName(columnName, "customer");
          if (kpiName) {
            const kpi = kpiDefinitions.find(k => k.name.toLowerCase() === kpiName.toLowerCase() && !k.assigned_to);
            if (kpi) entriesToUpsert.push(createEntry(kpi.id, value));
          }
        }

        // LEGACY FALLBACK: Process per-advisor data when NO universal mappings exist
        if (!hasUniversalMappings) {
          for (const mapping of advisorMappings) {
            if (!mapping.selectedUserId) continue;
            const userKpis = kpiDefinitions.filter(k => k.assigned_to === mapping.selectedUserId);
            
            for (const [columnName, value] of Object.entries(mapping.advisor.metrics.total)) {
              const kpiName = getStandardKpiName(columnName, "total");
              if (kpiName) {
                const kpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
                if (kpi) entriesToUpsert.push(createEntry(kpi.id, value));
              }
            }

            for (const [columnName, value] of Object.entries(mapping.advisor.metrics.customer)) {
              const kpiName = getStandardKpiName(columnName, "customer");
              if (kpiName) {
                const kpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
                if (kpi) entriesToUpsert.push(createEntry(kpi.id, value));
              }
            }
          }
        }
      }

      // Deduplicate entries
      const deduplicatedEntries = Array.from(
        entriesToUpsert.reduce((map, entry) => {
          const key = isWeeklyImport 
            ? `${entry.kpi_id}:${entry.week_start_date}:${entry.entry_type}`
            : `${entry.kpi_id}:${entry.month}:${entry.entry_type}`;
          map.set(key, entry);
          return map;
        }, new Map<string, typeof entriesToUpsert[0]>()).values()
      );

      if (deduplicatedEntries.length > 0) {
        const conflictKey = isWeeklyImport ? "kpi_id,week_start_date,entry_type" : "kpi_id,month,entry_type";
        const { error } = await supabase
          .from("scorecard_entries")
          .upsert(deduplicatedEntries, { onConflict: conflictKey });
        if (error) throw error;
      }

      // Log the import
      const unmatchedAdvisors = advisorMappings.filter(m => !m.selectedUserId).map(m => m.advisor.displayName);

      await supabase
        .from("scorecard_import_logs")
        .insert({
          department_id: departmentId,
          store_id: storeId,
          imported_by: userId,
          import_source: "drop_zone",
          file_name: fileName,
          month: periodIdentifier,
          report_file_path: reportFilePath,
          metrics_imported: { count: deduplicatedEntries.length },
          user_mappings: Object.fromEntries(
            advisorMappings
              .filter(m => m.selectedUserId)
              .map(m => [m.advisor.displayName, m.selectedUserId])
          ),
          unmatched_users: unmatchedAdvisors,
          warnings: [],
          status: unmatchedAdvisors.length === 0 ? "success" : "partial",
        });

      return deduplicatedEntries.length;
    },
    onSuccess: (count) => {
      toast({ title: "Import complete", description: `Imported ${count} scorecard entries` });
      onImportSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  // Calculate counts
  const assignedAdvisors = advisorMappings.filter(m => m.selectedUserId).length;
  const totalRows = advisorMappings.length + (hasDeptTotals ? 1 : 0);
  const assignedRows = assignedAdvisors + (deptTotalsUserId ? 1 : 0);
  const unassignedCount = totalRows - assignedRows;

  // Format period for display
  const formatPeriod = () => {
    if (weekStartDate) {
      const date = new Date(weekStartDate);
      const endDate = new Date(date);
      endDate.setDate(date.getDate() + 6);
      const startLabel = `${date.getMonth() + 1}/${date.getDate()}`;
      const endLabel = `${endDate.getMonth() + 1}/${endDate.getDate()}`;
      return `Week of ${startLabel}-${endLabel}, ${date.getFullYear()}`;
    }
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // Get selected user name helper
  const getUserName = (userId: string | null) => {
    if (!userId || !storeUsers) return null;
    return storeUsers.find(u => u.id === userId)?.full_name || null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Preview: {fileName}</DialogTitle>
          <DialogDescription>
            {parseResult.storeName} • {formatPeriod()}
          </DialogDescription>
        </DialogHeader>

        {/* Visual Mapper indicator */}
        {cellMappings && cellMappings.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <Check className="h-5 w-5 text-purple-600" />
            <span className="text-sm">
              Using Visual Mapper configuration ({cellMappings.length} column mappings)
            </span>
          </div>
        )}

        {/* Info banner */}
        {unassignedCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm">
              {unassignedCount} row{unassignedCount !== 1 ? "s" : ""} not assigned. 
              Select users below to assign ownership.
            </span>
          </div>
        )}

        {/* Mapping Table */}
        <ScrollArea className="max-h-[400px]">
          {isInitializing ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : advisorMappings.length === 0 && !hasDeptTotals ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No advisor rows found in this report.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead>Report Row</TableHead>
                    <TableHead>Assign To</TableHead>
                    {cellMappings && cellMappings.length > 0 ? (
                      [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                        <TableHead key={kpiName} className="text-xs whitespace-nowrap">
                          {kpiName}
                        </TableHead>
                      ))
                    ) : (
                      <>
                        <TableHead>Total Hrs</TableHead>
                        <TableHead>CP Hrs</TableHead>
                        <TableHead>Lab Sold</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Advisor rows */}
                  {advisorMappings.map((mapping, index) => {
                    const previewValues: Record<string, number | null> = {};
                    if (universalMappingTemplate.size > 0) {
                      for (const [, tmpl] of universalMappingTemplate) {
                        const payType = (mapping.advisor as any).payTypeByRowOffset?.[tmpl.rowOffset];
                        if (payType) {
                          const value = mapping.advisor.metricsByIndex[payType]?.[tmpl.colIndex];
                          if (typeof value === 'number') previewValues[tmpl.kpiName] = value;
                        }
                      }
                    }

                    return (
                      <TableRow key={mapping.advisor.rawName}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {mapping.selectedUserId ? (
                              <Check className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                            <span className="text-sm">{mapping.advisor.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.selectedUserId || ""}
                            onValueChange={(v) => handleUserSelect(index, v)}
                          >
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                              <SelectValue placeholder="Select user..." />
                            </SelectTrigger>
                            <SelectContent>
                              {storeUsers?.map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {mapping.prefilledFromAlias && mapping.selectedUserId && (
                            <Badge className="ml-2 bg-green-500/20 text-green-700 text-[10px]">
                              Saved
                            </Badge>
                          )}
                        </TableCell>
                        {cellMappings && cellMappings.length > 0 ? (
                          [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                            <TableCell key={kpiName} className="text-xs whitespace-nowrap">
                              {previewValues[kpiName] != null ? previewValues[kpiName]!.toLocaleString() : "-"}
                            </TableCell>
                          ))
                        ) : (
                          <>
                            <TableCell>{mapping.advisor.metrics.total["Sold Hrs"]?.toLocaleString() || "-"}</TableCell>
                            <TableCell>{mapping.advisor.metrics.customer["Sold Hrs"]?.toLocaleString() || "-"}</TableCell>
                            <TableCell>${mapping.advisor.metrics.customer["Lab Sold"]?.toLocaleString() || "0"}</TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}

                  {/* Dept Totals row (All Repair Orders) */}
                  {hasDeptTotals && (
                    <TableRow className="bg-purple-500/5 border-t-2">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {deptTotalsUserId ? (
                            <Check className="h-4 w-4 text-purple-500 shrink-0" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                          <div>
                            <span className="text-sm font-medium">All Repair Orders</span>
                            <Badge variant="outline" className="ml-2 text-[10px]">Dept Totals</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={deptTotalsUserId || ""}
                          onValueChange={handleDeptTotalsUserSelect}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs">
                            <SelectValue placeholder="Select user..." />
                          </SelectTrigger>
                          <SelectContent>
                            {storeUsers?.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {deptTotalsPrefilledFromAlias && deptTotalsUserId && (
                          <Badge className="ml-2 bg-green-500/20 text-green-700 text-[10px]">
                            Saved
                          </Badge>
                        )}
                      </TableCell>
                      {cellMappings && cellMappings.length > 0 ? (
                        (() => {
                          const previewValues: Record<string, number | null> = {};
                          if (universalMappingTemplate.size > 0) {
                            for (const [, tmpl] of universalMappingTemplate) {
                              const payType = (parseResult as any).departmentTotalsPayTypeByRowOffset?.[tmpl.rowOffset];
                              if (payType) {
                                const value = parseResult.departmentTotalsByIndex[payType]?.[tmpl.colIndex];
                                if (typeof value === 'number') previewValues[tmpl.kpiName] = value;
                              }
                            }
                          }
                          return [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                            <TableCell key={kpiName} className="text-xs whitespace-nowrap">
                              {previewValues[kpiName] != null ? previewValues[kpiName]!.toLocaleString() : "-"}
                            </TableCell>
                          ));
                        })()
                      ) : (
                        <>
                          <TableCell>{parseResult.departmentTotals.total["Sold Hrs"]?.toLocaleString() || "-"}</TableCell>
                          <TableCell>{parseResult.departmentTotals.customer["Sold Hrs"]?.toLocaleString() || "-"}</TableCell>
                          <TableCell>${parseResult.departmentTotals.customer["Lab Sold"]?.toLocaleString() || "0"}</TableCell>
                        </>
                      )}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {assignedRows} of {totalRows} assigned
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || assignedRows === 0}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${assignedRows > 0 ? assignedRows : ""} Entries`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
