import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, X, User, Wrench, Loader2 } from "lucide-react";
import { parseCSRProductivityReport, CSRParseResult } from "@/utils/parsers/parseCSRProductivityReport";
import { ScorecardImportPreviewDialog } from "./ScorecardImportPreviewDialog";

interface ScorecardImportDropZoneProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  storeId: string;
  onImportComplete: () => void;
}

interface FileSlot {
  id: string;
  label: string;
  icon: React.ReactNode;
  roleType: string;
  file: File | null;
  parseResult: CSRParseResult | null;
  isProcessing: boolean;
  error: string | null;
  enabled: boolean;
}

export const ScorecardImportDropZone = ({
  open,
  onOpenChange,
  departmentId,
  storeId,
  onImportComplete,
}: ScorecardImportDropZoneProps) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const { toast } = useToast();

  const [fileSlots, setFileSlots] = useState<FileSlot[]>([
    {
      id: "service_advisor",
      label: "Service Advisors",
      icon: <User className="h-6 w-6" />,
      roleType: "service_advisor",
      file: null,
      parseResult: null,
      isProcessing: false,
      error: null,
      enabled: true,
    },
    {
      id: "technician",
      label: "Technicians",
      icon: <Wrench className="h-6 w-6" />,
      roleType: "technician",
      file: null,
      parseResult: null,
      isProcessing: false,
      error: null,
      enabled: false, // Coming soon
    },
  ]);

  const { data: importProfiles } = useQuery({
    queryKey: ["active-import-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_import_profiles")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const handleFileDrop = useCallback(async (slotIndex: number, file: File) => {
    const slot = fileSlots[slotIndex];
    if (!slot.enabled) return;

    // Update slot with file and processing state
    setFileSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = {
        ...updated[slotIndex],
        file,
        isProcessing: true,
        error: null,
        parseResult: null,
      };
      return updated;
    });

    try {
      // Parse the file
      const result = await parseCSRProductivityReport(file);
      
      // Override month with selected month
      result.month = selectedMonth;
      
      setFileSlots(prev => {
        const updated = [...prev];
        updated[slotIndex] = {
          ...updated[slotIndex],
          parseResult: result,
          isProcessing: false,
        };
        return updated;
      });

      toast({
        title: "File parsed successfully",
        description: `Found ${result.advisors.length} advisors`,
      });
    } catch (error: any) {
      setFileSlots(prev => {
        const updated = [...prev];
        updated[slotIndex] = {
          ...updated[slotIndex],
          isProcessing: false,
          error: error.message || "Failed to parse file",
        };
        return updated;
      });
      
      toast({
        title: "Parse error",
        description: error.message || "Failed to parse file",
        variant: "destructive",
      });
    }
  }, [fileSlots, selectedMonth, toast]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (slotIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileDrop(slotIndex, files[0]);
    }
  };

  const handleFileSelect = (slotIndex: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileDrop(slotIndex, files[0]);
    }
  };

  const removeFile = (slotIndex: number) => {
    setFileSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = {
        ...updated[slotIndex],
        file: null,
        parseResult: null,
        error: null,
      };
      return updated;
    });
  };

  const openPreview = (slotIndex: number) => {
    setSelectedSlotIndex(slotIndex);
    setPreviewOpen(true);
  };

  const handleImportSuccess = () => {
    setPreviewOpen(false);
    setSelectedSlotIndex(null);
    onImportComplete();
    onOpenChange(false);
    
    // Reset file slots
    setFileSlots(prev => prev.map(slot => ({
      ...slot,
      file: null,
      parseResult: null,
      error: null,
    })));
  };

  // Generate month options (12 months back + 3 months forward)
  const monthOptions = [];
  const now = new Date();
  for (let i = -12; i <= 3; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    monthOptions.push({ value, label });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Scorecard Data
            </DialogTitle>
            <DialogDescription>
              Upload Excel reports to import scorecard data for team members
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Month Selector */}
            <div className="flex items-center gap-4">
              <Label htmlFor="month">Import for month:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger id="month" className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop Zones */}
            <div className="grid grid-cols-2 gap-4">
              {fileSlots.map((slot, index) => (
                <div
                  key={slot.id}
                  className={`
                    relative border-2 border-dashed rounded-lg p-6
                    ${slot.enabled 
                      ? "border-muted-foreground/25 hover:border-primary/50 cursor-pointer" 
                      : "border-muted/50 bg-muted/20 cursor-not-allowed opacity-60"
                    }
                    ${slot.error ? "border-destructive" : ""}
                    transition-colors
                  `}
                  onDragOver={slot.enabled ? handleDragOver : undefined}
                  onDrop={slot.enabled ? handleDrop(index) : undefined}
                >
                  {/* Slot Header */}
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {slot.icon}
                    </div>
                    <span className="font-medium">{slot.label}</span>
                  </div>

                  {/* Content */}
                  {!slot.enabled ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">Coming Soon</p>
                    </div>
                  ) : slot.isProcessing ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : slot.file && slot.parseResult ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        <FileSpreadsheet className="h-4 w-4 text-green-500" />
                        <span className="text-sm truncate flex-1">{slot.file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {slot.parseResult.advisors.length} advisors found
                      </p>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => openPreview(index)}
                      >
                        Preview & Import
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        id={`file-input-${slot.id}`}
                        onChange={handleFileSelect(index)}
                      />
                      <label
                        htmlFor={`file-input-${slot.id}`}
                        className="cursor-pointer"
                      >
                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drop Excel file here or click to browse
                        </p>
                      </label>
                    </div>
                  )}

                  {/* Error State */}
                  {slot.error && (
                    <p className="text-xs text-destructive mt-2">{slot.error}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {selectedSlotIndex !== null && fileSlots[selectedSlotIndex].parseResult && (
        <ScorecardImportPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          parseResult={fileSlots[selectedSlotIndex].parseResult!}
          fileName={fileSlots[selectedSlotIndex].file?.name || ""}
          departmentId={departmentId}
          storeId={storeId}
          month={selectedMonth}
          onImportSuccess={handleImportSuccess}
        />
      )}
    </>
  );
};
