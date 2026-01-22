import React, { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseCSRProductivityReport, CSRParseResult } from "@/utils/parsers/parseCSRProductivityReport";
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

export interface ScorecardImportLog {
  id: string;
  file_name: string;
  month: string;
  status: string;
  created_at: string;
  metrics_imported?: { count: number } | null;
}

interface ScorecardMonthDropZoneProps {
  children: React.ReactNode;
  monthIdentifier: string;
  onFileDrop: (result: CSRParseResult, fileName: string, monthIdentifier: string) => void;
  className?: string;
  /** Most recent import log for this month */
  importLog?: ScorecardImportLog | null;
  /** Callback when user wants to view the import log details */
  onViewImportLog?: (log: ScorecardImportLog) => void;
}

export const ScorecardMonthDropZone = ({
  children,
  monthIdentifier,
  onFileDrop,
  className,
  importLog,
  onViewImportLog,
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

  const getStatusColor = () => {
    if (!importLog) return "";
    if (importLog.status === "success") return "bg-green-500 hover:bg-green-600";
    if (importLog.status === "partial") return "bg-amber-500 hover:bg-amber-600";
    return "bg-primary hover:bg-primary/80";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

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
      
      {/* Import log indicator */}
      {importLog && !isProcessing && (
        <div className="absolute -top-1 -right-1 z-20">
          <DropdownMenu>
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button className={cn(
                      "text-white rounded-full p-0.5 transition-colors",
                      getStatusColor()
                    )}>
                      <FileSpreadsheet className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p className="text-xs font-medium">{importLog.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Imported {formatDate(importLog.created_at)}
                  </p>
                  {importLog.metrics_imported?.count && (
                    <p className="text-xs text-muted-foreground">
                      {importLog.metrics_imported.count} entries imported
                    </p>
                  )}
                  {importLog.status === "partial" && (
                    <p className="text-xs text-amber-500 mt-1">Some advisors were not matched</p>
                  )}
                  {importLog.status === "success" && (
                    <p className="text-xs text-green-500 mt-1">All advisors matched</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewImportLog?.(importLog)}>
                View Import Details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      
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
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
