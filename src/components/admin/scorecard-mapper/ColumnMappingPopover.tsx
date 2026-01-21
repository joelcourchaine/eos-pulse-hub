import { useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Check, X, Trash2 } from "lucide-react";

interface ColumnMappingPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnHeader: string;
  columnIndex: number;
  currentKpiName: string | null;
  currentPayTypeFilter: string | null;
  currentIsPerUser: boolean;
  availableKpis: { name: string; metric_type: string }[];
  onSave: (mapping: {
    columnIndex: number;
    targetKpiName: string;
    payTypeFilter: string | null;
    isPerUser: boolean;
  }) => void;
  onRemove: (columnIndex: number) => void;
  children: React.ReactNode;
}

const PAY_TYPES = [
  { value: "customer", label: "Customer (CP)" },
  { value: "warranty", label: "Warranty" },
  { value: "internal", label: "Internal" },
  { value: "total", label: "Total" },
];

export const ColumnMappingPopover = ({
  open,
  onOpenChange,
  columnHeader,
  columnIndex,
  currentKpiName,
  currentPayTypeFilter,
  currentIsPerUser,
  availableKpis,
  onSave,
  onRemove,
  children,
}: ColumnMappingPopoverProps) => {
  const [selectedKpi, setSelectedKpi] = useState(currentKpiName || "");
  const [payTypeFilter, setPayTypeFilter] = useState(currentPayTypeFilter || "total");
  const [isPerUser, setIsPerUser] = useState(currentIsPerUser);

  const handleSave = () => {
    if (!selectedKpi) return;
    onSave({
      columnIndex,
      targetKpiName: selectedKpi,
      payTypeFilter: payTypeFilter || null,
      isPerUser,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onRemove(columnIndex);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Map Column to KPI</h4>
            <p className="text-xs text-muted-foreground mt-1">
              Column: <span className="font-medium">{columnHeader}</span>
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target KPI</Label>
              <Select value={selectedKpi} onValueChange={setSelectedKpi}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a KPI..." />
                </SelectTrigger>
                <SelectContent>
                  {availableKpis.map((kpi) => (
                    <SelectItem key={kpi.name} value={kpi.name} className="text-xs">
                      {kpi.name}
                      <span className="text-muted-foreground ml-2">
                        ({kpi.metric_type})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Pay Type Filter</Label>
              <Select value={payTypeFilter} onValueChange={setPayTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAY_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value} className="text-xs">
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="per-user" className="text-xs">
                Per-user metric
              </Label>
              <Switch
                id="per-user"
                checked={isPerUser}
                onCheckedChange={setIsPerUser}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedKpi}
              className="flex-1"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
            {currentKpiName && (
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
