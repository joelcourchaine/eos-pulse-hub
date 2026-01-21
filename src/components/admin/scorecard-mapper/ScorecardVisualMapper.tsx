import { useState, useCallback, useMemo, useEffect } from "react";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExcelPreviewGrid, ColumnMapping, UserMapping, CellKpiMapping } from "./ExcelPreviewGrid";
import { ColumnMappingPopover } from "./ColumnMappingPopover";
import { UserMappingPopover } from "./UserMappingPopover";
import { CellKpiMappingPopover } from "./CellKpiMappingPopover";

interface ParsedExcelData {
  headers: string[];
  rows: (string | number | null)[][];
  advisorRowIndices: number[];
  advisorNames: { rowIndex: number; name: string }[];
  headerRowIndex: number; // Index of the header row in the displayed data
}

export const ScorecardVisualMapper = () => {
  const queryClient = useQueryClient();
  
  // State
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedKpiOwnerId, setSelectedKpiOwnerId] = useState<string | null>(null); // User to assign KPIs to
  const [parsedData, setParsedData] = useState<ParsedExcelData | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Mapping states
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [userMappings, setUserMappings] = useState<UserMapping[]>([]);
  const [cellKpiMappings, setCellKpiMappings] = useState<CellKpiMapping[]>([]);

  // Always work with sanitized arrays (prevents runtime crashes if any undefined slips in)
  const safeColumnMappings = useMemo(() => (columnMappings ?? []).filter(Boolean), [columnMappings]);
  const safeUserMappings = useMemo(() => (userMappings ?? []).filter(Boolean), [userMappings]);
  const safeCellKpiMappings = useMemo(() => (cellKpiMappings ?? []).filter(Boolean), [cellKpiMappings]);
  
  // Popover states
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colIndex: number; value: string | number | null; header: string } | null>(null);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);
  const [cellPopoverOpen, setCellPopoverOpen] = useState(false);

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

  // Fetch departments for selected store
  const { data: storeDepartments } = useQuery({
    queryKey: ["store-departments-for-mapper", selectedStoreId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("store_id", selectedStoreId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedStoreId,
  });

  // Fetch store users - include users from store, store group, and KPI owners with null store
  const { data: storeUsers } = useQuery({
    queryKey: ["store-users-for-mapper", selectedStoreId, selectedDepartmentId],
    queryFn: async () => {
      if (!selectedStoreId) return [];
      
      // Get the store's group_id first
      const { data: store } = await supabase
        .from("stores")
        .select("group_id")
        .eq("id", selectedStoreId)
        .single();
      
      // Get users directly assigned to store
      const { data: storeUsersDirect } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("store_id", selectedStoreId);
      
      // Get users assigned to the store group
      let groupUsers: { id: string; full_name: string | null }[] = [];
      if (store?.group_id) {
        const { data: groupData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("store_group_id", store.group_id);
        groupUsers = groupData || [];
      }
      
      // Get KPI owners for departments in this store (may have null store_id)
      let kpiOwners: { id: string; full_name: string | null }[] = [];
      if (selectedDepartmentId) {
        const { data: kpiData } = await supabase
          .from("kpi_definitions")
          .select("assigned_to")
          .eq("department_id", selectedDepartmentId)
          .not("assigned_to", "is", null);
        
        const ownerIds = [...new Set(kpiData?.map(k => k.assigned_to).filter(Boolean) || [])];
        if (ownerIds.length > 0) {
          const { data: ownerProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ownerIds);
          kpiOwners = ownerProfiles || [];
        }
      }
      
      // Combine and dedupe by id
      const allUsers = [...(storeUsersDirect || []), ...groupUsers, ...kpiOwners];
      const uniqueUsers = Array.from(
        new Map(allUsers.map(u => [u.id, u])).values()
      ).sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
      
      return uniqueUsers;
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

  // Fetch existing cell KPI mappings for selected profile
  const { data: existingCellMappings } = useQuery({
    queryKey: ["existing-cell-mappings", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data, error } = await supabase
        .from("scorecard_cell_mappings")
        .select("*")
        .eq("import_profile_id", selectedProfileId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProfileId,
  });

  // Fetch existing column templates for selected profile
  const { data: columnTemplates } = useQuery({
    queryKey: ["column-templates", selectedProfileId],
    queryFn: async () => {
      if (!selectedProfileId) return [];
      const { data, error } = await supabase
        .from("scorecard_column_templates")
        .select("*")
        .eq("import_profile_id", selectedProfileId)
        .order("col_index");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProfileId,
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

  // Save cell KPI mapping mutation (auto-save on click)
  // Uses RELATIVE mappings: stores user_id + col_index (no row_index)
  // This makes mappings resilient to row shifts when advisors leave
  const saveCellMappingMutation = useMutation({
    mutationFn: async (mapping: { rowIndex: number; colIndex: number; kpiId: string; kpiName: string }) => {
      if (!selectedProfileId || !selectedKpiOwnerId) throw new Error("No profile or KPI owner selected");
      
      const { data: user } = await supabase.auth.getUser();
      
      // Use the RELATIVE unique constraint (import_profile_id, user_id, col_index)
      // row_index is NULL for relative mappings - the row is detected dynamically during import
      const { error } = await supabase
        .from("scorecard_cell_mappings")
        .upsert({
          import_profile_id: selectedProfileId,
          user_id: selectedKpiOwnerId,
          kpi_id: mapping.kpiId,
          kpi_name: mapping.kpiName,
          row_index: null, // Relative mapping - no fixed row
          col_index: mapping.colIndex,
          is_relative: true,
          created_by: user.user?.id,
        }, {
          onConflict: "import_profile_id,user_id,col_index",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cell mapping saved (relative to owner)");
      queryClient.invalidateQueries({ queryKey: ["existing-cell-mappings", selectedProfileId] });
    },
    onError: (error) => {
      toast.error("Failed to save cell mapping: " + error.message);
    },
  });

  // Delete cell KPI mapping mutation
  // For relative mappings, delete by user_id + col_index
  const deleteCellMappingMutation = useMutation({
    mutationFn: async ({ colIndex }: { rowIndex?: number; colIndex: number }) => {
      if (!selectedProfileId || !selectedKpiOwnerId) throw new Error("No profile or owner selected");
      
      // Delete by user_id + col_index for relative mappings
      const { error } = await supabase
        .from("scorecard_cell_mappings")
        .delete()
        .eq("import_profile_id", selectedProfileId)
        .eq("user_id", selectedKpiOwnerId)
        .eq("col_index", colIndex);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cell mapping removed");
      queryClient.invalidateQueries({ queryKey: ["existing-cell-mappings", selectedProfileId] });
    },
    onError: (error) => {
      toast.error("Failed to remove cell mapping: " + error.message);
    },
  });

  // Save column template mutation (called automatically when saving cell mapping)
  const saveColumnTemplateMutation = useMutation({
    mutationFn: async (template: { colIndex: number; kpiName: string }) => {
      if (!selectedProfileId) throw new Error("No profile selected");
      
      const { data: user } = await supabase.auth.getUser();
      
      // Upsert the template (col_index + kpi_name is unique per profile)
      const { error } = await supabase
        .from("scorecard_column_templates")
        .upsert({
          import_profile_id: selectedProfileId,
          col_index: template.colIndex,
          kpi_name: template.kpiName,
          created_by: user.user?.id,
        }, {
          onConflict: "import_profile_id,col_index,kpi_name",
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["column-templates", selectedProfileId] });
      toast.success(`Template saved: Column ${variables.colIndex + 1} → ${variables.kpiName}`);
    },
    onError: (error) => {
      console.error("Failed to save column template:", error);
    },
  });

  // Delete column template mutation
  const deleteColumnTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("scorecard_column_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["column-templates", selectedProfileId] });
      toast.success("Template removed");
    },
    onError: (error) => {
      toast.error("Failed to remove template: " + error.message);
    },
  });


  // Load existing cell mappings into state when they're fetched
  // Relative mappings have null row_index and are matched by userId + colIndex
  useEffect(() => {
    if (existingCellMappings && existingCellMappings.length > 0) {
      const loadedMappings: CellKpiMapping[] = existingCellMappings.map(m => ({
        rowIndex: m.row_index ?? undefined, // undefined for relative mappings
        colIndex: m.col_index,
        kpiId: m.kpi_id,
        kpiName: m.kpi_name,
        userId: m.user_id ?? undefined, // userId for relative lookups
      }));
      setCellKpiMappings(loadedMappings);
    }
  }, [existingCellMappings]);

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
        
        // Extract ALL rows including metadata rows before header
        const dataRows: (string | number | null)[][] = [];
        const advisorRowIndices: number[] = [];
        const advisorNames: { rowIndex: number; name: string }[] = [];
        const metadataRowCount = headerRowIndex; // Rows before header are metadata
        
        // Include metadata rows (before header)
        for (let i = 0; i < headerRowIndex; i++) {
          const row = rows[i];
          const normalizedRow = (row || []).map((cell: any) => {
            if (cell === null || cell === undefined) return null;
            if (typeof cell === "number") return cell;
            return String(cell).trim();
          });
          // Pad to match header length
          while (normalizedRow.length < headers.length) {
            normalizedRow.push(null);
          }
          dataRows.push(normalizedRow);
        }
        
        // Include header row itself for visual context
        dataRows.push(headers.map(h => h));
        const displayedHeaderRowIndex = dataRows.length - 1;
        
        // Include ALL data rows after header (no 100 row limit)
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
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
          headerRowIndex: displayedHeaderRowIndex,
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
    setColumnMappings((prev) =>
      (prev ?? [])
        .filter(Boolean)
        .map((m) =>
          m?.columnIndex === mapping.columnIndex ? { ...m, ...mapping } : m
        )
    );
    setColumnPopoverOpen(false);
    setSelectedColumn(null);
  };

  const handleColumnMappingRemove = (columnIndex: number) => {
    setColumnMappings((prev) =>
      (prev ?? [])
        .filter(Boolean)
        .map((m) =>
          m?.columnIndex === columnIndex
            ? { ...m, targetKpiName: null, payTypeFilter: null }
            : m
        )
    );
    setColumnPopoverOpen(false);
    setSelectedColumn(null);
  };

  // First column click handler - for selecting any cell as a KPI owner
  const handleFirstColClick = (rowIndex: number, cellValue: string) => {
    // Check if this row is already mapped to a user
    const userMapping = safeUserMappings.find(m => m?.rowIndex === rowIndex);
    
    if (userMapping?.userId) {
      // Already mapped - set as active KPI owner
      setSelectedKpiOwnerId(userMapping.userId);
      setSelectedRow(null);
      setSelectedColumn(null);
      toast.success(`Selected ${userMapping.matchedProfileName || cellValue} as KPI owner`);
    } else {
      // Not mapped - open popover to link this cell to a user
      // First, add this row to userMappings if not present
      const existingMapping = safeUserMappings.find(m => m?.rowIndex === rowIndex);
      if (!existingMapping) {
        setUserMappings(prev => [
          ...(prev ?? []).filter(Boolean),
          {
            rowIndex,
            advisorName: cellValue,
            userId: null,
            matchedProfileName: null,
          }
        ]);
      }
      setSelectedRow(rowIndex);
      setSelectedColumn(null);
      setUserPopoverOpen(true);
    }
  };

  // Legacy advisor click handler (kept for compatibility)
  const handleAdvisorClick = (rowIndex: number, advisorName: string) => {
    handleFirstColClick(rowIndex, advisorName);
  };

  const handleUserMappingSave = async (mapping: {
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
    
    setUserMappings((prev) =>
      (prev ?? [])
        .filter(Boolean)
        .map((m) => (m?.rowIndex === mapping.rowIndex ? updatedMapping : m))
    );
    
    // Also save to database
    saveUserAliasMutation.mutate(updatedMapping);
    
    // Automatically set the newly linked user as the active KPI owner
    setSelectedKpiOwnerId(mapping.userId);
    
    // Auto-apply column templates for this user
    const appliedCount = await applyTemplatesForUser(mapping.userId, mapping.profileName);
    
    if (appliedCount > 0) {
      toast.success(`${mapping.profileName} is now the active KPI owner. Applied ${appliedCount} mappings from template.`);
    } else {
      toast.success(`${mapping.profileName} is now the active KPI owner`);
    }
    
    setUserPopoverOpen(false);
    setSelectedRow(null);
  };

  const handleUserMappingRemove = (rowIndex: number) => {
    setUserMappings((prev) =>
      (prev ?? [])
        .filter(Boolean)
        .map((m) =>
          m?.rowIndex === rowIndex ? { ...m, userId: null, matchedProfileName: null } : m
        )
    );
    setUserPopoverOpen(false);
    setSelectedRow(null);
  };

  // Cell KPI mapping handlers
  const handleCellClick = (rowIndex: number, colIndex: number, cellValue: string | number | null, header: string) => {
    setSelectedCell({ rowIndex, colIndex, value: cellValue, header });
    setSelectedColumn(null);
    setSelectedRow(null);
    setCellPopoverOpen(true);
  };

  const handleCellKpiMappingSave = (mapping: {
    rowIndex: number;
    colIndex: number;
    kpiId: string;
    kpiName: string;
  }) => {
    // Update local state immediately for responsive UI
    // Store as relative mapping: userId + colIndex (no rowIndex)
    const relativeMapping: CellKpiMapping = {
      colIndex: mapping.colIndex,
      kpiId: mapping.kpiId,
      kpiName: mapping.kpiName,
      userId: selectedKpiOwnerId ?? undefined,
      // rowIndex omitted for relative mappings
    };
    
    setCellKpiMappings((prev) => {
      const existing = (prev ?? []).filter(Boolean);
      // Match by userId + colIndex for relative mappings
      const existingIdx = existing.findIndex(m => 
        m.userId === selectedKpiOwnerId && m.colIndex === mapping.colIndex
      );
      if (existingIdx >= 0) {
        const updated = [...existing];
        updated[existingIdx] = relativeMapping;
        return updated;
      }
      return [...existing, relativeMapping];
    });
    setCellPopoverOpen(false);
    setSelectedCell(null);
    
    // Auto-save to database
    saveCellMappingMutation.mutate(mapping);
    
    // Also save as a column template for future users
    // This creates a profile-level template: "Column X contains KPI Y"
    saveColumnTemplateMutation.mutate({
      colIndex: mapping.colIndex,
      kpiName: mapping.kpiName,
    });
  };

  const handleCellKpiMappingRemove = (rowIndex: number, colIndex: number) => {
    // Update local state immediately
    // For relative mappings, filter by userId + colIndex
    setCellKpiMappings((prev) => 
      (prev ?? []).filter(Boolean).filter(m => 
        !(m.userId === selectedKpiOwnerId && m.colIndex === colIndex)
      )
    );
    setCellPopoverOpen(false);
    setSelectedCell(null);
    
    // Auto-delete from database (uses userId + colIndex)
    deleteCellMappingMutation.mutate({ colIndex });
  };

  // Get selected KPI owner name for display
  const selectedKpiOwnerName = useMemo(() => {
    if (!selectedKpiOwnerId || !storeUsers) return null;
    return storeUsers.find(u => u.id === selectedKpiOwnerId)?.full_name || null;
  }, [selectedKpiOwnerId, storeUsers]);

  // Fetch KPIs for the selected department (scoped to department, not just user)
  const { data: departmentKpis } = useQuery({
    queryKey: ["department-kpis-for-mapper", selectedDepartmentId],
    queryFn: async () => {
      if (!selectedDepartmentId) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("id, name, metric_type, assigned_to")
        .eq("department_id", selectedDepartmentId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedDepartmentId,
  });

  // Filter department KPIs to those assigned to the manually selected KPI owner
  const userAssignedKpis = useMemo(() => {
    if (!departmentKpis || !selectedKpiOwnerId) return [];
    return departmentKpis.filter(kpi => kpi.assigned_to === selectedKpiOwnerId);
  }, [departmentKpis, selectedKpiOwnerId]);

  // Build a set of KPI IDs that have been mapped for the active owner
  const mappedKpiIds = useMemo(() => {
    // Filter to only mappings for the active owner
    const ownerMappings = safeCellKpiMappings.filter(m => m.userId === selectedKpiOwnerId);
    return new Set(ownerMappings.map(m => m.kpiId));
  }, [safeCellKpiMappings, selectedKpiOwnerId]);

  // Auto-apply column templates for a user when they are linked
  const applyTemplatesForUser = useCallback(async (userId: string, profileName: string) => {
    if (!selectedProfileId || !columnTemplates || !departmentKpis) return 0;
    
    // Get KPIs assigned to this user
    const userKpis = departmentKpis.filter(kpi => kpi.assigned_to === userId);
    const userKpiNames = new Map(userKpis.map(kpi => [kpi.name.toLowerCase(), kpi]));
    
    // Find templates that match this user's KPIs
    const matchingTemplates = columnTemplates.filter(template => 
      userKpiNames.has(template.kpi_name.toLowerCase())
    );
    
    if (matchingTemplates.length === 0) return 0;
    
    const { data: user } = await supabase.auth.getUser();
    
    // Create cell mappings for each matching template
    const mappingsToCreate = matchingTemplates.map(template => {
      const matchedKpi = userKpiNames.get(template.kpi_name.toLowerCase())!;
      return {
        import_profile_id: selectedProfileId,
        user_id: userId,
        kpi_id: matchedKpi.id,
        kpi_name: matchedKpi.name,
        row_index: null, // Relative mapping
        col_index: template.col_index,
        is_relative: true,
        created_by: user.user?.id,
      };
    });
    
    // Batch insert (using upsert to avoid conflicts)
    for (const mapping of mappingsToCreate) {
      await supabase
        .from("scorecard_cell_mappings")
        .upsert(mapping, {
          onConflict: "import_profile_id,user_id,col_index",
        });
    }
    
    // Update local state with new mappings
    const newLocalMappings: CellKpiMapping[] = matchingTemplates.map(template => {
      const matchedKpi = userKpiNames.get(template.kpi_name.toLowerCase())!;
      return {
        colIndex: template.col_index,
        kpiId: matchedKpi.id,
        kpiName: matchedKpi.name,
        userId: userId,
      };
    });
    
    setCellKpiMappings(prev => {
      const existing = (prev ?? []).filter(Boolean);
      // Add new mappings (filter out any duplicates)
      const existingKeys = new Set(existing.map(m => `${m.userId}-${m.colIndex}`));
      const toAdd = newLocalMappings.filter(m => !existingKeys.has(`${m.userId}-${m.colIndex}`));
      return [...existing, ...toAdd];
    });
    
    queryClient.invalidateQueries({ queryKey: ["existing-cell-mappings", selectedProfileId] });
    
    return matchingTemplates.length;
  }, [selectedProfileId, columnTemplates, departmentKpis, queryClient]);

  // Stats
  const mappedColumnsCount = safeColumnMappings.filter((m) => m?.targetKpiName).length;
  const mappedUsersCount = safeUserMappings.filter((m) => m?.userId).length;
  const mappedCellsCount = safeCellKpiMappings.length;

  // Get current column/user info for popovers
  const currentColumnMapping = selectedColumn !== null 
    ? safeColumnMappings.find((m) => m?.columnIndex === selectedColumn)
    : null;
  
  // For user mapping: if we have a selected row, try to find the mapping or create a temporary one
  const currentUserMapping = useMemo(() => {
    if (selectedRow === null) return null;
    const existing = safeUserMappings.find((m) => m?.rowIndex === selectedRow);
    if (existing) return existing;
    
    // If not found, create a temp mapping from the row data
    if (parsedData && parsedData.rows[selectedRow]) {
      const firstCell = parsedData.rows[selectedRow][0];
      const cellValue = String(firstCell || "").trim();
      if (cellValue) {
        return {
          rowIndex: selectedRow,
          advisorName: cellValue,
          userId: null,
          matchedProfileName: null,
        };
      }
    }
    return null;
  }, [selectedRow, safeUserMappings, parsedData]);

  const currentCellMapping = selectedCell 
    ? safeCellKpiMappings.find(m => m.rowIndex === selectedCell.rowIndex && m.colIndex === selectedCell.colIndex)
    : null;

  return (
    <div className="space-y-6">
      {/* Configuration selectors */}
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm">Store</Label>
          <Select 
            value={selectedStoreId || ""} 
            onValueChange={(value) => {
              setSelectedStoreId(value);
              setSelectedDepartmentId(null); // Reset department when store changes
            }}
          >
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
          <Label className="text-sm">Department</Label>
          <Select 
            value={selectedDepartmentId || ""} 
            onValueChange={setSelectedDepartmentId}
            disabled={!selectedStoreId}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={selectedStoreId ? "Select department..." : "Select store first"} />
            </SelectTrigger>
            <SelectContent>
              {storeDepartments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
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
        
      {/* KPI Owner indicator - selected by clicking advisor row */}
        {selectedKpiOwnerId && selectedKpiOwnerName && (
          <div className="space-y-1.5">
            <Label className="text-sm">Active KPI Owner</Label>
            <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-300">{selectedKpiOwnerName}</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedKpiOwnerId(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
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
                  Click an advisor name to select them as KPI owner, then click cells to map values
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {mappedUsersCount}/{userMappings.length} advisors
                </Badge>
                {mappedCellsCount > 0 && (
                  <Badge variant="secondary" className="gap-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {mappedCellsCount} cells mapped
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setParsedData(null);
                    setFileName(null);
                    setColumnMappings([]);
                    setUserMappings([]);
                    setCellKpiMappings([]);
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

            {selectedCell && selectedKpiOwnerId && (
              <CellKpiMappingPopover
                open={cellPopoverOpen}
                onOpenChange={setCellPopoverOpen}
                cellValue={selectedCell.value}
                columnHeader={selectedCell.header}
                rowIndex={selectedCell.rowIndex}
                colIndex={selectedCell.colIndex}
                advisorName={selectedKpiOwnerName || "Selected User"}
                currentKpiId={currentCellMapping?.kpiId || null}
                userKpis={userAssignedKpis || []}
                mappedKpiIds={mappedKpiIds}
                onSave={handleCellKpiMappingSave}
                onRemove={handleCellKpiMappingRemove}
              />
            )}

            <div className="flex gap-4 relative">
              {/* KPI List Panel - STICKY on left side when owner is selected */}
              {selectedKpiOwnerId && (
                <div className="w-72 shrink-0 sticky top-0 self-start max-h-[calc(100vh-200px)]">
                  <div className="border rounded-lg p-4 bg-card shadow-lg">
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b">
                      <div className="p-1.5 bg-primary/10 rounded">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{selectedKpiOwnerName}</div>
                        <div className="text-[10px] text-muted-foreground">KPIs to map</div>
                      </div>
                    </div>
                    
                    {userAssignedKpis.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic p-3 bg-amber-50 dark:bg-amber-900/20 rounded">
                        No KPIs assigned to this user in this department.
                      </p>
                    ) : (
                      <>
                        {/* Unmapped KPIs - highlighted */}
                        {userAssignedKpis.filter(k => !mappedKpiIds.has(k.id)).length > 0 && (
                          <div className="mb-3">
                            <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-semibold mb-2 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Need Mapping ({userAssignedKpis.filter(k => !mappedKpiIds.has(k.id)).length})
                            </div>
                            <ul className="space-y-1">
                              {userAssignedKpis.filter(k => !mappedKpiIds.has(k.id)).map((kpi) => (
                                <li
                                  key={kpi.id}
                                  className="flex items-center gap-2 text-xs p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                                >
                                  <div className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-amber-500" />
                                  <span className="truncate font-medium">{kpi.name}</span>
                                  <Badge variant="outline" className="ml-auto text-[10px] px-1 py-0 shrink-0">
                                    {kpi.metric_type}
                                  </Badge>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Mapped KPIs */}
                        {userAssignedKpis.filter(k => mappedKpiIds.has(k.id)).length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 font-semibold mb-2 flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Mapped ({userAssignedKpis.filter(k => mappedKpiIds.has(k.id)).length})
                            </div>
                            <ul className="space-y-1 max-h-32 overflow-y-auto">
                              {userAssignedKpis.filter(k => mappedKpiIds.has(k.id)).map((kpi) => (
                                <li
                                  key={kpi.id}
                                  className="flex items-center gap-2 text-xs p-1.5 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                                >
                                  <Check className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{kpi.name}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    
                    <div className="mt-4 pt-3 border-t flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Progress</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all"
                            style={{ 
                              width: `${userAssignedKpis.length > 0 
                                ? (userAssignedKpis.filter(k => mappedKpiIds.has(k.id)).length / userAssignedKpis.length) * 100 
                                : 0}%` 
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {userAssignedKpis.filter(k => mappedKpiIds.has(k.id)).length}/{userAssignedKpis.length}
                        </span>
                      </div>
                    </div>
                    
                    {/* Column Templates Section */}
                    {columnTemplates && columnTemplates.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                          <Save className="h-3 w-3" />
                          Column Templates ({columnTemplates.length})
                        </div>
                        <ul className="space-y-1 max-h-32 overflow-y-auto">
                          {columnTemplates.map((template) => (
                            <li
                              key={template.id}
                              className="flex items-center justify-between gap-2 text-xs p-1.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                            >
                              <span className="truncate">
                                Col {template.col_index + 1} → {template.kpi_name}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => deleteColumnTemplateMutation.mutate(template.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-muted-foreground mt-2 italic">
                          Templates auto-apply when linking new advisors
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Excel Grid */}
              <div className="flex-1 min-w-0">
                <ExcelPreviewGrid
                  headers={parsedData.headers}
                  rows={parsedData.rows}
                  advisorRowIndices={parsedData.advisorRowIndices}
                  columnMappings={safeColumnMappings}
                  userMappings={safeUserMappings}
                  cellKpiMappings={safeCellKpiMappings}
                  onColumnClick={handleColumnClick}
                  onAdvisorClick={handleAdvisorClick}
                  onCellClick={handleCellClick}
                  onFirstColClick={handleFirstColClick}
                  selectedColumn={selectedColumn}
                  selectedRow={selectedRow}
                  selectedCell={selectedCell ? { rowIndex: selectedCell.rowIndex, colIndex: selectedCell.colIndex } : null}
                  headerRowIndex={parsedData.headerRowIndex}
                  canClickCells={!!selectedKpiOwnerId}
                  activeOwnerId={selectedKpiOwnerId}
                />
              </div>
            </div>

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
            <br />
            <strong>Step 1:</strong> Select a Store and Department from the dropdowns above.
            <br />
            <strong>Step 2:</strong> Click on an advisor's name to link them to a user (if not already) and set them as the active KPI owner.
            <br />
            <strong>Step 3:</strong> Click on any data cell to assign its value to one of that owner's KPIs.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
