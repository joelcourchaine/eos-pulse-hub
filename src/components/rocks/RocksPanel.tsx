import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Target, Trash2, Loader2, Mountain, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RockManagementDialog } from "./RockManagementDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Fireworks } from "@/components/ui/fireworks";
import { getMetricsForBrand, type FinancialMetric } from "@/config/financialMetrics";
import { cn } from "@/lib/utils";

interface Rock {
  id: string;
  title: string;
  description: string | null;
  progress_percentage: number;
  status: "on_track" | "at_risk" | "off_track" | "completed";
  due_date: string | null;
  assigned_to: string | null;
  year: number;
  quarter: number;
  department_id: string;
  linked_metric_key: string | null;
  linked_metric_type: "metric" | "submetric" | null;
  linked_submetric_name: string | null;
  linked_parent_metric_key: string | null;
  target_direction: "above" | "below" | null;
}

interface RockMonthlyTarget {
  id: string;
  rock_id: string;
  month: string;
  target_value: number;
}

interface MonthlyProgress {
  month: string;
  label: string;
  target: number | null;
  actual: number | null;
  status: "met" | "missed" | "close" | "pending";
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "on_track":
      return "success";
    case "at_risk":
      return "warning";
    case "off_track":
      return "destructive";
    case "completed":
      return "default";
    default:
      return "default";
  }
};

