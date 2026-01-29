import { useState, useEffect } from "react";
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

  // Fetch cell mappings from Visual Mapper for this import profile, filtered to current store's users
  // IMPORTANT: Always refetch fresh data when dialog opens to pick up newly added KPI mappings
  const { data: cellMappings } = useQuery({
    queryKey: ["cell-mappings-for-import", importProfile?.id, storeId],
    queryFn: async () => {
      if (!importProfile?.id || !storeUsers || storeUsers.length === 0) return [];
      
      // Get user IDs for the current store only
      const currentStoreUserIds = storeUsers
        .filter(u => u.store_id === storeId)
        .map(u => u.id);
      
      if (currentStoreUserIds.length === 0) return [];
      
      console.log("[Import Preview] Fetching cell mappings for profile:", importProfile.id, "store:", storeId, "users:", currentStoreUserIds.length);
      
      const { data, error } = await supabase
        .from("scorecard_cell_mappings")
        .select("*")
        .eq("import_profile_id", importProfile.id)
        .in("user_id", currentStoreUserIds);
      if (error) throw error;
      console.log("[Import Preview] Fetched cell mappings:", data?.length || 0);
      return data || [];
    },
    enabled: open && !!importProfile?.id && !!storeUsers && storeUsers.length > 0,
    staleTime: 0, // Always refetch to pick up newly added mappings
    refetchOnMount: "always",
  });

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

  // Identify users with cell mappings - these should ALWAYS use their explicit mappings
  // regardless of whether they also match an advisor name in the report.
  // PRIORITY: Visual Mapper cell mappings take precedence over fuzzy matching.
  useEffect(() => {
    if (!cellMappings || cellMappings.length === 0 || !storeUsers) {
      setTotalsUserMappings([]);
      return;
    }

    // Group cell mappings by user_id to identify ALL users with explicit Visual Mapper mappings
    const mappingsByUser = new Map<string, number>();
    for (const cm of cellMappings) {
      if (!cm.user_id) continue;
      mappingsByUser.set(cm.user_id, (mappingsByUser.get(cm.user_id) || 0) + 1);
    }

    // ALL users with cell mappings are processed via Visual Mapper, not fuzzy matching.
    // They appear in the "Dept Totals" section of the preview (even if they match an advisor name).
    const cellMappedUsers: Array<{ userId: string; userName: string; mappingsCount: number }> = [];
    for (const [userId, count] of mappingsByUser.entries()) {
      const user = storeUsers.find(u => u.id === userId);
      if (user) {
        cellMappedUsers.push({
          userId,
          userName: user.full_name || "Unknown User",
          mappingsCount: count,
        });
      }
    }

    console.log("[Import Preview] Users with Visual Mapper cell mappings (take precedence):", cellMappedUsers.map(u => u.userName));
    setTotalsUserMappings(cellMappedUsers);
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

      // Build a lookup of cell mappings by user_id -> list of mappings.
      // IMPORTANT: multiple KPIs can live on the same column (distinguished by pay type / row offset),
      // so we must NOT key solely by col_index.
       const userCellMappingsLookup = new Map<
         string,
         Array<{ colIndex: number; kpiId: string; rowOffset: number | null }>
       >();
      if (cellMappings && cellMappings.length > 0) {
        for (const cm of cellMappings) {
          if (!cm.user_id) continue;
          const list = userCellMappingsLookup.get(cm.user_id) ?? [];
           // NOTE: in our Visual Mapper model, `row_index` stores a RELATIVE row offset (rowIndex - ownerAnchorRow).
           list.push({ colIndex: cm.col_index, kpiId: cm.kpi_id, rowOffset: cm.row_index });
          userCellMappingsLookup.set(cm.user_id, list);
        }
      }

      const hasCellMappings = userCellMappingsLookup.size > 0;
      console.log("[Import] Using Visual Mapper cell mappings:", hasCellMappings, "- users with mappings:", userCellMappingsLookup.size);

      // PRIORITY: Process users with Visual Mapper cell mappings FIRST.
      // These mappings take precedence over fuzzy advisor matching.
      // Build a Set of user IDs that have explicit cell mappings.
      const cellMappedUserIds = new Set(userCellMappingsLookup.keys());

      if (kpiDefinitions) {
        // Process ALL users with explicit Visual Mapper cell mappings first.
        // These users should NOT be processed via fuzzy advisor matching later.
        for (const [mappedUserId, userMappings] of userCellMappingsLookup.entries()) {
          console.log(`[Import] Processing user with Visual Mapper mappings: ${mappedUserId} with ${userMappings.length} cell mappings`);
          
          // Determine data source by checking where the row offsets point to.
          // The row_index stored in cell mappings is relative to the anchor selected in Visual Mapper.
          // If the user was anchored to "All Repair Orders" (dept totals), offsets map to departmentTotalsPayTypeByRowOffset.
          // If the user was anchored to their own advisor row, offsets map to advisor.payTypeByRowOffset.
          // We detect the correct source by checking if the row offset exists in each lookup.
          
          // Get the advisor match (if any) to have access to their payTypeByRowOffset
          const advisorMatch = advisorMatches.find(m => 
            (m.userId === mappedUserId || m.selectedUserId === mappedUserId)
          );
          
          for (const { colIndex, kpiId, rowOffset } of userMappings) {
            const kpiDef = kpiDefinitions?.find(k => k.id === kpiId);
            const offsetKey = rowOffset ?? 0;
            
            let value: number | undefined;
            let dataSource: string;
            
            // Priority 1: Check if this offset maps to a valid pay type in department totals
            // This handles the case where user was anchored to "All Repair Orders"
            const deptTotalsPayType = (parseResult as any).departmentTotalsPayTypeByRowOffset?.[offsetKey];
            
            // Priority 2: Check if this offset maps to a valid pay type in the matched advisor
            const advisorPayType = advisorMatch 
              ? (advisorMatch.advisor as any).payTypeByRowOffset?.[offsetKey] 
              : undefined;
            
            // Decide which source to use:
            // - If ONLY dept totals has a valid mapping for this offset, use dept totals
            // - If ONLY advisor has a valid mapping for this offset, use advisor
            // - If BOTH have valid mappings, prefer dept totals (user explicitly mapped to totals row)
            // - If NEITHER has a valid mapping, fall back to dept totals with "total" pay type
            
            if (deptTotalsPayType) {
              // Use department totals data
              value = parseResult.departmentTotalsByIndex[deptTotalsPayType]?.[colIndex];
              dataSource = `Department Totals (${deptTotalsPayType})`;
            } else if (advisorMatch && advisorPayType) {
              // Use advisor data
              value = advisorMatch.advisor.metricsByIndex[advisorPayType]?.[colIndex];
              dataSource = `Advisor ${advisorMatch.advisor.displayName} (${advisorPayType})`;
            } else {
              // Fallback: try department totals with "total" pay type
              value = parseResult.departmentTotalsByIndex["total"]?.[colIndex];
              dataSource = `Department Totals (total - fallback)`;
            }
            
            if (typeof value === 'number') {
              console.log(`[Import] Cell Mapping: col ${colIndex} from ${dataSource} -> ${kpiDef?.name}: ${value}`);
              entriesToUpsert.push({
                kpi_id: kpiId,
                month,
                entry_type: "monthly",
                actual_value: value,
              });
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

        // Process per-advisor data - ONLY for advisors who DON'T have explicit cell mappings.
        // Users with cell mappings were already processed above.
        for (const match of advisorMatches) {
          const assignedUserId = match.selectedUserId || match.userId;
          if (!assignedUserId) continue;

          // SKIP if this user has Visual Mapper cell mappings - already processed above
          if (cellMappedUserIds.has(assignedUserId)) {
            console.log(`[Import] Skipping advisor ${match.advisor.displayName} - already processed via Visual Mapper cell mappings`);
            continue;
          }

          // FALLBACK: Use standard column name mappings (legacy behavior for unmapped users)
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

  // Calculate counts - exclude advisors who have cell mappings (they're in totalsUserMappings)
  const cellMappedUserIds = new Set(totalsUserMappings.map(u => u.userId));
  const advisorsWithoutCellMappings = advisorMatches.filter(m => {
    const userId = m.userId || m.selectedUserId;
    return !userId || !cellMappedUserIds.has(userId);
  });
  
  const matchedCount = advisorsWithoutCellMappings.filter(m => m.userId || m.selectedUserId).length + totalsUserMappings.length;
  const totalOwnerCount = advisorsWithoutCellMappings.length + totalsUserMappings.length;
  const unmatchedCount = advisorsWithoutCellMappings.filter(m => !m.userId && !m.selectedUserId).length;

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
                   {/* Filter out advisors who have explicit cell mappings - they'll be shown in the Visual Mapper section */}
                   {advisorMatches
                     .filter(match => {
                       const assignedUserId = match.selectedUserId || match.userId;
                       // Exclude advisors who have explicit cell mappings
                       const hasCellMapping = cellMappings?.some(cm => cm.user_id === assignedUserId);
                       return !hasCellMapping;
                     })
                     .map((match, index) => {
                      // For advisors without cell mappings, show standard preview values
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
                          {/* Show standard advisor metrics for unmapped users */}
                          {cellMappings && cellMappings.length > 0 ? (
                            [...new Set(cellMappings.map(cm => cm.kpi_name))].map(kpiName => (
                              <TableCell key={kpiName} className="text-xs whitespace-nowrap">
                                -
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
          
          {/* Visual Mapper users - users with explicit cell mappings */}
          {!isMatching && totalsUserMappings.length > 0 && (
             <div className="w-full overflow-x-auto mt-2">
               <Table className="min-w-max">
                 <TableBody>
                   {totalsUserMappings.map(totalsUser => {
                  // Build preview values for this Visual Mapper user
                  // Determine data source by checking which lookup has the row offset
                  const previewValues: Record<string, number | null> = {};
                  
                  // Check if this user matched any advisor in the report
                  const advisorMatch = advisorMatches.find(m => 
                    m.userId === totalsUser.userId || m.selectedUserId === totalsUser.userId
                  );
                  
                  let dataSourceLabel = "Visual Mapper";
                  
                  if (cellMappings) {
                    const userMappings = cellMappings.filter(cm => cm.user_id === totalsUser.userId);
                    for (const mapping of userMappings) {
                      const offsetKey = (mapping.row_index ?? 0) as number;
                      
                      // Check which lookup has this offset - prioritize dept totals
                      const deptTotalsPayType = (parseResult as any).departmentTotalsPayTypeByRowOffset?.[offsetKey];
                      const advisorPayType = advisorMatch 
                        ? (advisorMatch.advisor as any).payTypeByRowOffset?.[offsetKey] 
                        : undefined;
                      
                      let value: number | undefined;
                      if (deptTotalsPayType) {
                        value = parseResult.departmentTotalsByIndex[deptTotalsPayType]?.[mapping.col_index];
                        dataSourceLabel = "Dept Totals";
                      } else if (advisorMatch && advisorPayType) {
                        value = advisorMatch.advisor.metricsByIndex[advisorPayType]?.[mapping.col_index];
                        dataSourceLabel = "Advisor Row";
                      } else {
                        value = parseResult.departmentTotalsByIndex["total"]?.[mapping.col_index];
                        dataSourceLabel = "Dept Totals";
                      }
                      
                      if (typeof value === 'number') {
                        previewValues[mapping.kpi_name] = value;
                      }
                    }
                  }

                  return (
                    <TableRow key={totalsUser.userId} className="border-t-2 font-medium bg-purple-500/5">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-purple-500" />
                          <span>{totalsUser.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-purple-500/20 text-purple-700">
                          {dataSourceLabel}
                        </Badge>
                      </TableCell>
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
                            {parseResult.departmentTotals.total["Sold Hrs"]?.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell>
                            {parseResult.departmentTotals.customer["Sold Hrs"]?.toLocaleString() || "-"}
                          </TableCell>
                          <TableCell>
                            ${parseResult.departmentTotals.customer["Lab Sold"]?.toLocaleString() || "0"}
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

          {/* Department Totals summary row - show when no totals users mapped */}
          {!isMatching && totalsUserMappings.length === 0 && (
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
