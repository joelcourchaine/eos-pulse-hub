import React, { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, X, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
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

interface MonthDropZoneProps {
  children: React.ReactNode;
  monthIdentifier: string;
  departmentId: string;
  storeId?: string;
  storeBrand?: string;
  attachment?: Attachment | null;
  onAttachmentChange: () => void;
  className?: string;
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
}: MonthDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'match' | 'mismatch' | 'imported' | null>(null);
  const [validationDetails, setValidationDetails] = useState<ValidationResult[]>([]);
  const { toast } = useToast();

  // Re-validate on mount if there's an existing attachment for Nissan stores
  useEffect(() => {
    const checkExistingValidation = async () => {
      if (!attachment || !storeId || storeBrand !== 'Nissan') return;
      if (attachment.file_type !== 'excel' && attachment.file_type !== 'csv') return;

      try {
        // Fetch the file from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('financial-attachments')
          .download(attachment.file_path);

        if (downloadError || !fileData) return;

        // Convert to File object
        const file = new File([fileData], attachment.file_name, { type: fileData.type });

        // Fetch cell mappings for Nissan
        const mappings = await fetchCellMappings('Nissan');
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
  }, [attachment, storeId, storeBrand, monthIdentifier]);

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

  const processNissanExcel = async (
    file: File,
    filePath: string,
    userId: string
  ) => {
    if (!storeId) return;

    // Fetch cell mappings for Nissan
    const mappings = await fetchCellMappings('Nissan');
    if (mappings.length === 0) {
      console.log('No cell mappings found for Nissan');
      return;
    }

    // Get all departments for this store
    const { data: storeDepartments } = await supabase
      .from('departments')
      .select('id, name')
      .eq('store_id', storeId);

    if (!storeDepartments || storeDepartments.length === 0) return;

    // Create lookup maps
    const departmentsByName: Record<string, string> = {};
    const departmentIds: string[] = [];
    storeDepartments.forEach(dept => {
      departmentsByName[dept.name] = dept.id;
      departmentIds.push(dept.id);
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
    const hasImported = validationResults.some(r => r.status === 'imported');
    const hasMismatch = validationResults.some(r => r.status === 'mismatch');
    const allMatch = validationResults.every(r => r.status === 'match' || r.status === 'error');

    // If any department needs import, do it
    if (hasImported) {
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
        .single();

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

        // If this is a Nissan store and it's an Excel file, process it
        if (storeBrand === 'Nissan' && (fileType === 'excel' || fileType === 'csv')) {
          await processNissanExcel(file, filePath, user.id);
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

  const getIconBackgroundColor = () => {
    if (validationStatus === 'match' || validationStatus === 'imported') {
      return 'bg-green-500 hover:bg-green-600';
    }
    if (validationStatus === 'mismatch') {
      return 'bg-amber-500 hover:bg-amber-600';
    }
    return 'bg-primary hover:bg-primary/80';
  };

  const getMismatchTooltipContent = () => {
    if (validationStatus !== 'mismatch') return null;
    const mismatchDetails = validationDetails.filter(r => r.status === 'mismatch');
    return mismatchDetails.map(r => {
      const discrepancyText = r.discrepancies?.map(d => 
        `${d.metric}: Excel=${d.excelValue ?? 'null'} vs DB=${d.dbValue ?? 'null'}`
      ).join(', ');
      return `${r.departmentName}: ${discrepancyText}`;
    }).join('\n');
  };

  return (
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
          isDragOver && "ring-2 ring-primary ring-inset bg-primary/10 rounded"
        )}
      >
        {children}
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
                      <DropdownMenuItem 
                        onClick={handleRemoveAttachment}
                        className="text-destructive focus:text-destructive"
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p className="text-xs">{attachment.file_name}</p>
                  {validationStatus === 'mismatch' && (
                    <>
                      <p className="text-xs font-medium mt-1 text-amber-500">Data Mismatch</p>
                      <p className="text-xs whitespace-pre-wrap">{getMismatchTooltipContent()}</p>
                    </>
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
};