const getStatusLabel = (status: string) => {
  return status.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const getQuarterMonths = (quarter: number, year: number) => {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months: { label: string; identifier: string }[] = [];
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
};

interface RocksPanelProps {
  departmentId?: string;
}

const RocksPanel = ({ departmentId }: RocksPanelProps) => {
  const [rocks, setRocks] = useState<Rock[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteRockId, setDeleteRockId] = useState<string | null>(null);
  const [rockTargets, setRockTargets] = useState<{ [rockId: string]: RockMonthlyTarget[] }>({});
  const [actualValues, setActualValues] = useState<{ [key: string]: number }>({});
  const [storeBrand, setStoreBrand] = useState<string | null>(null);
  const { toast } = useToast();
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentQuarter = Math.ceil((currentDate.getMonth() + 1) / 3);
  const quarterMonths = useMemo(() => getQuarterMonths(currentQuarter, currentYear), [currentQuarter, currentYear]);

  const FINANCIAL_METRICS = useMemo(() => {
    return getMetricsForBrand(storeBrand);
  }, [storeBrand]);

  useEffect(() => {
    if (departmentId) {
      loadRocks();
      loadStoreBrand();
    }
  }, [departmentId]);

  const loadStoreBrand = async () => {
    if (!departmentId) return;
    
    const { data: department } = await supabase
      .from("departments")
      .select("store_id")
      .eq("id", departmentId)
      .maybeSingle();
    
    if (department?.store_id) {
      const { data: store } = await supabase
        .from("stores")
        .select("brand, brand_id, brands(name)")
        .eq("id", department.store_id)
        .maybeSingle();
      
      const brandName = (store as any)?.brands?.name || store?.brand || null;
      setStoreBrand(brandName);
    }
  };

  const loadRocks = async () => {
    if (!departmentId) return;
    
    setLoading(true);
    setRocks([]);
    
    const { data, error } = await supabase
      .from("rocks")
      .select("*")
      .eq("department_id", departmentId)
      .eq("year", currentYear)
      .eq("quarter", currentQuarter)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading rocks:", error);
      toast({ title: "Error", description: "Failed to load rocks", variant: "destructive" });
      setLoading(false);
      return;
    }
    
    const rocksList = (data || []) as Rock[];
    setRocks(rocksList);
    
    // Load targets for rocks with linked metrics
    const rocksWithMetrics = rocksList.filter(r => r.linked_metric_key);
    if (rocksWithMetrics.length > 0) {
      await loadRockTargets(rocksWithMetrics);
      await loadActualValues(rocksWithMetrics);
    }
    
    setLoading(false);
  };

  const loadRockTargets = async (rocksWithMetrics: Rock[]) => {
    const rockIds = rocksWithMetrics.map(r => r.id);
    const { data } = await supabase
      .from("rock_monthly_targets")
      .select("*")
      .in("rock_id", rockIds);
    
    const targetsMap: { [rockId: string]: RockMonthlyTarget[] } = {};
    data?.forEach(t => {
      if (!targetsMap[t.rock_id]) {
        targetsMap[t.rock_id] = [];
      }
      targetsMap[t.rock_id].push({
        id: t.id,
        rock_id: t.rock_id,
        month: t.month,
        target_value: Number(t.target_value),
      });
    });
    
    setRockTargets(targetsMap);
  };

  const loadActualValues = async (rocksWithMetrics: Rock[]) => {
    if (!departmentId) return;
    
    const monthIds = quarterMonths.map(m => m.identifier);
    
    // Build unique metric keys to fetch
    const metricKeysToFetch = new Set<string>();
    rocksWithMetrics.forEach(rock => {
      if (rock.linked_metric_type === "metric" && rock.linked_metric_key) {
        metricKeysToFetch.add(rock.linked_metric_key);
      } else if (rock.linked_metric_type === "submetric" && rock.linked_parent_metric_key && rock.linked_submetric_name) {
        metricKeysToFetch.add(`sub:${rock.linked_parent_metric_key}:${rock.linked_submetric_name}`);
      }
    });
    
    const { data } = await supabase
      .from("financial_entries")
      .select("metric_name, month, value")
      .eq("department_id", departmentId)
      .in("month", monthIds)
      .in("metric_name", Array.from(metricKeysToFetch));
    
    const valuesMap: { [key: string]: number } = {};
    data?.forEach(entry => {
      if (entry.value !== null) {
        valuesMap[`${entry.metric_name}-${entry.month}`] = entry.value;
      }
    });
    
    setActualValues(valuesMap);
  };

  const getMonthlyProgress = (rock: Rock): MonthlyProgress[] => {
    const targets = rockTargets[rock.id] || [];
    
    return quarterMonths.map(month => {
      const target = targets.find(t => t.month === month.identifier);
      let metricKey = "";
      
      if (rock.linked_metric_type === "metric" && rock.linked_metric_key) {
        metricKey = rock.linked_metric_key;
      } else if (rock.linked_metric_type === "submetric" && rock.linked_parent_metric_key && rock.linked_submetric_name) {
        metricKey = `sub:${rock.linked_parent_metric_key}:${rock.linked_submetric_name}`;
      }
      
      const actual = actualValues[`${metricKey}-${month.identifier}`] ?? null;
      const targetValue = target?.target_value ?? null;
      
      let status: MonthlyProgress["status"] = "pending";
      if (actual !== null && targetValue !== null) {
        const direction = rock.target_direction || "above";
        const variance = ((actual - targetValue) / Math.abs(targetValue)) * 100;
        
        if (direction === "above") {
          status = actual >= targetValue ? "met" : variance >= -10 ? "close" : "missed";
        } else {
          status = actual <= targetValue ? "met" : variance <= 10 ? "close" : "missed";
        }
      }
      
      return {
        month: month.identifier,
        label: month.label,
        target: targetValue,
        actual,
        status,
      };
    });
  };

  const getMetricDisplayName = (rock: Rock): string => {
    if (rock.linked_metric_type === "metric" && rock.linked_metric_key) {
      const metric = FINANCIAL_METRICS.find(m => m.key === rock.linked_metric_key);
      return metric?.name || rock.linked_metric_key;
    } else if (rock.linked_metric_type === "submetric" && rock.linked_submetric_name) {
      const parentMetric = FINANCIAL_METRICS.find(m => m.key === rock.linked_parent_metric_key);
      return `${parentMetric?.name || rock.linked_parent_metric_key} > ${rock.linked_submetric_name}`;
    }
    return "";
  };

  const handleDeleteRock = async (id: string) => {
    const { error } = await supabase
      .from("rocks")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Rock deleted successfully" });
      setDeleteRockId(null);
      loadRocks();
    }
  };

  const formatValue = (value: number | null, rock: Rock): string => {
    if (value === null) return "—";
    
    // Determine if it's a percentage or dollar metric
    if (rock.linked_metric_type === "metric" && rock.linked_metric_key) {
      const metric = FINANCIAL_METRICS.find(m => m.key === rock.linked_metric_key);
      if (metric?.type === "percentage") {
        return `${value.toFixed(1)}%`;
      }
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (!departmentId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Rocks (Quarterly Priorities)
          </CardTitle>
          <CardDescription>
            Select a department to view rocks
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }
  
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Rocks (Quarterly Priorities)
              </CardTitle>
              <CardDescription>
                Q{currentQuarter} {currentYear} - Focus on 3-5 key objectives
              </CardDescription>
            </div>
            <RockManagementDialog
              departmentId={departmentId}
              year={currentYear}
              quarter={currentQuarter}
              onRocksChange={loadRocks}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rocks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No rocks defined for this quarter. Add your first priority above.
            </p>
          ) : (
            <div className="space-y-6">
              {rocks.map((rock) => {
                const hasLinkedMetric = !!rock.linked_metric_key;
                const monthlyProgress = hasLinkedMetric ? getMonthlyProgress(rock) : [];
                const metricName = hasLinkedMetric ? getMetricDisplayName(rock) : "";
                
                return (
                  <div
                    key={rock.id}
                    className={cn(
                      "relative p-4 border rounded-lg hover:shadow-md transition-shadow overflow-hidden",
                      hasLinkedMetric && "border-l-4 border-l-primary"
                    )}
                  >
                    {rock.progress_percentage >= 100 && (
                      <Fireworks />
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">
                            {rock.title}
                          </h4>
                          {hasLinkedMetric && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Mountain className="h-3 w-3" />
                                    {metricName.length > 25 ? metricName.substring(0, 25) + "..." : metricName}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{metricName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Direction: {rock.target_direction === "above" ? "Above" : "Below"} target
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {rock.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {rock.description}
                          </p>
                        )}
                        {rock.due_date && (
                          <p className="text-sm text-muted-foreground">
                            Due: {new Date(rock.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {rock.progress_percentage >= 100 ? (
                          <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-0">
                            🏆 Goal Achieved!
                          </Badge>
                        ) : (
                          <Badge variant={getStatusColor(rock.status) as any}>
                            {getStatusLabel(rock.status)}
                          </Badge>
                        )}
                        <RockManagementDialog
                          departmentId={departmentId}
                          year={currentYear}
                          quarter={currentQuarter}
                          onRocksChange={loadRocks}
                          rock={rock}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteRockId(rock.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* Monthly Progress Indicators */}
                    {hasLinkedMetric && monthlyProgress.length > 0 && (
                      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-1 mb-2 text-xs text-muted-foreground">
                          {rock.target_direction === "above" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>Monthly Progress</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {monthlyProgress.map((mp) => (
                            <TooltipProvider key={mp.month}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "flex flex-col items-center p-2 rounded-lg border",
                                    mp.status === "met" && "bg-success/10 border-success/30",
                                    mp.status === "close" && "bg-warning/10 border-warning/30",
                                    mp.status === "missed" && "bg-destructive/10 border-destructive/30",
                                    mp.status === "pending" && "bg-muted/50 border-muted"
                                  )}>
                                    <span className="text-xs font-medium mb-1">{mp.label}</span>
                                    <div className={cn(
                                      "flex items-center justify-center w-6 h-6 rounded-full",
                                      mp.status === "met" && "bg-success text-success-foreground",
                                      mp.status === "close" && "bg-warning text-warning-foreground",
                                      mp.status === "missed" && "bg-destructive text-destructive-foreground",
                                      mp.status === "pending" && "bg-muted text-muted-foreground"
                                    )}>
                                      {mp.status === "met" && "✓"}
                                      {mp.status === "close" && "~"}
                                      {mp.status === "missed" && "✗"}
                                      {mp.status === "pending" && "○"}
                                    </div>
                                    <span className={cn(
                                      "text-xs mt-1",
                                      mp.status === "met" && "text-success",
                                      mp.status === "close" && "text-warning",
                                      mp.status === "missed" && "text-destructive",
                                      mp.status === "pending" && "text-muted-foreground"
                                    )}>
                                      {mp.actual !== null ? formatValue(mp.actual, rock) : "—"}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <p><strong>Target:</strong> {mp.target !== null ? formatValue(mp.target, rock) : "Not set"}</p>
                                    <p><strong>Actual:</strong> {mp.actual !== null ? formatValue(mp.actual, rock) : "No data"}</p>
                                    <p><strong>Status:</strong> {mp.status.charAt(0).toUpperCase() + mp.status.slice(1)}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{rock.progress_percentage}%</span>
                      </div>
                      <Progress value={rock.progress_percentage} className="h-2" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteRockId} onOpenChange={() => setDeleteRockId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rock?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this rock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRockId && handleDeleteRock(deleteRockId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RocksPanel;
