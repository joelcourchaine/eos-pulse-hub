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
  departmentId,
  storeId,
  month,
  onImportSuccess,
}: ScorecardImportPreviewDialogProps) => {
  const [advisorMatches, setAdvisorMatches] = useState<AdvisorMatch[]>([]);
  const [isMatching, setIsMatching] = useState(true);
  const { toast } = useToast();

  // Fetch store users for manual matching
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-for-import", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("store_id", storeId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

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

  // Fetch cell mappings from Visual Mapper for this import profile
  const { data: cellMappings } = useQuery({
    queryKey: ["cell-mappings-for-import", importProfile?.id],
    queryFn: async () => {
      if (!importProfile?.id) return [];
      const { data, error } = await supabase
        .from("scorecard_cell_mappings")
        .select("*")
        .eq("import_profile_id", importProfile.id);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!importProfile?.id,
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
        const names = parseResult.advisors.map(a => a.displayName);
        const matches = await matchUsersByNames(names, storeId);
        
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
  }, [open, parseResult.advisors, storeId]);

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

      // Build a lookup of cell mappings by user_id -> col_index -> kpi_id
      const userCellMappingsLookup = new Map<string, Map<number, string>>();
      if (cellMappings && cellMappings.length > 0) {
        for (const cm of cellMappings) {
          if (!cm.user_id) continue;
          if (!userCellMappingsLookup.has(cm.user_id)) {
            userCellMappingsLookup.set(cm.user_id, new Map());
          }
          userCellMappingsLookup.get(cm.user_id)!.set(cm.col_index, cm.kpi_id);
        }
      }

      const hasCellMappings = userCellMappingsLookup.size > 0;
      console.log("[Import] Using Visual Mapper cell mappings:", hasCellMappings, "- users with mappings:", userCellMappingsLookup.size);

      // Process department totals first (these still use standard mappings)
      if (kpiDefinitions) {
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

        // Process per-advisor data
        for (const match of advisorMatches) {
          const assignedUserId = match.selectedUserId || match.userId;
          if (!assignedUserId) continue;

          // Check if this user has Visual Mapper cell mappings
          const userColMappings = userCellMappingsLookup.get(assignedUserId);
          
          if (userColMappings && userColMappings.size > 0) {
            // USE VISUAL MAPPER MAPPINGS: Extract values by column index
            console.log(`[Import] Using Visual Mapper for ${match.advisor.displayName}: ${userColMappings.size} column mappings`);
            
            // metricsByIndex contains data keyed by column index
            // We need to check all pay types (total is typically what we want for "Total Hours", etc.)
            const allPayTypes = ['total', 'customer', 'warranty', 'internal'] as const;
            
            for (const payType of allPayTypes) {
              const metricsByIdx = match.advisor.metricsByIndex[payType];
              if (!metricsByIdx) continue;
              
              for (const [colIndexStr, value] of Object.entries(metricsByIdx)) {
                const colIndex = parseInt(colIndexStr, 10);
                const kpiId = userColMappings.get(colIndex);
                
                if (kpiId && typeof value === 'number') {
                  entriesToUpsert.push({
                    kpi_id: kpiId,
                    month,
                    entry_type: "monthly",
                    actual_value: value,
                  });
                }
              }
            }
          } else {
            // FALLBACK: Use standard column name mappings (legacy behavior)
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

  const matchedCount = advisorMatches.filter(m => m.userId || m.selectedUserId).length;
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Advisor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Hrs</TableHead>
                  <TableHead>CP Hrs</TableHead>
                  <TableHead>Lab Sold</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advisorMatches.map((match, index) => (
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
                    <TableCell>
                      {match.advisor.metrics.total["Sold Hrs"]?.toLocaleString() || "-"}
                    </TableCell>
                    <TableCell>
                      {match.advisor.metrics.customer["Sold Hrs"]?.toLocaleString() || "-"}
                    </TableCell>
                    <TableCell>
                      ${match.advisor.metrics.customer["Lab Sold"]?.toLocaleString() || "0"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          
          {/* Department Totals - always show */}
          {!isMatching && (
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
            {matchedCount} of {advisorMatches.length} advisors matched
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
