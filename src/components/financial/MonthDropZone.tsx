import React, { useState, useCallback } from "react";
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
  attachment,
  onAttachmentChange,
  className,
}: MonthDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

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
    [departmentId, monthIdentifier, attachment, onAttachmentChange, toast]
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

      {/* Attachment indicator */}
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
                      <button className="bg-primary text-primary-foreground rounded-full p-0.5 hover:bg-primary/80 transition-colors">
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
                <TooltipContent side="top">
                  <p className="text-xs">{attachment.file_name}</p>
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
