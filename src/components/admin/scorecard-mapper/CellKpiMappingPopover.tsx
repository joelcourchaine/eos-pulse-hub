import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X, Trash2, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CellKpiMappingPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cellValue: string | number | null;
  columnHeader: string;
  rowIndex: number;
  colIndex: number;
  advisorName: string;
  currentKpiId: string | null;
  userKpis: { id: string; name: string; metric_type: string }[];
  mappedKpiIds?: Set<string>; // KPIs already mapped for this owner
  onSave: (mapping: {
    rowIndex: number;
    colIndex: number;
    kpiId: string;
    kpiName: string;
  }) => void;
  onRemove: (rowIndex: number, colIndex: number, kpiId?: string) => void;
  children?: React.ReactNode;
}

export const CellKpiMappingPopover = ({
  open,
  onOpenChange,
  cellValue,
  columnHeader,
  rowIndex,
  colIndex,
  advisorName,
  currentKpiId,
  userKpis,
  mappedKpiIds = new Set(),
  onSave,
  onRemove,
}: CellKpiMappingPopoverProps) => {
  const [selectedKpiId, setSelectedKpiId] = useState(currentKpiId || "");

  // Reset selection when dialog opens with new data
  useEffect(() => {
    if (open) {
      setSelectedKpiId(currentKpiId || "");
    }
  }, [open, currentKpiId]);

  // Find matching KPI name for display
  const selectedKpi = useMemo(() => 
    userKpis.find(k => k.id === selectedKpiId),
    [userKpis, selectedKpiId]
  );

  const handleSave = () => {
    if (!selectedKpiId || !selectedKpi) return;
    onSave({
      rowIndex,
      colIndex,
      kpiId: selectedKpiId,
      kpiName: selectedKpi.name,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove(rowIndex, colIndex, currentKpiId || undefined);
    onOpenChange(false);
  };

  // Format cell value for display
  const displayValue = cellValue === null || cellValue === undefined 
    ? "(empty)" 
    : typeof cellValue === "number" 
      ? cellValue.toLocaleString() 
      : String(cellValue);

  // Split KPIs into mapped and unmapped for display
  const unmappedKpis = useMemo(() => 
    userKpis.filter(k => !mappedKpiIds.has(k.id)),
    [userKpis, mappedKpiIds]
  );
  const mappedKpis = useMemo(() => 
    userKpis.filter(k => mappedKpiIds.has(k.id)),
    [userKpis, mappedKpiIds]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Map Cell to KPI
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex gap-4 flex-1 overflow-hidden">
          {/* Left side: KPI reference list */}
          <div className="w-48 shrink-0 border rounded-lg p-3 bg-muted/30 overflow-hidden flex flex-col">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {advisorName}'s KPIs
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {unmappedKpis.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400 font-medium mt-1">
                    Need mapping ({unmappedKpis.length})
                  </div>
                  {unmappedKpis.map(kpi => (
                    <div 
                      key={kpi.id}
                      className={`text-xs p-1.5 rounded cursor-pointer transition-colors ${
                        selectedKpiId === kpi.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                      }`}
                      onClick={() => setSelectedKpiId(kpi.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full border border-amber-500" />
                        <span className="truncate">{kpi.name}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {mappedKpis.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-wide text-green-600 dark:text-green-400 font-medium mt-2">
                    Already mapped ({mappedKpis.length})
                  </div>
                  {mappedKpis.map(kpi => (
                    <div 
                      key={kpi.id}
                      className={`text-xs p-1.5 rounded cursor-pointer transition-colors ${
                        selectedKpiId === kpi.id 
                          ? "bg-primary text-primary-foreground" 
                          : "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40"
                      }`}
                      onClick={() => setSelectedKpiId(kpi.id)}
                    >
                      <div className="flex items-center gap-1.5">
                        <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400" />
                        <span className="truncate">{kpi.name}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
              {userKpis.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  No KPIs assigned
                </p>
              )}
            </div>
            <div className="mt-2 pt-2 border-t text-[10px] text-muted-foreground">
              {mappedKpis.length}/{userKpis.length} complete
            </div>
          </div>

          {/* Right side: Cell info + selection */}
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Column:</span>
                <span className="font-medium">{columnHeader}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Value:</span>
                <span className="font-mono bg-background px-2 py-0.5 rounded">{displayValue}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Selected KPI</Label>
              {userKpis.length === 0 ? (
                <p className="text-sm text-muted-foreground italic p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  No KPIs assigned to this user.
                </p>
              ) : (
                <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a KPI or click from list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userKpis.map((kpi) => (
                      <SelectItem key={kpi.id} value={kpi.id}>
                        <span className="flex items-center gap-2">
                          {mappedKpiIds.has(kpi.id) ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-amber-500" />
                          )}
                          {kpi.name}
                          <span className="text-muted-foreground">
                            ({kpi.metric_type})
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2 pt-4 border-t">
              <Button
                onClick={handleSave}
                disabled={!selectedKpiId || userKpis.length === 0}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
              {currentKpiId && (
                <Button variant="destructive" onClick={handleRemove}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};