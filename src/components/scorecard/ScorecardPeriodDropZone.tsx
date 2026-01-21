import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ScorecardPeriodDropZoneProps {
  children: React.ReactNode;
  onFileDrop: (file: File) => void;
  className?: string;
  disabled?: boolean;
}

const ACCEPTED_TYPES: Record<string, boolean> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/vnd.ms-excel": true,
  "application/vnd.ms-excel.sheet.macroEnabled.12": true,
  "application/vnd.ms-excel.sheet.macroenabled.12": true,
};

export const ScorecardPeriodDropZone = ({
  children,
  onFileDrop,
  className,
  disabled = false,
}: ScorecardPeriodDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    
    // Check file type
    if (!ACCEPTED_TYPES[file.type]) {
      toast({
        title: "Invalid file type",
        description: "Please drop an Excel file (.xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    onFileDrop(file);
  }, [disabled, onFileDrop, toast]);

  return (
    <div
      className={cn(
        "relative transition-all duration-200 rounded-lg",
        isDragOver && !disabled && "ring-2 ring-primary ring-offset-2 bg-primary/5",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      
      {/* Drop overlay indicator */}
      {isDragOver && !disabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-lg border-2 border-dashed border-primary pointer-events-none z-10">
          <div className="flex items-center gap-2 text-primary font-medium bg-background/90 px-3 py-1.5 rounded-md shadow-sm">
            <Upload className="h-4 w-4" />
            <span className="text-sm">Drop to import</span>
          </div>
        </div>
      )}
    </div>
  );
};
