import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronUp, DollarSign, Loader2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FinancialSummaryProps {
  departmentId: string;
  year: number;
  quarter: number;
}

interface FinancialMetric {
  name: string;
  key: string;
  type: "dollar" | "percentage";
  description: string;
}

const FINANCIAL_METRICS: FinancialMetric[] = [
  { name: "Total Sales", key: "total_sales", type: "dollar", description: "Total revenue for the period" },
  { name: "GP Net", key: "gp_net", type: "dollar", description: "Gross profit after costs" },
  { name: "GP%", key: "gp_percent", type: "percentage", description: "Gross profit margin" },
  { name: "Personnel Expense %", key: "personnel_expense_percent", type: "percentage", description: "Labor costs as % of sales" },
  { name: "Parts Transfer", key: "parts_transfer", type: "dollar", description: "Internal parts transfers" },
  { name: "Net", key: "net", type: "dollar", description: "Net profit/loss" },
];

const getMonthsForQuarter = (quarter: number, year: number) => {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  const months = [];
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

export const FinancialSummary = ({ departmentId, year, quarter }: FinancialSummaryProps) => {
  const [entries, setEntries] = useState<{ [key: string]: number }>({});
  const [targets, setTargets] = useState<{ [key: string]: number }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [isOpen, setIsOpen] = useState(true);
  const [targetsDialogOpen, setTargetsDialogOpen] = useState(false);
  const [editTargets, setEditTargets] = useState<{ [key: string]: string }>({});
  const [localValues, setLocalValues] = useState<{ [key: string]: string }>({});
  const { toast } = useToast();
  const saveTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const months = getMonthsForQuarter(quarter, year);

  useEffect(() => {
    loadFinancialData();
    loadTargets();
  }, [departmentId, year, quarter]);

  // Update local values when entries change
  useEffect(() => {
    const newLocalValues: { [key: string]: string } = {};
    Object.entries(entries).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        newLocalValues[key] = value.toString();
      }
    });
    setLocalValues(prev => {
      // Only update if we don't have pending saves for these keys
      const updated = { ...prev };
      Object.keys(newLocalValues).forEach(key => {
        if (!saveTimeoutRef.current[key]) {
          updated[key] = newLocalValues[key];
        }
      });
      return updated;
    });
  }, [entries]);

  const loadTargets = async () => {
    if (!departmentId) return;

    const { data, error } = await supabase
      .from("financial_targets")
      .select("*")
      .eq("department_id", departmentId);

    if (error) {
      console.error("Error loading targets:", error);
      return;
    }

    const targetsMap: { [key: string]: number } = {};
    const editMap: { [key: string]: string } = {};
    data?.forEach(target => {
      targetsMap[target.metric_name] = target.target_value || 0;
      editMap[target.metric_name] = target.target_value?.toString() || "";
    });

    setTargets(targetsMap);
    setEditTargets(editMap);
  };

  const handleSaveTargets = async () => {
    const updates = FINANCIAL_METRICS.map(metric => ({
      department_id: departmentId,
      metric_name: metric.key,
      target_value: parseFloat(editTargets[metric.key] || "0"),
    }));

    const { error } = await supabase
      .from("financial_targets")
      .upsert(updates, {
        onConflict: "department_id,metric_name"
      });

    if (error) {
      toast({ title: "Error", description: "Failed to save targets", variant: "destructive" });
      return;
    }

    toast({ title: "Success", description: "Targets saved successfully" });
    setTargetsDialogOpen(false);
    loadTargets();
  };

  const loadFinancialData = async () => {
    if (!departmentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const monthIds = months.map(m => m.identifier);

    const { data, error } = await supabase
      .from("financial_entries")
      .select("*")
      .eq("department_id", departmentId)
      .in("month", monthIds);

    if (error) {
      toast({ title: "Error", description: "Failed to load financial data", variant: "destructive" });
      setLoading(false);
      return;
    }

    const entriesMap: { [key: string]: number } = {};
    data?.forEach(entry => {
      const key = `${entry.metric_name}-${entry.month}`;
      entriesMap[key] = entry.value || 0;
    });

    setEntries(entriesMap);
    setLoading(false);
  };

  const handleValueChange = (metricKey: string, monthId: string, value: string) => {
    const key = `${metricKey}-${monthId}`;
    
    // Update local state immediately for responsive UI
    setLocalValues(prev => ({ ...prev, [key]: value }));

    // Clear existing timeout for this field
    if (saveTimeoutRef.current[key]) {
      clearTimeout(saveTimeoutRef.current[key]);
    }

    // Set new timeout to save after user stops typing
    saveTimeoutRef.current[key] = setTimeout(async () => {
      const numValue = parseFloat(value) || null;

      setSaving(prev => ({ ...prev, [key]: true }));

      // If value is empty/null, delete the entry
      if (numValue === null || value === '') {
        const { error } = await supabase
          .from("financial_entries")
          .delete()
          .eq("department_id", departmentId)
          .eq("month", monthId)
          .eq("metric_name", metricKey);

        if (error) {
          toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
        }
      } else {
        const { data: session } = await supabase.auth.getSession();
        const userId = session.session?.user?.id;

        const { error } = await supabase
          .from("financial_entries")
          .upsert({
            department_id: departmentId,
            month: monthId,
            metric_name: metricKey,
            value: numValue,
            created_by: userId,
          }, {
            onConflict: "department_id,month,metric_name"
          });

        if (error) {
          toast({ title: "Error", description: "Failed to save financial entry", variant: "destructive" });
        }
      }

      await loadFinancialData();
      setSaving(prev => ({ ...prev, [key]: false }));
      delete saveTimeoutRef.current[key];
    }, 500);
  };

  const formatValue = (value: number | undefined, type: string) => {
    if (value === null || value === undefined) return "";
    if (type === "dollar") return value.toLocaleString();
    if (type === "percentage") return value.toString();
    return value.toString();
  };

  const formatTarget = (value: number | undefined, type: string) => {
    if (value === null || value === undefined) return "-";
    if (type === "dollar") return `$${value.toLocaleString()}`;
    if (type === "percentage") return `${value}%`;
    return value.toString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Financial Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Financial Summary
                </CardTitle>
                <CardDescription>
                  Monthly financial performance metrics for Q{quarter} {year}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={targetsDialogOpen} onOpenChange={setTargetsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                      <Settings className="h-4 w-4 mr-2" />
                      Set Targets
                    </Button>
                  </DialogTrigger>
                  <DialogContent onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                      <DialogTitle>Set Financial Targets</DialogTitle>
                      <DialogDescription>
                        Define target values for each financial metric
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                      {FINANCIAL_METRICS.map((metric) => (
                        <div key={metric.key} className="space-y-2">
                          <Label htmlFor={metric.key}>{metric.name}</Label>
                          <Input
                            id={metric.key}
                            type="number"
                            step="any"
                            value={editTargets[metric.key] || ""}
                            onChange={(e) =>
                              setEditTargets(prev => ({ ...prev, [metric.key]: e.target.value }))
                            }
                            placeholder={`Enter ${metric.name} target`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setTargetsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveTargets}>
                        Save Targets
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px] font-bold py-2">
                      Financial Metric
                    </TableHead>
                    <TableHead className="text-center font-bold min-w-[100px] py-2">Target</TableHead>
                    {months.map((month) => (
                      <TableHead key={month.identifier} className="text-center min-w-[140px] font-bold py-2">
                        {month.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FINANCIAL_METRICS.map((metric) => {
                    const target = targets[metric.key];
                    
                    return (
                      <TableRow key={metric.key} className="hover:bg-muted/30">
                        <TableCell className="sticky left-0 bg-background z-10 py-2">
                          <div>
                            <p className="font-medium text-sm">{metric.name}</p>
                            <p className="text-xs text-muted-foreground">{metric.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground py-2">
                          {formatTarget(target, metric.type)}
                        </TableCell>
                        {months.map((month) => {
                          const key = `${metric.key}-${month.identifier}`;
                          const value = entries[key];
                          
                          return (
                            <TableCell
                              key={month.identifier}
                              className={cn(
                                "p-1 relative",
                                metric.key === "net" && value && value < 0 && "bg-destructive/10"
                              )}
                            >
                              <div className="relative flex items-center">
                                {metric.type === "dollar" && (
                                  <span className="absolute left-2 text-muted-foreground text-sm pointer-events-none z-10">$</span>
                                )}
                                <Input
                                  type="number"
                                  step="any"
                                  value={localValues[key] || ""}
                                  onChange={(e) =>
                                    handleValueChange(metric.key, month.identifier, e.target.value)
                                  }
                                  className={cn(
                                    "text-center border-0 bg-transparent focus-visible:ring-1 h-8",
                                    metric.type === "dollar" && "pl-6",
                                    metric.type === "percentage" && "pr-6",
                                    metric.key === "net" && value && value < 0 && "text-destructive font-medium"
                                  )}
                                  placeholder="-"
                                  disabled={saving[key]}
                                />
                                {metric.type === "percentage" && (
                                  <span className="absolute right-2 text-muted-foreground text-sm pointer-events-none z-10">%</span>
                                )}
                                {saving[key] && (
                                  <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                )}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
