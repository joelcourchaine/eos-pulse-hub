import React, { useState, useCallback, useRef, useImperativeHandle, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseCSRProductivityReport, CSRParseResult } from "@/utils/parsers/parseCSRProductivityReport";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

export interface ScorecardImportLog {
  id: string;
  file_name: string;
  month: string;
  status: string;
  created_at: string;
  metrics_imported?: { count: number } | null;
  user_mappings?: Record<string, string> | null;
  unmatched_users?: string[] | null;
  warnings?: string[] | null;
  report_file_path?: string | null;
}

interface ScorecardMonthDropZoneProps {
  children: React.ReactNode;
  monthIdentifier: string;
  onFileDrop: (result: CSRParseResult, fileName: string, monthIdentifier: string, file: File) => void;
  className?: string;
  /** Most recent import log for this month */
  importLog?: ScorecardImportLog | null;
  /** Called when user wants to re-import from an existing file */
  onReimport?: (filePath: string, fileName: string, monthIdentifier: string) => void;
}

export interface ScorecardMonthDropZoneHandle {
  triggerFileSelect: () => void;
}

export const ScorecardMonthDropZone = forwardRef<ScorecardMonthDropZoneHandle, ScorecardMonthDropZoneProps>(({
  children,
  monthIdentifier,
  onFileDrop,
  className,
  importLog,
  onReimport,
}, ref) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    triggerFileSelect: () => fileInputRef.current?.click(),
  }));

  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReimporting, setIsReimporting] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { toast } = useToast();

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIsProcessing(true);
    try {
      const result = await parseCSRProductivityReport(file);
      onFileDrop(result, file.name, monthIdentifier, file);
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
      onFileDrop(result, excelFile.name, monthIdentifier, excelFile);
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

  const handleViewOriginalReport = useCallback(async () => {
    if (!importLog?.report_file_path) {
      toast({
        title: "No file available",
        description: "This import log doesn't have an attached report file.",
        variant: "destructive",
      });
      return;
    }

    // Open the tab immediately to avoid popup blockers (most browsers block window.open
    // if it happens after an awaited async call).
    // NOTE: Some browsers return `null` for the popup handle when `noopener` is used,
    // which prevents us from redirecting the tab. We'll open without `noopener` and
    // then explicitly sever the opener reference.
    const popup = window.open("about:blank", "_blank");
    try {
      if (popup) popup.opener = null;
    } catch {
      // ignore
    }

    const { data, error } = await supabase.storage
      .from("scorecard-imports")
      .createSignedUrl(importLog.report_file_path, 60);

    // Supabase can return either `signedUrl` (SDK) or `signedURL` (raw API) depending on version.
    const signedPath = (data as any)?.signedUrl ?? (data as any)?.signedURL;

    if (error || !signedPath) {
      if (popup && !popup.closed) popup.close();
      toast({
        title: "Unable to open file",
        description: error?.message || "Could not generate a download link.",
        variant: "destructive",
      });
      return;
    }

    // The signed URL may be returned as a relative path (e.g. "/object/sign/..."),
    // so make it absolute before navigating.
    const signedUrl = String(signedPath).startsWith("http")
      ? String(signedPath)
      : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1${String(signedPath)}`;

    // Try redirecting the tab we opened. If the browser blocks navigation for any
    // reason, render a manual link so the user can still download.
    if (popup && !popup.closed) {
      try {
        popup.location.replace(signedUrl);
        return;
      } catch (e) {
        console.error("[Scorecard] Failed to redirect popup to signed URL", e);
        try {
          popup.document.open();
          popup.document.write(`<!doctype html>
            <html>
              <head>
                <meta charset="utf-8" />
                <title>Download report</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
              </head>
              <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px;">
                <h1 style="font-size: 18px; margin: 0 0 12px;">Download report</h1>
                <p style="margin: 0 0 16px;">Your browser blocked the automatic redirect. Click below:</p>
                <p><a href="${signedUrl}" target="_self" rel="noreferrer">Open / download the report</a></p>
              </body>
            </html>`);
          popup.document.close();
          return;
        } catch (e2) {
          console.error("[Scorecard] Failed to write fallback download page", e2);
        }
      }
    }

    // Final fallback: open in a new tab/window directly.
    window.open(signedUrl, "_blank", "noreferrer");
  }, [importLog?.report_file_path, toast]);

  const handleReimport = useCallback(async () => {
    if (!importLog?.report_file_path || !onReimport) {
      toast({
        title: "Cannot re-import",
        description: "No file available for re-import or re-import not supported.",
        variant: "destructive",
      });
      return;
    }

    setIsReimporting(true);
    try {
      onReimport(importLog.report_file_path, importLog.file_name, monthIdentifier);
      setShowDetailsDialog(false);
    } catch (error: any) {
      toast({
        title: "Re-import failed",
        description: error.message || "Failed to re-import file",
        variant: "destructive",
      });
    } finally {
      setIsReimporting(false);
    }
  }, [importLog?.report_file_path, importLog?.file_name, monthIdentifier, onReimport, toast]);

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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileInputChange}
      />
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
        
        {/* Import log indicator - positioned at top-left like Financial Summary's attachment */}
        {importLog && !isProcessing && (
          <div className="absolute -top-1 -right-1 z-20">
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button 
                    onClick={() => setShowDetailsDialog(true)}
                    className={cn(
                      "text-white rounded-full p-0.5 transition-colors",
                      getStatusColor()
                    )}
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                  </button>
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
                  <p className="text-xs text-muted-foreground mt-1 italic">Click to view details</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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

      {/* Import Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Details</DialogTitle>
          </DialogHeader>
          {importLog && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">File</p>
                <p className="text-sm text-muted-foreground">{importLog.file_name}</p>
              </div>
              
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Status</p>
                <Badge variant={importLog.status === "success" ? "default" : "secondary"}>
                  {importLog.status}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm font-medium">Imported</p>
                <p className="text-sm text-muted-foreground">{formatDate(importLog.created_at)}</p>
              </div>
              
              {importLog.metrics_imported?.count && (
                <div>
                  <p className="text-sm font-medium">Entries Imported</p>
                  <p className="text-sm text-muted-foreground">{importLog.metrics_imported.count}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleViewOriginalReport}
                  disabled={!importLog.report_file_path}
                >
                  View / Download report
                </Button>
                {onReimport && importLog.report_file_path && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleReimport}
                    disabled={isReimporting}
                  >
                    {isReimporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Re-importing...
                      </>
                    ) : (
                      "Re-import with new KPIs"
                    )}
                  </Button>
                )}
              </div>
              
              {importLog.user_mappings && Object.keys(importLog.user_mappings).length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Advisor Mappings</p>
                  <ScrollArea className="h-[120px] border rounded p-2">
                    <div className="space-y-1">
                      {Object.entries(importLog.user_mappings).map(([excelName, dbName]) => (
                        <div key={excelName} className="flex justify-between text-xs">
                          <span className="text-muted-foreground">{excelName}</span>
                          <span>→ {dbName}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              
              {importLog.unmatched_users && importLog.unmatched_users.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-amber-600">Unmatched Advisors</p>
                  <div className="flex flex-wrap gap-1">
                    {importLog.unmatched_users.map((name) => (
                      <Badge key={name} variant="outline" className="text-xs text-amber-600 border-amber-300">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {importLog.warnings && importLog.warnings.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 text-amber-600">Warnings</p>
                  <ScrollArea className="h-[80px] border rounded p-2">
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {importLog.warnings.map((warning, idx) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
});
