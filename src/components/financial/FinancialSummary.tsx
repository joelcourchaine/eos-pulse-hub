import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, DollarSign, Loader2 } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<{ [key: string]: boolean }>({});
  const [isOpen, setIsOpen] = useState(true);
  const { toast } = useToast();

  const months = getMonthsForQuarter(quarter, year);

  useEffect(() => {
    loadFinancialData();
  }, [departmentId, year, quarter]);

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

  const handleValueChange = async (metricKey: string, monthId: string, value: string) => {
    const key = `${metricKey}-${monthId}`;
    const numValue = parseFloat(value) || null;

    if (numValue === null) return;

    setSaving(prev => ({ ...prev, [key]: true }));

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
    } else {
      await loadFinancialData();
    }

    setSaving(prev => ({ ...prev, [key]: false }));
  };

  const formatValue = (value: number | undefined, type: string) => {
    if (value === null || value === undefined) return "";
    if (type === "dollar") return value.toLocaleString();
    if (type === "percentage") return value.toString();
    return value.toString();
  };

  const formatDisplay = (value: number | undefined, type: string) => {
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
              <Button variant="ghost" size="sm">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="sticky left-0 bg-muted/50 z-10 min-w-[200px] font-bold">
                      Financial Metric
                    </TableHead>
                    {months.map((month) => (
                      <TableHead key={month.identifier} className="text-center min-w-[140px] font-bold">
                        {month.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FINANCIAL_METRICS.map((metric) => (
                    <TableRow key={metric.key} className="hover:bg-muted/30">
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div>
                          <p className="font-medium">{metric.name}</p>
                          <p className="text-xs text-muted-foreground">{metric.description}</p>
                        </div>
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
                            <Input
                              type="number"
                              step="any"
                              value={formatValue(value, metric.type)}
                              onChange={(e) =>
                                handleValueChange(metric.key, month.identifier, e.target.value)
                              }
                              className={cn(
                                "text-center border-0 bg-transparent focus-visible:ring-1",
                                metric.key === "net" && value && value < 0 && "text-destructive font-medium"
                              )}
                              placeholder="-"
                              disabled={saving[key]}
                            />
                            {saving[key] && (
                              <Loader2 className="h-3 w-3 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
