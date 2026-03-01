import React, { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, X, FileSpreadsheet, FileText, Loader2, RefreshCw, Copy, Trash2, Upload, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserFriendlyError } from "@/lib/errorMessages";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  fetchCellMappings,
  parseFinancialExcel,
  validateAgainstDatabase,
  importFinancialData,
  type ValidationResult,
  type ParsedFinancialData,
} from "@/utils/parseFinancialExcel";
import { retryAsync } from "@/utils/retryFetch";
import { parseStellantisExcel } from "@/utils/parseStellantisExcel";

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
}

export interface CopySourceOption {
  identifier: string;
  label: string;
  isAverage?: boolean;
}

interface SiblingAttachment {
  file_name: string;
  file_path: string;
  file_type: string;
  department_name: string;
}

interface MonthDropZoneProps {
  children: React.ReactNode;
  monthIdentifier: string;
  departmentId: string;
  storeId?: string;
  storeBrand?: string;
  attachment?: Attachment | null;
  onAttachmentChange: () => void;
  className?: string;
  /** Available sources to copy from (other months and YTD average) */
  copySourceOptions?: CopySourceOption[];
  /** Callback when user selects a source to copy from */
  onCopyFromSource?: (sourceIdentifier: string) => Promise<void>;
  /** Whether a copy operation is in progress */
  isCopying?: boolean;
  /** If this month's data was copied from another source */
  copiedFrom?: { sourceLabel: string; copiedAt: string } | null;
  /** Callback to clear all data for this month */
  onClearMonthData?: () => void;
  /** Attachment from another department at the same store (for re-import) */
  siblingAttachment?: SiblingAttachment | null;
}

const ACCEPTED_TYPES: Record<string, "excel" | "csv" | "pdf"> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel": "excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12": "excel", // .xlsm files
  "application/vnd.ms-excel.sheet.macroenabled.12": "excel", // .xlsm files (lowercase variant)
  "text/csv": "csv",
  "application/pdf": "pdf",
};

