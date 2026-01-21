import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Upload, 
  FileSpreadsheet, 
  Check, 
  AlertCircle, 
  Save,
  Trash2,
  BarChart3,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExcelPreviewGrid, ColumnMapping, UserMapping } from "./ExcelPreviewGrid";
import { ColumnMappingPopover } from "./ColumnMappingPopover";
import { UserMappingPopover } from "./UserMappingPopover";

interface ParsedExcelData {
  headers: string[];
  rows: (string | number | null)[][];
  advisorRowIndices: number[];
  advisorNames: { rowIndex: number; name: string }[];
}

export const ScorecardVisualMapper = () => {
  const queryClient = useQueryClient();
  
  // State
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Mapping states
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  
  // Popover states
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  // Fetch stores
  const { data: stores, isLoading: storesLoading } = useQuery({
    queryKey: ["stores-for-mapper"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch import profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["import-profiles-for-mapper"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch store users
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-for-mapper", selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("store_id", selectedStoreId)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId,
  });

  // Fetch preset KPIs
  const { data: presetKpis } = useQuery({
    queryKey: ["preset-kpis-for-mapper"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preset_kpis")
        .select("name, metric_type")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch existing column mappings for selected profile
  const { data: existingMappings } = useQuery({
    queryKey: ["existing-column-mappings", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data, error } = await supabase
        .from("scorecard_import_mappings")
        .select("*")
        .eq("import_profile_id", selectedProfileId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProfileId,
  });

  // Fetch existing user aliases for selected store
  const { data: existingAliases } = useQuery({
    queryKey: ["existing-user-aliases", selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      // Get aliases
      const { data: aliases, error } = await supabase
        .from("scorecard_user_aliases")
        .select("id, alias_name, user_id")
        .eq("store_id", selectedStoreId);
      if (error) throw error;
      
      // Get profile names separately to avoid join ambiguity
      const userIds = aliases?.map(a => a.user_id).filter(Boolean) || [];
      if (userIds.length === 0) return aliases?.map(a => ({ ...a, profileName: null })) || [];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      
      return aliases?.map(a => ({
        ...a,
        profileName: profileMap.get(a.user_id) || null,
      })) || [];
    },
    enabled: !!selectedStoreId,
  });

  // Save column mappings mutation
  const saveColumnMappingsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProfileId) throw new Error("No profile selected");
      
      // Delete existing mappings for this profile
      await supabase
        .from("scorecard_import_mappings")
        .delete()
        .eq("import_profile_id", selectedProfileId);
      
      // Insert new mappings
      const mappingsToInsert = columnMappings
        .filter(m => m.targetKpiName)
        .map((m, index) => ({
          import_profile_id: selectedProfileId,
          source_column: m.columnHeader,
          target_kpi_name: m.targetKpiName,
          pay_type_filter: m.payTypeFilter,
          is_per_user: m.isPerUser,
          metric_type: "unit", // Will be updated based on KPI
          display_order: index,
        }));
      
      if (mappingsToInsert.length > 0) {
        const { error } = await supabase
          .from("scorecard_import_mappings")
          .insert(mappingsToInsert);
        if (error) throw error;
      }
      
      return mappingsToInsert.length;
    },
    onSuccess: (count) => {
      toast.success(`Saved ${count} column mappings`);
      queryClient.invalidateQueries({ queryKey: ["existing-column-mappings", selectedProfileId] });
    },
    onError: (error) => {
      toast.error("Failed to save mappings: " + error.message);
    },
  });

  // Save user alias mutation
  const saveUserAliasMutation = useMutation({
    mutationFn: async (mapping: UserMapping) => {
      if (!selectedStoreId) throw new Error("No store selected");
      
      const { data: user } = await supabase.auth.getUser();
      
      // Check if alias already exists
      const { data: existing } = await supabase
        .from("scorecard_user_aliases")
        .select("id")
        .eq("store_id", selectedStoreId)
        .eq("alias_name", mapping.advisorName)
        .single();
      
      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("scorecard_user_aliases")
          .update({ user_id: mapping.userId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("scorecard_user_aliases")
          .insert({
            store_id: selectedStoreId,
            alias_name: mapping.advisorName,
            user_id: mapping.userId,
            created_by: user.user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("User mapping saved");
      queryClient.invalidateQueries({ queryKey: ["existing-user-aliases", selectedStoreId] });
    },
    onError: (error) => {
      toast.error("Failed to save user mapping: " + error.message);
    },
  });

  // Parse Excel file
  const parseExcelFile = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        
        // Use first sheet or preferred sheet
        let sheetName = workbook.SheetNames[0];
        const preferredSheets = ["All Repair Orders", "Summary", "Service Advisor", "Data"];
        for (const preferred of preferredSheets) {
          const match = workbook.SheetNames.find(s => 
            s.toLowerCase().includes(preferred.toLowerCase())
          );
          if (match) {
            sheetName = match;
            break;
          }
        }
        
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        // Find header row
        const expectedHeaders = ["pay type", "#so", "sold hrs", "lab sold", "e.l.r.", "parts sold"];
        let headerRowIndex = -1;
        let headers: string[] = [];
        
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !Array.isArray(row) || row.length < 3) continue;
          
          const rowStrings = row.map(cell => String(cell ?? "").toLowerCase().trim());
          const matchCount = expectedHeaders.filter(h => 
            rowStrings.some(rs => rs.includes(h))
          ).length;
          
          if (matchCount >= 2) {
            headerRowIndex = i;
            headers = row.map(cell => String(cell ?? "").trim());
            break;
          }
        }
        
        if (headerRowIndex === -1) {
          toast.error("Could not find header row in Excel file");
          return;
        }
        
        // Extract data rows and identify advisor rows
        const dataRows: (string | number | null)[][] = [];
        const advisorRowIndices: number[] = [];
        const advisorNames: { rowIndex: number; name: string }[] = [];
        
        for (let i = headerRowIndex + 1; i < Math.min(rows.length, headerRowIndex + 100); i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const firstCell = String(row[0] || "").trim();
          
          // Check if this is an advisor header row
          const advisorMatch = firstCell.match(/Advisor\s+(\d+)\s*-\s*(.+)/i);
          if (advisorMatch) {
            const dataRowIndex = dataRows.length;
            advisorRowIndices.push(dataRowIndex);
            advisorNames.push({ rowIndex: dataRowIndex, name: advisorMatch[2].trim() });
          }
          
          // Add row to data (normalize to strings/numbers)
          const normalizedRow = row.map((cell: any) => {
            if (cell === null || cell === undefined) return null;
            if (typeof cell === "number") return cell;
            return String(cell).trim();
          });
          
          dataRows.push(normalizedRow);
        }
        
        setParsedData({
          headers,
          rows: dataRows,
          advisorRowIndices,
          advisorNames,
        });
        setFileName(file.name);
        
        // Initialize column mappings from headers
        const initialMappings: ColumnMapping[] = headers.map((header, index) => {
          // Check for existing mapping
          const existing = existingMappings?.find(m => 
            m.source_column.toLowerCase() === header.toLowerCase()
          );
          
          return {
            columnIndex: index,
            columnHeader: header,
            targetKpiName: existing?.target_kpi_name || null,
            payTypeFilter: existing?.pay_type_filter || null,
            isPerUser: existing?.is_per_user || false,
          };
        });
        setColumnMappings(initialMappings);
        
        // Initialize user mappings from advisor names
        const initialUserMappings: UserMapping[] = advisorNames.map(({ rowIndex, name }) => {
          // Check for existing alias
          const existing = existingAliases?.find(a => 
            a.alias_name.toLowerCase() === name.toLowerCase()
          );
          
          return {
            rowIndex,
            advisorName: name,
            userId: existing?.user_id || null,
            matchedProfileName: existing?.profileName || null,
          };
        });
        setUserMappings(initialUserMappings);
        
        toast.success(`Loaded ${file.name}: ${headers.length} columns, ${advisorNames.length} advisors`);
        
      } catch (error) {
        console.error("Parse error:", error);
        toast.error("Failed to parse Excel file");
      }
    };
    
    reader.readAsBinaryString(file);
  }, [existingMappings, existingAliases]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      parseExcelFile(file);
    } else {
      toast.error("Please drop an Excel file (.xlsx or .xls)");
    }
  }, [parseExcelFile]);

  // Column mapping handlers
  const handleColumnClick = (colIndex: number, header: string) => {
    setSelectedColumn(colIndex);
    setSelectedRow(null);
    setColumnPopoverOpen(true);
  };

  const handleColumnMappingSave = (mapping: {
    columnIndex: number;
    targetKpiName: string;
    payTypeFilter: string | null;
    isPerUser: boolean;
  }) => {
    setColumnMappings(prev => prev.map(m => 
      m.columnIndex === mapping.columnIndex
        ? { ...m, ...mapping }
        : m
    ));
    setColumnPopoverOpen(false);
    setSelectedColumn(null);
  };

  const handleColumnMappingRemove = (columnIndex: number) => {
    setColumnMappings(prev => prev.map(m => 
      m.columnIndex === columnIndex
        ? { ...m, targetKpiName: null, payTypeFilter: null }
        : m
    ));
    setColumnPopoverOpen(false);
    setSelectedColumn(null);
  };

  // User mapping handlers
  const handleAdvisorClick = (rowIndex: number, advisorName: string) => {
    setSelectedRow(rowIndex);
    setSelectedColumn(null);
    setUserPopoverOpen(true);
  };

  const handleUserMappingSave = (mapping: {
    rowIndex: number;
    advisorName: string;
    userId: string;
    profileName: string;
  }) => {
    const updatedMapping: UserMapping = {
      rowIndex: mapping.rowIndex,
      advisorName: mapping.advisorName,
      userId: mapping.userId,
      matchedProfileName: mapping.profileName,
    };
    
    setUserMappings(prev => prev.map(m => 
      m.rowIndex === mapping.rowIndex ? updatedMapping : m
    ));
    
    // Also save to database
    saveUserAliasMutation.mutate(updatedMapping);
    
    setUserPopoverOpen(false);
    setSelectedRow(null);
  };

  const handleUserMappingRemove = (rowIndex: number) => {
    setUserMappings(prev => prev.map(m => 
      m.rowIndex === rowIndex
        ? { ...m, userId: null, matchedProfileName: null }
        : m
    ));
    setUserPopoverOpen(false);
    setSelectedRow(null);
  };

  // Stats
  const mappedColumnsCount = columnMappings.filter(m => m.targetKpiName).length;
  const mappedUsersCount = userMappings.filter(m => m.userId).length;

  // Get current column/user info for popovers
  const currentColumnMapping = selectedColumn !== null 
    ? columnMappings.find(m => m.columnIndex === selectedColumn)
    : null;
  
  const currentUserMapping = selectedRow !== null
    ? userMappings.find(m => m.rowIndex === selectedRow)
    : null;

  return (
    <div className="space-y-6">
      {/* Configuration selectors */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Store</Label>
          <Select value={selectedStoreId || ""} onValueChange={setSelectedStoreId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select store..." />
            </SelectTrigger>
            <SelectContent>
              {stores?.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-sm">Import Profile</Label>
          <Select value={selectedProfileId || ""} onValueChange={setSelectedProfileId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select profile..." />
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
      </div>

      {/* Drop zone or preview */}
      {!parsedData ? (
        <Card
          className={cn(
            "border-2 border-dashed transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Drop Excel Report Here</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Drag and drop a CSR Service Productivity Report (.xlsx) to visualize 
              and configure column-to-KPI and advisor-to-user mappings.
            </p>
            <div className="flex items-center gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".xlsx,.xls";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) parseExcelFile(file);
                  };
                  input.click();
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Browse Files
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  {fileName}
                </CardTitle>
                <CardDescription className="mt-1">
                  Click column headers to map to KPIs, click advisor names to map to users
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {mappedColumnsCount}/{columnMappings.length} columns
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {mappedUsersCount}/{userMappings.length} advisors
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedData(null);
                    setFileName(null);
                    setColumnMappings([]);
                    setUserMappings([]);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Popovers positioned based on selection */}
            {selectedColumn !== null && currentColumnMapping && (
              <ColumnMappingPopover
                open={columnPopoverOpen}
                onOpenChange={setColumnPopoverOpen}
                columnHeader={currentColumnMapping.columnHeader}
                columnIndex={selectedColumn}
                currentKpiName={currentColumnMapping.targetKpiName}
                currentPayTypeFilter={currentColumnMapping.payTypeFilter}
                currentIsPerUser={currentColumnMapping.isPerUser}
                availableKpis={presetKpis || []}
                onSave={handleColumnMappingSave}
                onRemove={handleColumnMappingRemove}
              >
                <span />
              </ColumnMappingPopover>
            )}
            
            {selectedRow !== null && currentUserMapping && (
              <UserMappingPopover
                open={userPopoverOpen}
                onOpenChange={setUserPopoverOpen}
                advisorName={currentUserMapping.advisorName}
                rowIndex={selectedRow}
                currentUserId={currentUserMapping.userId}
                storeUsers={storeUsers || []}
                onSave={handleUserMappingSave}
                onRemove={handleUserMappingRemove}
              >
                <span />
              </UserMappingPopover>
            )}

            <ExcelPreviewGrid
              headers={parsedData.headers}
              rows={parsedData.rows}
              advisorRowIndices={parsedData.advisorRowIndices}
              columnMappings={columnMappings}
              userMappings={userMappings}
              onColumnClick={handleColumnClick}
              onAdvisorClick={handleAdvisorClick}
              selectedColumn={selectedColumn}
              selectedRow={selectedRow}
            />

            {/* Save button */}
            {selectedProfileId && mappedColumnsCount > 0 && (
              <div className="flex justify-end mt-4 pt-4 border-t">
                <Button
                  onClick={() => saveColumnMappingsMutation.mutate()}
                  disabled={saveColumnMappingsMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Column Mappings to Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {!parsedData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> Drop an Excel report to see a visual preview. 
            Click on column headers to map them to system KPIs (with pay type filters). 
            Click on advisor names (highlighted in blue) to map them to store users. 
            Mappings are saved and will be used automatically for future imports.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
