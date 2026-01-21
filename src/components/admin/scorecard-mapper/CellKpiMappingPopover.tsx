import { useState, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  children: React.ReactNode;
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
  children,
}: CellKpiMappingPopoverProps) => {
  const [selectedKpiId, setSelectedKpiId] = useState(currentKpiId || "");

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
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Map Cell to KPI
            </h4>
            <div className="text-xs text-muted-foreground mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Advisor:</span>
                <Badge variant="secondary" className="text-xs">{advisorName}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Column:</span>
                <span className="font-medium">{columnHeader}</span>
              </div>
              <div className="flex justify-between">
                <span>Value:</span>
                <span className="font-mono">{displayValue}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Map to KPI ({userKpis.length} available)</Label>
            {userKpis.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No KPIs assigned to this user. Assign KPIs first in the scorecard settings.
              </p>
            ) : (
              <Select value={selectedKpiId} onValueChange={setSelectedKpiId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a KPI..." />
                </SelectTrigger>
                <SelectContent>
                  {userKpis.map((kpi) => (
                    <SelectItem key={kpi.id} value={kpi.id} className="text-xs">
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

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedKpiId || userKpis.length === 0}
              className="flex-1"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
            {currentKpiId && (
              <Button size="sm" variant="destructive" onClick={handleRemove}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