export const MonthDropZone = ({
  children,
  monthIdentifier,
  departmentId,
  storeId,
  storeBrand,
  attachment,
  onAttachmentChange,
  className,
  copySourceOptions = [],
  onCopyFromSource,
  isCopying = false,
  copiedFrom,
  onClearMonthData,
  siblingAttachment,
}: MonthDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // One-shot pulse animation when header first scrolls into view (only if no attachment)
  useEffect(() => {
    if (attachment || isUploading || copiedFrom) return;
    const el = outerRef.current;
    if (!el) return;
    let fired = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!fired && entries[0]?.isIntersecting) {
          fired = true;
          observer.disconnect();
          setShowPulse(true);
          setTimeout(() => setShowPulse(false), 2000);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [validationStatus, setValidationStatus] = useState<"match" | "mismatch" | "imported" | null>(null);
  const [validationDetails, setValidationDetails] = useState<ValidationResult[]>([]);
  const { toast } = useToast();

  // Supported brands for Excel processing
  const SUPPORTED_BRANDS = ["Nissan", "Ford", "GMC", "Stellantis", "Mazda", "Honda", "Hyundai", "Genesis", "KTRV"];
  const isSupportedBrand = storeBrand && SUPPORTED_BRANDS.includes(storeBrand);
  const isStellantis = storeBrand?.toLowerCase() === "stellantis";

  // Re-validate on mount if there's an existing attachment for supported brands
  useEffect(() => {
    const checkExistingValidation = async () => {
      if (!attachment || !storeId || !isSupportedBrand) return;
      if (attachment.file_type !== "excel" && attachment.file_type !== "csv") return;

      try {
        // Fetch the file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from("financial-attachments")
          .download(attachment.file_path);

        if (downloadError || !fileData) return;

        // Convert to File object
        const file = new File([fileData], attachment.file_name, { type: fileData.type });

        // Fetch cell mappings for the brand
        const year = parseInt(monthIdentifier.split('-')[0], 10);
        const mappings = await fetchCellMappings(storeBrand, year);
        if (mappings.length === 0) return;

        // Get all departments for this store
        const { data: storeDepartments } = await supabase
          .from("departments")
          .select("id, name")
          .eq("store_id", storeId);

        if (!storeDepartments || storeDepartments.length === 0) return;

        // Create lookup map
        const departmentsByName: Record<string, string> = {};
        storeDepartments.forEach((dept) => {
          departmentsByName[dept.name] = dept.id;
        });

        // Parse the Excel file
        const parsedData = await parseFinancialExcel(file, mappings);

        // Validate against database
        const validationResults = await validateAgainstDatabase(parsedData, departmentsByName, monthIdentifier);

        // Determine overall status
        const hasMismatch = validationResults.some((r) => r.status === "mismatch");
        const allMatch = validationResults.every((r) => r.status === "match" || r.status === "error");

        setValidationDetails(validationResults);
        if (hasMismatch) {
          setValidationStatus("mismatch");
        } else if (allMatch) {
          setValidationStatus("match");
        }
      } catch (error) {
        console.error("Error checking existing validation:", error);
      }
    };

    checkExistingValidation();
  }, [attachment, storeId, storeBrand, monthIdentifier, isSupportedBrand]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const processBrandExcel = async (file: File, filePath: string, userId: string, brand: string) => {
    if (!storeId) return;

    // Get all departments for this store
    const { data: storeDepartments } = await supabase.from("departments").select("id, name").eq("store_id", storeId);

    if (!storeDepartments || storeDepartments.length === 0) return;

    // Create lookup maps
    // IMPORTANT: avoid fragile exact-name matching (e.g., "Parts" vs "Parts Department").
    // We build a normalized lookup so mappings keep working even if department display names vary.
    const normalizeDeptName = (name: string) =>
      name
        .toLowerCase()
        .replace(/department/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const departmentsByName: Record<string, string> = {};
    const departmentIds: string[] = [];

    // First: exact keys for real department names
    storeDepartments.forEach((dept) => {
      departmentsByName[dept.name] = dept.id;
      departmentIds.push(dept.id);
    });

    // Second: add normalized keys for real department names
    const departmentsByNormalized = new Map<string, { id: string; name: string }>();
    storeDepartments.forEach((dept) => {
      departmentsByNormalized.set(normalizeDeptName(dept.name), { id: dept.id, name: dept.name });
    });

    // Special handling for Stellantis - check if it's a data dump format
    const isStellantisFile = brand.toLowerCase() === "stellantis";
    let parsedData: ParsedFinancialData;

    if (isStellantisFile) {
      // Always fetch cell mappings
      const year = parseInt(monthIdentifier.split('-')[0], 10);
      const mappings = await fetchCellMappings(brand, year);

      // Get department names for parsing
      const deptNames = storeDepartments.map((d) => d.name);

      // For Stellantis, ALWAYS try the data dump parser first (reads from dload/Data sheet)
      // This ensures we get the freshest data even if Chrysler sheets exist
      console.log("[Excel Import] Stellantis file detected - trying data dump parser first");

      // Parse using specialized Stellantis parser (it looks for dload/Data sheet)
      const dataDumpResult = await parseStellantisExcel(file, deptNames);

      // Also add mappings for the Stellantis parser's department names
      const stellantisDeptNames = [
        "New Vehicle Department",
        "Used Vehicle Department",
        "Service Department",
        "Parts Department",
        "Body Shop Department",
      ];

      for (const stellantisDeptName of stellantisDeptNames) {
        if (departmentsByName[stellantisDeptName]) continue;

        const normalized = normalizeDeptName(stellantisDeptName);
        const match = departmentsByNormalized.get(normalized);
        if (match) {
          departmentsByName[stellantisDeptName] = match.id;
        }
      }

      // Count how many main metrics we got from the data dump
      let dataDumpMetricCount = 0;
      for (const deptMetrics of Object.values(dataDumpResult.metrics)) {
        dataDumpMetricCount += Object.keys(deptMetrics).length;
      }
      console.log(`[Excel Import] Data dump parser found ${dataDumpMetricCount} main metrics`);

      // Start with data dump results
      parsedData = dataDumpResult;

      // If we have cell mappings, try to fill in any missing metrics from Chrysler sheets
      if (mappings.length > 0) {
        console.log("[Excel Import] Attempting to fill missing metrics from cell mappings");
        const fallbackData = await parseFinancialExcel(file, mappings);

        // Add mapping-department aliases
        const mappingDeptNames = Array.from(new Set(mappings.map((m) => m.department_name).filter(Boolean)));
        for (const mappingDeptName of mappingDeptNames) {
          if (departmentsByName[mappingDeptName]) continue;
          const normalized = normalizeDeptName(mappingDeptName);
          const match = departmentsByNormalized.get(normalized);
          if (match) {
            departmentsByName[mappingDeptName] = match.id;
          }
        }

        // Merge fallback metrics into parsed data (only for missing metrics)
        for (const [deptName, deptMetrics] of Object.entries(fallbackData.metrics)) {
          if (!parsedData.metrics[deptName]) {
            parsedData.metrics[deptName] = deptMetrics;
            console.log(`[Excel Import] Added all metrics for ${deptName} from cell mappings`);
          } else {
            // Only add metrics that are missing or null
            for (const [metricKey, value] of Object.entries(deptMetrics)) {
              if (
                parsedData.metrics[deptName][metricKey] === undefined ||
                parsedData.metrics[deptName][metricKey] === null
              ) {
                parsedData.metrics[deptName][metricKey] = value;
                console.log(`[Excel Import] Filled ${deptName}.${metricKey} from cell mappings: ${value}`);
              }
            }
          }
        }

        // Also merge sub-metrics from cell mappings if data dump didn't provide any
        for (const [deptName, subMetricList] of Object.entries(fallbackData.subMetrics)) {
          if (!parsedData.subMetrics[deptName] || parsedData.subMetrics[deptName].length === 0) {
            parsedData.subMetrics[deptName] = subMetricList;
            console.log(`[Excel Import] Added ${subMetricList.length} sub-metrics for ${deptName} from cell mappings`);
          }
        }
      }
    } else {
      // Standard flow for other brands - fetch cell mappings
      const year = parseInt(monthIdentifier.split('-')[0], 10);
      const mappings = await fetchCellMappings(brand, year);
      if (mappings.length === 0) {
        console.warn(`[processBrandExcel] No cell mappings found for brand "${brand}" (year ${year}). Skipping auto-import.`);
        return;
      }

      // Add mapping-department aliases so parseFinancialExcel output can always resolve.
      const mappingDeptNames = Array.from(new Set(mappings.map((m) => m.department_name).filter(Boolean)));
      const unresolved: string[] = [];

      for (const mappingDeptName of mappingDeptNames) {
        if (departmentsByName[mappingDeptName]) continue; // exact match already

        const normalized = normalizeDeptName(mappingDeptName);
        const match = departmentsByNormalized.get(normalized);
        if (match) {
          departmentsByName[mappingDeptName] = match.id;
        } else {
          unresolved.push(mappingDeptName);
        }
      }

      if (unresolved.length > 0) {
        console.warn("[Excel Import] Some mapping departments could not be matched to store departments", {
          storeId,
          storeBrand,
          unresolved,
          storeDepartments: storeDepartments.map((d) => d.name),
        });
      }

      // Parse the Excel file
      parsedData = await parseFinancialExcel(file, mappings);
    }

    // Debug: Log what was parsed
    console.log("[MonthDropZone] parsedData.metrics:", JSON.stringify(parsedData.metrics, null, 2));
    console.log("[MonthDropZone] parsedData.metrics keys:", Object.keys(parsedData.metrics));
    console.log("[MonthDropZone] departmentsByName:", JSON.stringify(departmentsByName, null, 2));

    // Validate against database
    const validationResults = await validateAgainstDatabase(parsedData, departmentsByName, monthIdentifier);

    // Determine overall status
    const hasImported = validationResults.some((r) => r.status === "imported");
    const hasMismatch = validationResults.some((r) => r.status === "mismatch");
    const allMatch = validationResults.every((r) => r.status === "match" || r.status === "error");

    // Check if there are any sub-metrics to import
    const hasSubMetrics = Object.values(parsedData.subMetrics).some((arr) => arr.length > 0);

    // Always import data when a file is dropped - this updates/refreshes all values
    // Even if validation shows 'match', we still import to ensure sub-metrics are updated
    // and any changes in the Excel file are reflected in the database
    const importResult = await retryAsync(() => importFinancialData(parsedData, departmentsByName, monthIdentifier, userId, storeBrand));

    if (importResult.success) {
      toast({
        title: "Financial data imported",
        description: `Imported ${importResult.importedCount} values from Excel`,
      });
    } else {
      toast({
        title: "Import failed",
        description: importResult.error || "Failed to import values from Excel",
        variant: "destructive",
      });
    }

    // Create attachment records for ALL departments at this store
    for (const dept of storeDepartments) {
      // Skip if this is the current department (already handled)
      if (dept.id === departmentId) continue;

      // Check if attachment already exists for this department
      const { data: existingAttachment } = await supabase
        .from("financial_attachments")
        .select("id")
        .eq("department_id", dept.id)
        .eq("month_identifier", monthIdentifier)
        .maybeSingle();

      if (!existingAttachment) {
        // Create new attachment record pointing to same file
        await retryAsync(async () => {
          const { error } = await supabase.from("financial_attachments").insert({
            department_id: dept.id,
            month_identifier: monthIdentifier,
            file_name: file.name,
            file_path: filePath,
            file_type: "excel",
            file_size: file.size,
            uploaded_by: userId,
          });
          if (error) throw error;
        });
      } else {
        // Update existing attachment to point to new file
        await retryAsync(async () => {
          const { error } = await supabase
            .from("financial_attachments")
            .update({
              file_name: file.name,
              file_path: filePath,
              file_type: "excel",
              file_size: file.size,
              uploaded_by: userId,
            })
            .eq("id", existingAttachment.id);
          if (error) throw error;
        });
      }
    }

    // Set validation status
    setValidationDetails(validationResults);
    if (hasImported) {
      setValidationStatus("imported");
    } else if (hasMismatch) {
      setValidationStatus("mismatch");
    } else if (allMatch) {
      setValidationStatus("match");
    }
  };

  // Re-import existing attachment
  const handleReimport = async () => {
    if (!attachment || !storeId || !storeBrand) return;
    if (attachment.file_type !== "excel" && attachment.file_type !== "csv") {
      toast({
        title: "Cannot re-import",
        description: "Only Excel files can be re-imported",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setValidationStatus(null);
    setValidationDetails([]);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("financial-attachments")
        .download(attachment.file_path);

      if (downloadError || !fileData) {
        throw new Error("Failed to download file");
      }

      // Convert to File object - force correct MIME type based on extension
      // (storage blobs often return empty type, causing xlsx library to fail)
      const ext = attachment.file_name.split('.').pop()?.toLowerCase();
      const mimeType = ext === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === 'xlsm' ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
        : 'application/vnd.ms-excel'; // xls and fallback
      const file = new File([fileData], attachment.file_name, { type: mimeType });

      // Process the file
      await processBrandExcel(file, attachment.file_path, user.id, storeBrand);

      toast({
        title: "Re-import complete",
        description: `${attachment.file_name} has been re-processed`,
      });

      onAttachmentChange();
    } catch (error: any) {
      console.error("Re-import error:", error);
      toast({
        title: "Re-import failed",
        description: error.message || "Failed to re-import file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Import from sibling department's attachment
  const handleImportFromSibling = async () => {
    if (!siblingAttachment || !storeId || !storeBrand) return;

    setIsUploading(true);
    setValidationStatus(null);
    setValidationDetails([]);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Download the sibling's file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("financial-attachments")
        .download(siblingAttachment.file_path);

      if (downloadError || !fileData) {
        throw new Error("Failed to download file");
      }

      // Convert to File object - force correct MIME type based on extension
      const siblingExt = siblingAttachment.file_name.split('.').pop()?.toLowerCase();
      const siblingMime = siblingExt === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : siblingExt === 'xlsm' ? 'application/vnd.ms-excel.sheet.macroEnabled.12'
        : 'application/vnd.ms-excel';
      const file = new File([fileData], siblingAttachment.file_name, { type: siblingMime });

      // Process using existing processBrandExcel (creates attachments for ALL departments)
      await processBrandExcel(file, siblingAttachment.file_path, user.id, storeBrand);

      toast({
        title: "Import complete",
        description: `Imported data from ${siblingAttachment.department_name}'s statement`,
      });

      onAttachmentChange();
    } catch (error: any) {
      console.error("Import from sibling error:", error);
      toast({
        title: "Import failed",
        description: error.message || "Failed to import from sibling statement",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];

      // Check extension FIRST since MIME types for .xlsm files are unreliable across browsers/OS
      const getFileType = (f: File) => {
        const ext = f.name.split(".").pop()?.toLowerCase();

        // Extension-based check first (more reliable, especially for .xlsm)
        if (ext && ["xlsx", "xls", "xlsm"].includes(ext)) return "excel" as const;
        if (ext === "csv") return "csv" as const;
        if (ext === "pdf") return "pdf" as const;

        // Fall back to MIME type check
        const byMime = ACCEPTED_TYPES[f.type as keyof typeof ACCEPTED_TYPES];
        if (byMime) return byMime;

        return null;
      };

      const fileType = getFileType(file);

      if (!fileType) {
        toast({
          title: "Invalid file type",
          description: "Please drop an Excel (.xlsx, .xlsm, .xls, .csv) or PDF file",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      setValidationStatus(null);
      setValidationDetails([]);

      try {
        // Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Not authenticated");
        }

        // Generate unique file path
        const fileExt = file.name.split(".").pop();
        const filePath = `${departmentId}/${monthIdentifier}/${Date.now()}.${fileExt}`;

        // Upload to storage (with retry for transient network errors)
        await retryAsync(async () => {
          const { error: uploadError } = await supabase.storage.from("financial-attachments").upload(filePath, file);
          if (uploadError) throw uploadError;
        });

        // Delete existing attachment if any (upsert behavior)
        if (attachment) {
          // Delete from storage
          await supabase.storage.from("financial-attachments").remove([attachment.file_path]);

          // Delete from database
          await supabase.from("financial_attachments").delete().eq("id", attachment.id);
        }

        // Save reference in database (with retry for transient network errors)
        await retryAsync(async () => {
          const { error: dbError } = await supabase.from("financial_attachments").upsert(
            {
              department_id: departmentId,
              month_identifier: monthIdentifier,
              file_name: file.name,
              file_path: filePath,
              file_type: fileType,
              file_size: file.size,
              uploaded_by: user.id,
            },
            {
              onConflict: "department_id,month_identifier",
            },
          );
          if (dbError) throw dbError;
        });

        // If this is a supported brand store and it's an Excel file, process it
        if (isSupportedBrand && (fileType === "excel" || fileType === "csv")) {
          try {
            console.log(`[MonthDropZone] Starting brand Excel processing for ${storeBrand}, file: ${file.name}`);
            await processBrandExcel(file, filePath, user.id, storeBrand);
            console.log(`[MonthDropZone] Brand Excel processing complete for ${storeBrand}`);
          } catch (brandError: any) {
            console.error(`[MonthDropZone] Brand Excel processing failed for ${storeBrand}:`, brandError);
            toast({
              title: "File attached, but auto-import failed",
              description: `The file was saved but data extraction failed: ${brandError.message}`,
              variant: "destructive",
            });
          }
        }

        toast({
          title: "File attached",
          description: `${file.name} has been attached to ${monthIdentifier}`,
        });

        onAttachmentChange();
      } catch (error: any) {
        console.error("Upload error:", error);

        const isNetwork = (error?.message || "").toLowerCase().includes("fetch") ||
          (error?.message || "").toLowerCase().includes("network");
        toast({
          title: "Upload failed",
          description: isNetwork
            ? "Connection failed after multiple retries. Please check your internet and try again."
            : getUserFriendlyError(error, "Failed to upload file"),
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [departmentId, monthIdentifier, attachment, onAttachmentChange, toast, storeId, storeBrand],
  );

  const handleRemoveAttachment = async () => {
    if (!attachment) return;

    try {
      // Delete from storage
      await supabase.storage.from("financial-attachments").remove([attachment.file_path]);

      // Delete from database
      const { error } = await supabase.from("financial_attachments").delete().eq("id", attachment.id);

      if (error) throw error;

      setValidationStatus(null);
      setValidationDetails([]);

      toast({
        title: "Attachment removed",
        description: `${attachment.file_name} has been removed`,
      });

      onAttachmentChange();
    } catch (error: any) {
      toast({
        title: "Failed to remove",
        description: error.message || "Failed to remove attachment",
        variant: "destructive",
      });
    }
  };

  const handleViewAttachment = async () => {
    if (!attachment) return;

    const { data, error } = await supabase.storage
      .from("financial-attachments")
      .createSignedUrl(attachment.file_path, 3600);

    if (error || !data?.signedUrl) {
      toast({
        title: "Failed to open file",
        description: "Could not generate download link",
        variant: "destructive",
      });
      return;
    }

    window.open(data.signedUrl, "_blank");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") {
      return <FileText className="h-3 w-3" />;
    }
    return <FileSpreadsheet className="h-3 w-3" />;
  };

  // Get the validation result for the current department
  const currentDeptValidation = validationDetails.find((r) => r.departmentId === departmentId);
  const currentDeptHasMismatch = currentDeptValidation?.status === "mismatch";
  const currentDeptDiscrepancies = currentDeptValidation?.discrepancies || [];

  const getMismatchTooltipContent = () => {
    // Show discrepancies for the current department if it has any
    if (currentDeptHasMismatch && currentDeptDiscrepancies.length > 0) {
      return currentDeptDiscrepancies
        .map((d) => `${d.metric}: Excel=${d.excelValue ?? "null"} vs DB=${d.dbValue ?? "null"}`)
        .join("\n");
    }

    // If overall status is mismatch but not this dept, show summary
    if (validationStatus === "mismatch") {
      const mismatchDepts = validationDetails.filter((r) => r.status === "mismatch");
      if (mismatchDepts.length > 0) {
        return mismatchDepts
          .map((r) => {
            const discrepancyCount = r.discrepancies?.length || 0;
            return `${r.departmentName}: ${discrepancyCount} discrepancy(ies)`;
          })
          .join("\n");
      }
    }

    return null;
  };

  const getCurrentDeptMismatchCount = () => {
    return currentDeptDiscrepancies.length;
  };

  // Determine the icon color based on the CURRENT department's status
  const getIconBackgroundColor = () => {
    // If this specific department has a mismatch, show orange
    if (currentDeptHasMismatch) {
      return "bg-orange-500 hover:bg-orange-600";
    }
    // If this department was validated and matches, show green
    if (currentDeptValidation?.status === "match" || currentDeptValidation?.status === "imported") {
      return "bg-green-500 hover:bg-green-600";
    }
    // If overall status is match/imported but this dept wasn't specifically checked, show green
    if (validationStatus === "match" || validationStatus === "imported") {
      return "bg-green-500 hover:bg-green-600";
    }
    // Default: no validation done yet, use primary color
    return "bg-primary hover:bg-primary/80";
  };

  const hasCopyOptions = copySourceOptions.length > 0 && onCopyFromSource;
  // Always show context menu since Import Statement is always available
  const hasContextMenuOptions = true;

  // Separate average and month options
  const averageOptions = copySourceOptions.filter((opt) => opt.isAverage);
  const monthOptions = copySourceOptions.filter((opt) => !opt.isAverage);

  const handleCopyFrom = async (sourceIdentifier: string) => {
    if (!onCopyFromSource) return;
    await onCopyFromSource(sourceIdentifier);
  };

  const content = (
    <TooltipProvider>
      <Tooltip open={isHovered && !attachment && !isUploading && !copiedFrom} delayDuration={0}>
        <TooltipTrigger asChild>
          <div
            ref={outerRef}
            className={cn("relative group", className)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div
              className={cn(
                "transition-all duration-200",
                isDragOver && "ring-2 ring-primary ring-inset bg-primary/10 rounded",
                isCopying && "opacity-50 pointer-events-none",
                !attachment && !isUploading && !copiedFrom && isHovered && "ring-1 ring-dashed ring-primary/50 bg-primary/5 rounded",
                !attachment && !isUploading && !copiedFrom && showPulse && !isHovered && "ring-1 ring-dashed ring-primary/30 rounded animate-pulse",
              )}
            >
              {children}
              {isCopying && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded z-10">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              )}
              {!attachment && !isUploading && !copiedFrom && (showPulse || isHovered) && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none z-10">
                  <ChevronDown className={cn("h-3 w-3 text-primary/50", showPulse && !isHovered && "animate-bounce")} />
                </div>
              )}
            </div>

      {/* Copied from indicator */}
      {copiedFrom && !attachment && (
        <div className="absolute -top-1 -left-1 z-20">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-blue-500 text-white rounded-full p-0.5">
                  <Copy className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <p>Copied from {copiedFrom.sourceLabel}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Attachment indicator with validation status color */}
      {(attachment || isUploading) && (
        <div className="absolute -top-1 -right-1 z-20">
          {isUploading ? (
            <div className="bg-primary text-primary-foreground rounded-full p-0.5">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : attachment ? (
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn("text-white rounded-full p-0.5 transition-colors", getIconBackgroundColor())}
                      >
                        {getFileIcon(attachment.file_type)}
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[350px]">
                    <p className="text-xs font-medium">{attachment.file_name}</p>
                    {currentDeptHasMismatch && (
                      <>
                        <p className="text-xs font-semibold mt-2 text-amber-500">
                          Data Discrepancies ({getCurrentDeptMismatchCount()} items)
                        </p>
                        <p className="text-xs whitespace-pre-wrap mt-1 text-muted-foreground">
                          {getMismatchTooltipContent()}
                        </p>
                      </>
                    )}
                    {!currentDeptHasMismatch && validationStatus === "mismatch" && (
                      <>
                        <p className="text-xs font-semibold mt-2 text-amber-500">
                          Other departments have discrepancies
                        </p>
                        <p className="text-xs whitespace-pre-wrap mt-1 text-muted-foreground">
                          {getMismatchTooltipContent()}
                        </p>
                      </>
                    )}
                    {currentDeptValidation?.status === "match" && (
                      <p className="text-xs mt-1 text-green-500">All data matches</p>
                    )}
                    {currentDeptValidation?.status === "imported" && (
                      <p className="text-xs mt-1 text-green-500">Data imported successfully</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleViewAttachment}>View / Download</DropdownMenuItem>
                {isSupportedBrand && (attachment.file_type === "excel" || attachment.file_type === "csv") && (
                  <DropdownMenuItem onClick={handleReimport}>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Re-import Data
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleRemoveAttachment} className="text-destructive focus:text-destructive">
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      )}

      {/* Sibling attachment indicator - show when this dept has no attachment but another dept does */}
      {!attachment && !isUploading && siblingAttachment && isSupportedBrand && (
        <div className="absolute -top-1 -right-1 z-20">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className="text-muted-foreground rounded-full p-0.5 border border-dashed border-muted-foreground/50 bg-background hover:bg-muted transition-colors">
                      <FileSpreadsheet className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">Statement available from {siblingAttachment.department_name}</p>
                  <p className="text-xs text-muted-foreground">{siblingAttachment.file_name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={handleImportFromSibling}>
                <RefreshCw className="h-3 w-3 mr-2" />
                Import from {siblingAttachment.department_name}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded pointer-events-none z-10">
          <Paperclip className="h-4 w-4 text-primary" />
        </div>
      )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Drop statement to import</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // If no context menu options, just render the content without context menu
  if (!hasContextMenuOptions) {
    return content;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        {/* Import Statement option */}
        <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-2" />
          Import Statement
        </ContextMenuItem>

        {/* Hidden file input for Import Statement */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept=".xlsx,.xls,.xlsm,.csv,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Create a synthetic drop event by reusing handleDrop's logic
              const dataTransfer = new DataTransfer();
              dataTransfer.items.add(file);
              const syntheticEvent = {
                preventDefault: () => {},
                stopPropagation: () => {},
                dataTransfer,
              } as unknown as React.DragEvent;
              handleDrop(syntheticEvent);
            }
            // Reset so same file can be re-selected
            e.target.value = "";
          }}
        />

        {(hasCopyOptions || onClearMonthData) && <ContextMenuSeparator />}

        {/* Copy options */}
        {hasCopyOptions && (
          <>
            {/* Average option (YTD) first */}
            {averageOptions.map((option) => (
              <ContextMenuItem
                key={option.identifier}
                onClick={() => handleCopyFrom(option.identifier)}
                className="font-medium"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy from {option.label}
              </ContextMenuItem>
            ))}

            {averageOptions.length > 0 && monthOptions.length > 0 && <ContextMenuSeparator />}

            {/* Month options in a submenu if there are many */}
            {monthOptions.length > 6 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy from month...
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48 max-h-[300px] overflow-y-auto">
                  {monthOptions.map((option) => (
                    <ContextMenuItem key={option.identifier} onClick={() => handleCopyFrom(option.identifier)}>
                      {option.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : (
              monthOptions.map((option) => (
                <ContextMenuItem key={option.identifier} onClick={() => handleCopyFrom(option.identifier)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy from {option.label}
                </ContextMenuItem>
              ))
            )}
          </>
        )}

        {/* Clear month data option */}
        {onClearMonthData && (
          <>
            {hasCopyOptions && <ContextMenuSeparator />}
            <ContextMenuItem onClick={onClearMonthData} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Month Data
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
