import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface KPI {
  id: string;
  name: string;
  type: "dollar" | "percentage" | "unit";
  target: number;
}

const mockKPIs: KPI[] = [
  { id: "1", name: "Wholesale Sales", type: "dollar", target: 50000 },
  { id: "2", name: "Total Gross %", type: "percentage", target: 30 },
  { id: "3", name: "Tire Sales", type: "dollar", target: 15000 },
  { id: "4", name: "Accessory Sales", type: "dollar", target: 7000 },
  { id: "5", name: "CP RO Sales", type: "dollar", target: 12000 },
  { id: "6", name: "Stock Order Allowance", type: "percentage", target: 85 },
];

const getWeekDates = () => {
  const weeks = [];
  const today = new Date();
  const currentDay = today.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  
  for (let i = -3; i <= 3; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diff + (i * 7));
    weeks.push({
      start: weekStart,
      label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
    });
  }
  return weeks;
};

const ScorecardGrid = () => {
  const [weekData, setWeekData] = useState<{ [key: string]: number }>({});
  const weeks = getWeekDates();

  const handleValueChange = (kpiId: string, weekLabel: string, value: string) => {
    const key = `${kpiId}-${weekLabel}`;
    setWeekData((prev) => ({
      ...prev,
      [key]: parseFloat(value) || 0,
    }));
  };

  const getStatus = (actual: number, target: number, type: string) => {
    if (!actual) return "default";
    const variance = type === "percentage" 
      ? actual - target 
      : ((actual - target) / target) * 100;
    
    if (variance >= 0) return "success";
    if (variance >= -10) return "warning";
    return "destructive";
  };

  const formatValue = (value: number, type: string) => {
    if (!value) return "-";
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${value}%`;
    return value.toString();
  };

  return (
    <div className="overflow-x-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px] font-bold">
              KPI
            </TableHead>
            <TableHead className="text-center font-bold min-w-[100px]">Target</TableHead>
            {weeks.map((week) => (
              <TableHead key={week.label} className="text-center min-w-[120px]">
                Week {week.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {mockKPIs.map((kpi) => (
            <TableRow key={kpi.id} className="hover:bg-muted/30">
              <TableCell className="sticky left-0 bg-background z-10 font-medium">
                {kpi.name}
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {formatValue(kpi.target, kpi.type)}
              </TableCell>
              {weeks.map((week) => {
                const key = `${kpi.id}-${week.label}`;
                const actual = weekData[key] || 0;
                const status = getStatus(actual, kpi.target, kpi.type);
                
                return (
                  <TableCell
                    key={week.label}
                    className={cn(
                      "p-1",
                      status === "success" && "bg-success/10",
                      status === "warning" && "bg-warning/10",
                      status === "destructive" && "bg-destructive/10"
                    )}
                  >
                    <Input
                      type="number"
                      step="any"
                      value={weekData[key] || ""}
                      onChange={(e) =>
                        handleValueChange(kpi.id, week.label, e.target.value)
                      }
                      className={cn(
                        "text-center border-0 bg-transparent focus-visible:ring-1",
                        status === "success" && "text-success font-medium",
                        status === "warning" && "text-warning font-medium",
                        status === "destructive" && "text-destructive font-medium"
                      )}
                      placeholder="-"
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ScorecardGrid;
