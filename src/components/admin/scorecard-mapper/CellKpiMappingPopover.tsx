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
  onSave: (mapping: {
    rowIndex: number;
    colIndex: number;
    kpiId: string;
    kpiName: string;
  }) => void;
  onRemove: (rowIndex: number, colIndex: number) => void;
  children?: React.ReactNode; // Optional now since we use Dialog
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
    onRemove(rowIndex, colIndex);
    onOpenChange(false);
  };

  // Format cell value for display
  const displayValue = cellValue === null || cellValue === undefined 
    ? "(empty)" 
    : typeof cellValue === "number" 
      ? cellValue.toLocaleString() 
      : String(cellValue);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Map Cell to KPI
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm space-y-2 p-3 bg-muted/50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Owner:</span>
              <Badge variant="secondary">{advisorName}</Badge>
            </div>
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
            <Label>Map to KPI ({userKpis.length} available)</Label>
            {userKpis.length === 0 ? (
              <p className="text-sm text-muted-foreground italic p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                No KPIs assigned to this user. Assign KPIs first in the scorecard settings.
              </p>
            ) : (
              <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a KPI..." />
                </SelectTrigger>
                <SelectContent>
                  {userKpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id}>
                      {kpi.name}
                      <span className="text-muted-foreground ml-2">
                        ({kpi.metric_type})
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
              Save Mapping
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
      </DialogContent>
    </Dialog>
  );
};