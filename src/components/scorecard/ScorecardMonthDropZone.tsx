import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseCSRProductivityReport, CSRParseResult } from "@/utils/parsers/parseCSRProductivityReport";

interface ScorecardMonthDropZoneProps {
  children: React.ReactNode;
  monthIdentifier: string;
  onFileDrop: (result: CSRParseResult, fileName: string, monthIdentifier: string) => void;
  className?: string;
}

export const ScorecardMonthDropZone = ({
  children,
  monthIdentifier,
  onFileDrop,
  className,
}: ScorecardMonthDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const excelFile = files.find(f => 
      f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      f.type === "application/vnd.ms-excel" ||
      f.name.endsWith('.xlsx') ||
      f.name.endsWith('.xls')
    );

    if (!excelFile) {
      toast({
        title: "Invalid file",
        description: "Please drop an Excel file (.xlsx or .xls)",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await parseCSRProductivityReport(excelFile);
      onFileDrop(result, excelFile.name, monthIdentifier);
    } catch (error: any) {
      toast({
        title: "Parse Error",
        description: error.message || "Failed to parse Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [monthIdentifier, onFileDrop, toast]);

  return (
    <div
      className={cn(
        "relative transition-all duration-200",
        isDragOver && "ring-2 ring-primary ring-inset bg-primary/10",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-[1px] rounded pointer-events-none z-10">
          <div className="flex flex-col items-center gap-1 text-primary">
            <Upload className="h-4 w-4" />
            <span className="text-[10px] font-medium">Drop</span>
          </div>
        </div>
      )}
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px] rounded z-10">
          <div className="h-3 w-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
