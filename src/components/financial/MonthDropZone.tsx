import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, X, FileSpreadsheet, FileText, Loader2, RefreshCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
} from "@/utils/parseFinancialExcel";

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
}

const ACCEPTED_TYPES = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
  "application/vnd.ms-excel": "excel",
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
}: MonthDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'match' | 'mismatch' | 'imported' | null>(null);
  const [validationDetails, setValidationDetails] = useState<ValidationResult[]>([]);
  const { toast } = useToast();

  // Supported brands for Excel processing
  const SUPPORTED_BRANDS = ['Nissan', 'Ford'];
  const isSupportedBrand = storeBrand && SUPPORTED_BRANDS.includes(storeBrand);

  // Re-validate on mount if there's an existing attachment for supported brands
  useEffect(() => {
    const checkExistingValidation = async () => {
      if (!attachment || !storeId || !isSupportedBrand) return;
      if (attachment.file_type !== 'excel' && attachment.file_type !== 'csv') return;

      try {
        // Fetch the file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('financial-attachments')
          .download(attachment.file_path);

        if (downloadError || !fileData) return;

        // Convert to File object
        const file = new File([fileData], attachment.file_name, { type: fileData.type });

        // Fetch cell mappings for the brand
        const mappings = await fetchCellMappings(storeBrand);
        if (mappings.length === 0) return;

        // Get all departments for this store
        const { data: storeDepartments } = await supabase
          .from('departments')
          .select('id, name')
          .eq('store_id', storeId);

        if (!storeDepartments || storeDepartments.length === 0) return;

        // Create lookup map
        const departmentsByName: Record<string, string> = {};
        storeDepartments.forEach(dept => {
          departmentsByName[dept.name] = dept.id;
        });

        // Parse the Excel file
        const parsedData = await parseFinancialExcel(file, mappings);

        // Validate against database
        const validationResults = await validateAgainstDatabase(
          parsedData,
          departmentsByName,
          monthIdentifier
        );

        // Determine overall status
        const hasMismatch = validationResults.some(r => r.status === 'mismatch');
        const allMatch = validationResults.every(r => r.status === 'match' || r.status === 'error');

        setValidationDetails(validationResults);
        if (hasMismatch) {
          setValidationStatus('mismatch');
        } else if (allMatch) {
          setValidationStatus('match');
        }
      } catch (error) {
        console.error('Error checking existing validation:', error);
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

  const processBrandExcel = async (
    file: File,
    filePath: string,
    userId: string,
    brand: string
  ) => {
    if (!storeId) return;

    // Fetch cell mappings for the brand
    const mappings = await fetchCellMappings(brand);
    if (mappings.length === 0) {
      console.log(`No cell mappings found for ${brand}`);
      return;
    }

    // Get all departments for this store
    const { data: storeDepartments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('store_id', storeId);

    if (!storeDepartments || storeDepartments.length === 0) return;

    // Create lookup maps
    // IMPORTANT: avoid fragile exact-name matching (e.g., "Parts" vs "Parts Department").
    // We build a normalized lookup so mappings keep working even if department display names vary.
    const normalizeDeptName = (name: string) =>
      name
        .toLowerCase()
        .replace(/department/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
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

    // Third: add mapping-department aliases so parseFinancialExcel output can always resolve.
    // (parseFinancialExcel groups by mapping.department_name)
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
      console.warn('[Excel Import] Some mapping departments could not be matched to store departments', {
        storeId,
        storeBrand,
        unresolved,
        storeDepartments: storeDepartments.map((d) => d.name),
      });
    }

    // Parse the Excel file
    const parsedData = await parseFinancialExcel(file, mappings);

    // Validate against database
    const validationResults = await validateAgainstDatabase(
      parsedData,
      departmentsByName,
      monthIdentifier
    );

    // Determine overall status
    const hasImported = validationResults.some(r => r.status === 'imported');
    const hasMismatch = validationResults.some(r => r.status === 'mismatch');
    const allMatch = validationResults.every(r => r.status === 'match' || r.status === 'error');
    
    // Check if there are any sub-metrics to import
    const hasSubMetrics = Object.values(parsedData.subMetrics).some(arr => arr.length > 0);

    // If any department needs import OR there are sub-metrics, do it
    // Sub-metrics are always imported since they're not checked in validation
    if (hasImported || hasSubMetrics) {
      const importResult = await importFinancialData(
        parsedData,
        departmentsByName,
        monthIdentifier,
        userId
      );

      if (importResult.success) {
        toast({
          title: "Financial data imported",
          description: `Imported ${importResult.importedCount} values from Excel`,
        });
      }
    }

    // Create attachment records for ALL departments at this store
    for (const dept of storeDepartments) {
      // Skip if this is the current department (already handled)
      if (dept.id === departmentId) continue;

      // Check if attachment already exists for this department
      const { data: existingAttachment } = await supabase
        .from('financial_attachments')
        .select('id')
        .eq('department_id', dept.id)
        .eq('month_identifier', monthIdentifier)
        .maybeSingle();

      if (!existingAttachment) {
        // Create new attachment record pointing to same file
        await supabase
          .from('financial_attachments')
          .insert({
            department_id: dept.id,
            month_identifier: monthIdentifier,
            file_name: file.name,
            file_path: filePath,
            file_type: 'excel',
            file_size: file.size,
            uploaded_by: userId,
          });
      } else {
        // Update existing attachment to point to new file
        await supabase
          .from('financial_attachments')
          .update({
            file_name: file.name,
            file_path: filePath,
            file_type: 'excel',
            file_size: file.size,
            uploaded_by: userId,
          })
          .eq('id', existingAttachment.id);
      }
    }

    // Set validation status
    setValidationDetails(validationResults);
    if (hasImported) {
      setValidationStatus('imported');
    } else if (hasMismatch) {
      setValidationStatus('mismatch');
    } else if (allMatch) {
      setValidationStatus('match');
    }
  };

  // Re-import existing attachment
  const handleReimport = async () => {
    if (!attachment || !storeId || !storeBrand) return;
    if (attachment.file_type !== 'excel' && attachment.file_type !== 'csv') {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch the file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('financial-attachments')
        .download(attachment.file_path);

      if (downloadError || !fileData) {
        throw new Error("Failed to download file");
      }

      // Convert to File object
      const file = new File([fileData], attachment.file_name, { type: fileData.type });

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

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      const file = files[0];
      const fileType = ACCEPTED_TYPES[file.type as keyof typeof ACCEPTED_TYPES];

      if (!fileType) {
        toast({
          title: "Invalid file type",
          description: "Please drop an Excel (.xlsx, .xls, .csv) or PDF file",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      setValidationStatus(null);
      setValidationDetails([]);

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Not authenticated");
        }

        // Generate unique file path
        const fileExt = file.name.split(".").pop();
        const filePath = `${departmentId}/${monthIdentifier}/${Date.now()}.${fileExt}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("financial-attachments")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Delete existing attachment if any (upsert behavior)
        if (attachment) {
          // Delete from storage
          await supabase.storage
            .from("financial-attachments")
            .remove([attachment.file_path]);
          
          // Delete from database
          await supabase
            .from("financial_attachments")
            .delete()
            .eq("id", attachment.id);
        }

        // Save reference in database
        const { error: dbError } = await supabase
          .from("financial_attachments")
          .upsert({
            department_id: departmentId,
            month_identifier: monthIdentifier,
            file_name: file.name,
            file_path: filePath,
            file_type: fileType,
            file_size: file.size,
            uploaded_by: user.id,
          }, {
            onConflict: 'department_id,month_identifier'
          });

        if (dbError) throw dbError;

        // If this is a supported brand store and it's an Excel file, process it
        if (isSupportedBrand && (fileType === 'excel' || fileType === 'csv')) {
          await processBrandExcel(file, filePath, user.id, storeBrand);
        }

        toast({
          title: "File attached",
          description: `${file.name} has been attached to ${monthIdentifier}`,
        });

        onAttachmentChange();
      } catch (error: any) {
        console.error("Upload error:", error);
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload file",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [departmentId, monthIdentifier, attachment, onAttachmentChange, toast, storeId, storeBrand]
  );

  const handleRemoveAttachment = async () => {
    if (!attachment) return;

    try {
      // Delete from storage
      await supabase.storage
        .from("financial-attachments")
        .remove([attachment.file_path]);

      // Delete from database
      const { error } = await supabase
        .from("financial_attachments")
        .delete()
        .eq("id", attachment.id);

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

    const { data } = supabase.storage
      .from("financial-attachments")
      .getPublicUrl(attachment.file_path);

    window.open(data.publicUrl, "_blank");
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") {
      return <FileText className="h-3 w-3" />;
    }
    return <FileSpreadsheet className="h-3 w-3" />;
  };

  // Get the validation result for the current department
  const currentDeptValidation = validationDetails.find(r => r.departmentId === departmentId);
  const currentDeptHasMismatch = currentDeptValidation?.status === 'mismatch';
  const currentDeptDiscrepancies = currentDeptValidation?.discrepancies || [];

  const getMismatchTooltipContent = () => {
    // Show discrepancies for the current department if it has any
    if (currentDeptHasMismatch && currentDeptDiscrepancies.length > 0) {
      return currentDeptDiscrepancies.map(d => 
        `${d.metric}: Excel=${d.excelValue ?? 'null'} vs DB=${d.dbValue ?? 'null'}`
      ).join('\n');
    }
    
    // If overall status is mismatch but not this dept, show summary
    if (validationStatus === 'mismatch') {
      const mismatchDepts = validationDetails.filter(r => r.status === 'mismatch');
      if (mismatchDepts.length > 0) {
        return mismatchDepts.map(r => {
          const discrepancyCount = r.discrepancies?.length || 0;
          return `${r.departmentName}: ${discrepancyCount} discrepancy(ies)`;
        }).join('\n');
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
      return 'bg-orange-500 hover:bg-orange-600';
    }
    // If this department was validated and matches, show green
    if (currentDeptValidation?.status === 'match' || currentDeptValidation?.status === 'imported') {
      return 'bg-green-500 hover:bg-green-600';
    }
    // If overall status is match/imported but this dept wasn't specifically checked, show green
    if (validationStatus === 'match' || validationStatus === 'imported') {
      return 'bg-green-500 hover:bg-green-600';
    }
    // Default: no validation done yet, use primary color
    return 'bg-primary hover:bg-primary/80';
  };

  const hasCopyOptions = copySourceOptions.length > 0 && onCopyFromSource;
  
  // Separate average and month options
  const averageOptions = copySourceOptions.filter(opt => opt.isAverage);
  const monthOptions = copySourceOptions.filter(opt => !opt.isAverage);

  const handleCopyFrom = async (sourceIdentifier: string) => {
    if (!onCopyFromSource) return;
    await onCopyFromSource(sourceIdentifier);
  };

  const content = (
    <div
      className={cn(
        "relative",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={cn(
          "transition-all duration-200",
          isDragOver && "ring-2 ring-primary ring-inset bg-primary/10 rounded",
          isCopying && "opacity-50 pointer-events-none"
        )}
      >
        {children}
        {isCopying && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded z-10">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Attachment indicator with validation status color */}
      {(attachment || isUploading) && (
        <div className="absolute -top-1 -right-1 z-20">
          {isUploading ? (
            <div className="bg-primary text-primary-foreground rounded-full p-0.5">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          ) : attachment ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={cn(
                        "text-white rounded-full p-0.5 transition-colors",
                        getIconBackgroundColor()
                      )}>
                        {getFileIcon(attachment.file_type)}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleViewAttachment}>
                        View / Download
                      </DropdownMenuItem>
                      {isSupportedBrand && (attachment.file_type === 'excel' || attachment.file_type === 'csv') && (
                        <DropdownMenuItem onClick={handleReimport}>
                          <RefreshCw className="h-3 w-3 mr-2" />
                          Re-import Data
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem 
                        onClick={handleRemoveAttachment}
                        className="text-destructive focus:text-destructive"
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                  {!currentDeptHasMismatch && validationStatus === 'mismatch' && (
                    <>
                      <p className="text-xs font-semibold mt-2 text-amber-500">
                        Other departments have discrepancies
                      </p>
                      <p className="text-xs whitespace-pre-wrap mt-1 text-muted-foreground">
                        {getMismatchTooltipContent()}
                      </p>
                    </>
                  )}
                  {currentDeptValidation?.status === 'match' && (
                    <p className="text-xs mt-1 text-green-500">All data matches</p>
                  )}
                  {currentDeptValidation?.status === 'imported' && (
                    <p className="text-xs mt-1 text-green-500">Data imported successfully</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      )}

      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded pointer-events-none z-10">
          <Paperclip className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );

  // If no copy options, just render the content without context menu
  if (!hasCopyOptions) {
    return content;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {content}
      </ContextMenuTrigger>
      
      <ContextMenuContent className="w-56">
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
        
        {averageOptions.length > 0 && monthOptions.length > 0 && (
          <ContextMenuSeparator />
        )}
        
        {/* Month options in a submenu if there are many */}
        {monthOptions.length > 6 ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Copy className="h-4 w-4 mr-2" />
              Copy from month...
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 max-h-[300px] overflow-y-auto">
              {monthOptions.map((option) => (
                <ContextMenuItem 
                  key={option.identifier}
                  onClick={() => handleCopyFrom(option.identifier)}
                >
                  {option.label}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : (
          monthOptions.map((option) => (
            <ContextMenuItem 
              key={option.identifier}
              onClick={() => handleCopyFrom(option.identifier)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy from {option.label}
            </ContextMenuItem>
          ))
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};
