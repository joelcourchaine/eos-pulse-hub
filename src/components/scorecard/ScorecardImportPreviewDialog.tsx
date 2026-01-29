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
import { matchUsersByNames, createUserAlias, getStandardKpiName } from "@/utils/scorecardImportMatcher";

interface ScorecardImportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parseResult: CSRParseResult;
  fileName: string;
  file?: File | null;
  departmentId: string;
  storeId: string;
  month: string;
  onImportSuccess: () => void;
}

interface AdvisorMatch {
  advisor: AdvisorData;
  userId: string | null;
  matchedName: string | null;
  matchType: "alias" | "exact" | "fuzzy" | null;
  selectedUserId: string | null; // For unmatched manual selection
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
  onImportSuccess,
}: ScorecardImportPreviewDialogProps) => {
  const [advisorMatches, setAdvisorMatches] = useState<AdvisorMatch[]>([]);
  const [totalsUserMappings, setTotalsUserMappings] = useState<Array<{
    userId: string;
    userName: string;
    mappingsCount: number;
  }>>([]);
  const [isMatching, setIsMatching] = useState(true);
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

  // Fetch store users for manual matching (store OR store group)
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-for-import", storeId, storeData?.group_id],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, full_name, role, store_id, store_group_id")
        .order("full_name");

      if (storeData?.group_id) {
        query = query.or(`store_id.eq.${storeId},store_group_id.eq.${storeData.group_id}`);
      } else {
        query = query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeId,
  });

  // Fetch the active import profile for this store group
  const { data: importProfile } = useQuery({
    queryKey: ["import-profile-for-store", storeData?.group_id],
    queryFn: async () => {
      if (!storeData?.group_id) return null;
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("*")
        .eq("store_group_id", storeData.group_id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!storeData?.group_id,
  });

  // Fetch cell mappings from Visual Mapper for this import profile - UNIVERSAL (not filtered by user)
  // These mappings define the relative positions of KPIs and apply to ALL users
  // IMPORTANT: Always refetch fresh data when dialog opens to pick up newly added KPI mappings
  const { data: cellMappings } = useQuery({
    queryKey: ["cell-mappings-for-import", importProfile?.id],
    queryFn: async () => {
      if (!importProfile?.id) return [];
      
      console.log("[Import Preview] Fetching UNIVERSAL cell mappings for profile:", importProfile.id);
      
      // Fetch ALL cell mappings for this import profile - they are universal templates
      const { data, error } = await supabase
        .from("scorecard_cell_mappings")
        .select("*")
        .eq("import_profile_id", importProfile.id);
      if (error) throw error;
      console.log("[Import Preview] Fetched universal cell mappings:", data?.length || 0);
      return data || [];
    },
    enabled: open && !!importProfile?.id,
    staleTime: 0, // Always refetch to pick up newly added mappings
    refetchOnMount: "always",
  });

  // Build a universal mapping template from cell mappings
  // Key: "col_index:row_offset" -> { kpiName, colIndex, rowOffset }
  // This allows us to apply the same mappings to ANY user
  const universalMappingTemplate = useMemo(() => {
    if (!cellMappings || cellMappings.length === 0) return new Map<string, { kpiName: string; colIndex: number; rowOffset: number }>();
    
    const template = new Map<string, { kpiName: string; colIndex: number; rowOffset: number }>();
    for (const cm of cellMappings) {
      const key = `${cm.col_index}:${cm.row_index ?? 0}`;
      // Only add if not already present (first mapping wins - prevents duplicates)
      if (!template.has(key)) {
        template.set(key, {
          kpiName: cm.kpi_name,
          colIndex: cm.col_index,
          rowOffset: cm.row_index ?? 0,
        });
      }
    }
    console.log("[Import Preview] Built universal mapping template with", template.size, "unique position mappings");
    return template;
  }, [cellMappings]);

  // Match advisors to users on mount
  useEffect(() => {
    const matchAdvisors = async () => {
      if (!open) return;
      
      // If no advisors parsed, just show empty state (not infinite loading)
      if (!parseResult.advisors || parseResult.advisors.length === 0) {
        setAdvisorMatches([]);
        setIsMatching(false);
        return;
      }
      
      setIsMatching(true);
      
      try {
        const displayNames = parseResult.advisors.map(a => a.displayName);
        const rawNames = parseResult.advisors.map(a => a.rawName);
        
        // Pass both displayNames and rawNames for better alias matching,
        // and include store group to widen candidate user pool.
        const matches = await matchUsersByNames(displayNames, storeId, rawNames, storeData?.group_id);
        
        const advisorMatches: AdvisorMatch[] = parseResult.advisors.map(advisor => {
          const match = matches.get(advisor.displayName);
          return {
            advisor,
            userId: match?.userId || null,
            matchedName: match?.matchedName || null,
            matchType: match?.matchType || null,
            selectedUserId: null,
          };
        });
        
        setAdvisorMatches(advisorMatches);
      } catch (error) {
        console.error("[Import Preview] Error matching advisors:", error);
        setAdvisorMatches([]);
      } finally {
        setIsMatching(false);
      }
    };
    
    matchAdvisors();
  }, [open, parseResult.advisors, storeId, storeData?.group_id]);

  // Note: totalsUserMappings is now only used for backward compatibility display
  // With universal mappings, ALL matched users receive mappings, not just specific ones
  useEffect(() => {
    // Clear totalsUserMappings since mappings are now universal
    setTotalsUserMappings([]);
  }, [cellMappings, storeUsers]);

  const handleUserSelect = (advisorIndex: number, userId: string) => {
    setAdvisorMatches(prev => {
      const updated = [...prev];
      updated[advisorIndex] = {
        ...updated[advisorIndex],
        selectedUserId: userId,
      };
      return updated;
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Upload original report file (so it can be viewed/downloaded later)
      let reportFilePath: string | null = null;
      if (file) {
        const safeName = (file.name || fileName || "report.xlsx")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(-120);
        const storagePath = `${storeId}/${departmentId}/${month}/${Date.now()}_${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("scorecard-imports")
          .upload(storagePath, file, {
            upsert: true,
            contentType: file.type || "application/octet-stream",
          });

        if (uploadError) throw uploadError;
        reportFilePath = storagePath;
      }

      // Create aliases for manually matched users
      for (const match of advisorMatches) {
        if (match.selectedUserId && !match.userId) {
          await createUserAlias(
            storeId,
            match.advisor.displayName,
            match.selectedUserId,
            userId || ""
          );
        }
      }

      // Prepare entries to upsert
      const entriesToUpsert: {
        kpi_id: string;
        month: string;
        entry_type: string;
        actual_value: number;
      }[] = [];

      // Check if we have universal Visual Mapper cell mappings
      const hasUniversalMappings = universalMappingTemplate.size > 0;
      console.log("[Import] Using UNIVERSAL Visual Mapper mappings:", hasUniversalMappings, "- template size:", universalMappingTemplate.size);

      if (kpiDefinitions) {
        // NEW APPROACH: Apply universal cell mappings to ALL matched users
        // The mappings define (col_index, row_offset) -> kpi_name
        // For each matched user, find their KPI by name and extract the value
        
        if (hasUniversalMappings) {
          // Process ALL matched advisors using the universal template
          for (const match of advisorMatches) {
            const assignedUserId = match.selectedUserId || match.userId;
            if (!assignedUserId) continue;

            console.log(`[Import] Applying universal mappings to advisor: ${match.advisor.displayName} (${assignedUserId})`);
            
            // Get all KPIs assigned to this user
            const userKpis = kpiDefinitions.filter(k => k.assigned_to === assignedUserId);
            
            // Apply each mapping from the universal template
            for (const [, mapping] of universalMappingTemplate) {
              const { kpiName, colIndex, rowOffset } = mapping;
              
              // Find this user's KPI with matching name
              const userKpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
              if (!userKpi) {
                console.log(`[Import] No KPI named "${kpiName}" found for user ${match.advisor.displayName}`);
                continue;
              }
              
              // Get the value from the advisor's data using the row offset
              const payType = (match.advisor as any).payTypeByRowOffset?.[rowOffset];
              let value: number | undefined;
              
              if (payType) {
                value = match.advisor.metricsByIndex[payType]?.[colIndex];
                console.log(`[Import] Universal mapping: ${kpiName} col ${colIndex} row_offset ${rowOffset} -> payType "${payType}" -> value ${value}`);
              }
              
              if (typeof value === 'number') {
                entriesToUpsert.push({
                  kpi_id: userKpi.id,
                  month,
                  entry_type: "monthly",
                  actual_value: value,
                });
              }
            }
          }
          
          // Also process users who are mapped to department totals (e.g., Jake mapped to "All Repair Orders")
          // These users have an alias like "All Repair Orders -> Jake" but no individual advisor row
          // Find users with KPIs who weren't processed above (no advisor match)
          const processedUserIds = new Set(
            advisorMatches
              .filter(m => m.userId || m.selectedUserId)
              .map(m => m.selectedUserId || m.userId)
          );
          
          // Get all users with assigned KPIs in this department
          const usersWithKpis = [...new Set(kpiDefinitions.filter(k => k.assigned_to).map(k => k.assigned_to!))];
          
          for (const kpiOwnerId of usersWithKpis) {
            // Skip if already processed via advisor matching
            if (processedUserIds.has(kpiOwnerId)) continue;
            
            // This user has KPIs but no advisor match - check if they're in the current store
            const userProfile = storeUsers?.find(u => u.id === kpiOwnerId && u.store_id === storeId);
            if (!userProfile) continue;
            
            console.log(`[Import] Applying universal mappings to dept totals user: ${userProfile.full_name} (${kpiOwnerId})`);
            
            const userKpis = kpiDefinitions.filter(k => k.assigned_to === kpiOwnerId);
            
            // Apply each mapping from the universal template using department totals data
            for (const [, mapping] of universalMappingTemplate) {
              const { kpiName, colIndex, rowOffset } = mapping;
              
              const userKpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
              if (!userKpi) continue;
              
              // Get the value from department totals using the row offset
              const payType = (parseResult as any).departmentTotalsPayTypeByRowOffset?.[rowOffset];
              let value: number | undefined;
              
              if (payType) {
                value = parseResult.departmentTotalsByIndex[payType]?.[colIndex];
                console.log(`[Import] Dept totals mapping: ${kpiName} col ${colIndex} row_offset ${rowOffset} -> payType "${payType}" -> value ${value}`);
              }
              
              if (typeof value === 'number') {
                entriesToUpsert.push({
                  kpi_id: userKpi.id,
                  month,
                  entry_type: "monthly",
                  actual_value: value,
                });
              }
            }
          }
        }

        // Fallback: Also process department totals with standard mappings for un-assigned KPIs
        // Map column names to KPIs for "total" pay type
        for (const [columnName, value] of Object.entries(parseResult.departmentTotals.total)) {
          const kpiName = getStandardKpiName(columnName, "total");
          if (kpiName) {
            const kpi = kpiDefinitions.find(k => 
              k.name.toLowerCase() === kpiName.toLowerCase() && !k.assigned_to
            );
            if (kpi) {
              entriesToUpsert.push({
                kpi_id: kpi.id,
                month,
                entry_type: "monthly",
                actual_value: value,
              });
            }
          }
        }

        // Map Customer pay type columns
        for (const [columnName, value] of Object.entries(parseResult.departmentTotals.customer)) {
          const kpiName = getStandardKpiName(columnName, "customer");
          if (kpiName) {
            const kpi = kpiDefinitions.find(k => 
              k.name.toLowerCase() === kpiName.toLowerCase() && !k.assigned_to
            );
            if (kpi) {
              entriesToUpsert.push({
                kpi_id: kpi.id,
                month,
                entry_type: "monthly",
                actual_value: value,
              });
            }
          }
        }

        // LEGACY FALLBACK: Process per-advisor data when NO universal mappings exist
        // This preserves backward compatibility for stores without Visual Mapper config
        if (!hasUniversalMappings) {
          for (const match of advisorMatches) {
            const assignedUserId = match.selectedUserId || match.userId;
            if (!assignedUserId) continue;

            // Use standard column name mappings (legacy behavior)
            const userKpis = kpiDefinitions.filter(k => k.assigned_to === assignedUserId);
            
            // Map advisor metrics to their KPIs by column name
            for (const [columnName, value] of Object.entries(match.advisor.metrics.total)) {
              const kpiName = getStandardKpiName(columnName, "total");
              if (kpiName) {
                const kpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
                if (kpi) {
                  entriesToUpsert.push({
                    kpi_id: kpi.id,
                    month,
                    entry_type: "monthly",
                    actual_value: value,
                  });
                }
              }
            }

            for (const [columnName, value] of Object.entries(match.advisor.metrics.customer)) {
              const kpiName = getStandardKpiName(columnName, "customer");
              if (kpiName) {
                const kpi = userKpis.find(k => k.name.toLowerCase() === kpiName.toLowerCase());
                if (kpi) {
                  entriesToUpsert.push({
                    kpi_id: kpi.id,
                    month,
                    entry_type: "monthly",
                    actual_value: value,
                  });
                }
              }
            }
          }
        }
      }

      // Upsert entries
      if (entriesToUpsert.length > 0) {
        const { error } = await supabase
          .from("scorecard_entries")
          .upsert(entriesToUpsert, {
            onConflict: "kpi_id,month,entry_type",
          });
        if (error) throw error;
      }

      // Log the import
      const unmatchedUsers = advisorMatches
        .filter(m => !m.userId && !m.selectedUserId)
        .map(m => m.advisor.displayName);

      await supabase
        .from("scorecard_import_logs")
        .insert({
          department_id: departmentId,
          store_id: storeId,
          imported_by: userId,
          import_source: "drop_zone",
          file_name: fileName,
          month,
          report_file_path: reportFilePath,
          metrics_imported: { count: entriesToUpsert.length },
          user_mappings: Object.fromEntries(
            advisorMatches
              .filter(m => m.userId || m.selectedUserId)
              .map(m => [m.advisor.displayName, m.selectedUserId || m.userId])
          ),
          unmatched_users: unmatchedUsers,
          warnings: [],
          status: unmatchedUsers.length === 0 ? "success" : "partial",
        });

      return entriesToUpsert.length;
    },
    onSuccess: (count) => {
      toast({
        title: "Import complete",
        description: `Imported ${count} scorecard entries`,
      });
      onImportSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate counts - with universal mappings, all matched advisors get mappings
  const matchedCount = advisorMatches.filter(m => m.userId || m.selectedUserId).length;
  const totalOwnerCount = advisorMatches.length;
  const unmatchedCount = advisorMatches.filter(m => !m.userId && !m.selectedUserId).length;

  // Format month for display
  const formatMonth = (m: string) => {
    const [year, monthNum] = m.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Preview: {fileName}</DialogTitle>
          <DialogDescription>
            {parseResult.storeName} • {formatMonth(month)}
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

        {/* Warnings */}
        {unmatchedCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm">
              {unmatchedCount} advisor{unmatchedCount !== 1 ? "s" : ""} not matched. 
              Select users below to create aliases.
            </span>
          </div>
        )}

        {/* Advisor List */}
        <ScrollArea className="max-h-[400px]">
          {isMatching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : advisorMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No individual advisors found in this report.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Department totals below will still be imported if available.
              </p>
            </div>
           ) : (
             <div className="w-full overflow-x-auto">
               <Table className="min-w-max">
                 <TableHeader>
                   <TableRow>
                     <TableHead>Advisor</TableHead>
                     <TableHead>Status</TableHead>
                     {/* Show mapped KPI columns from Visual Mapper if available */}
                     {cellMappings && cellMappings.length > 0 ? (
                       // Get unique KPI names from mappings - show ALL, not sliced
                       [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                         <TableHead key={kpiName} className="text-xs whitespace-nowrap">
                           {kpiName}
                         </TableHead>
                       ))
                     ) : (
                       // Fallback to hardcoded columns when no Visual Mapper
                       <>
                         <TableHead>Total Hrs</TableHead>
                         <TableHead>CP Hrs</TableHead>
                         <TableHead>Lab Sold</TableHead>
                       </>
                     )}
                   </TableRow>
                 </TableHeader>
                   <TableBody>
                    {/* Show ALL advisors - universal mappings apply to everyone */}
                    {advisorMatches.map((match, index) => {
                      // Calculate preview values using the universal template
                      const previewValues: Record<string, number | null> = {};
                      
                      if (universalMappingTemplate.size > 0) {
                        for (const [, mapping] of universalMappingTemplate) {
                          const { kpiName, colIndex, rowOffset } = mapping;
                          // Get value from advisor's data using row offset
                          const payType = (match.advisor as any).payTypeByRowOffset?.[rowOffset];
                          if (payType) {
                            const value = match.advisor.metricsByIndex[payType]?.[colIndex];
                            if (typeof value === 'number') {
                              previewValues[kpiName] = value;
                            }
                          }
                        }
                      }
                      
                      return (
                        <TableRow key={match.advisor.rawName}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {match.userId ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : match.selectedUserId ? (
                                <UserPlus className="h-4 w-4 text-blue-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              )}
                              <span>{match.advisor.displayName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {match.userId ? (
                              <Badge className="bg-green-500/20 text-green-700">
                                {match.matchType === "alias" ? "Alias" : 
                                 match.matchType === "exact" ? "Exact" : "Fuzzy"}
                              </Badge>
                            ) : match.selectedUserId ? (
                              <Badge className="bg-blue-500/20 text-blue-700">
                                Will Create Alias
                              </Badge>
                            ) : (
                              <Select
                                value={match.selectedUserId || ""}
                                onValueChange={(v) => handleUserSelect(index, v)}
                              >
                                <SelectTrigger className="w-[150px] h-7 text-xs">
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
                            )}
                          </TableCell>
                          {/* Show preview values from universal template */}
                          {cellMappings && cellMappings.length > 0 ? (
                            [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                              <TableCell key={kpiName} className="text-xs whitespace-nowrap">
                                {previewValues[kpiName] !== undefined && previewValues[kpiName] !== null
                                  ? previewValues[kpiName]!.toLocaleString()
                                  : "-"}
                              </TableCell>
                            ))
                          ) : (
                            <>
                              <TableCell>
                                {match.advisor.metrics.total["Sold Hrs"]?.toLocaleString() || "-"}
                              </TableCell>
                              <TableCell>
                                {match.advisor.metrics.customer["Sold Hrs"]?.toLocaleString() || "-"}
                              </TableCell>
                              <TableCell>
                                ${match.advisor.metrics.customer["Lab Sold"]?.toLocaleString() || "0"}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
           )}

           {/* Department Totals summary row - always show when there are no advisors */}
           {!isMatching && advisorMatches.length === 0 && (
             <Table className="mt-2">
               <TableBody>
                 <TableRow className="border-t-2 font-medium bg-muted/50">
                   <TableCell>Department Total</TableCell>
                   <TableCell>
                     <Badge variant="outline">Summary</Badge>
                   </TableCell>
                   <TableCell>
                     {parseResult.departmentTotals.total["Sold Hrs"]?.toLocaleString() || "-"}
                   </TableCell>
                   <TableCell>
                     {parseResult.departmentTotals.customer["Sold Hrs"]?.toLocaleString() || "-"}
                   </TableCell>
                   <TableCell>
                     ${parseResult.departmentTotals.customer["Lab Sold"]?.toLocaleString() || "0"}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {matchedCount} of {totalOwnerCount} advisors matched
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                `Import ${matchedCount > 0 ? matchedCount : ""} Entries`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
