import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getMetricsForBrand } from "@/config/financialMetrics";

interface MetricData {
  storeId: string;
  storeName: string;
  departmentId?: string;
  departmentName?: string;
  metricName: string;
  value: number | null;
  target?: number | null;
  variance?: number | null;
}

interface MetricComparisonTableProps {
  data: MetricData[];
  metricType: "weekly" | "monthly" | "financial";
  selectedMetrics: string[];
  isLoading?: boolean;
  sortByMetric?: string;
}

export default function MetricComparisonTable({
  data,
  metricType,
  selectedMetrics,
  isLoading = false,
  sortByMetric = "",
}: MetricComparisonTableProps) {
  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-pulse">Loading financial data...</div>
      </div>
    );
  }

  if (selectedMetrics.length === 0 || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {selectedMetrics.length === 0
          ? "Select metrics to view comparison"
          : "No data available for the selected criteria"}
        <div className="text-xs mt-2">(Data: {data.length}, Metrics: {selectedMetrics.length})</div>
      </div>
    );
  }

  // Group data by store
  const storeData = data.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        metrics: {},
      };
    }
    const key = item.departmentName ? `${item.departmentName} - ${item.metricName}` : item.metricName;
    acc[item.storeId].metrics[key] = item;
    return acc;
  }, {} as Record<string, { storeName: string; metrics: Record<string, MetricData> }>);

  // Sort stores by the selected metric (best/highest values first = left side)
  let stores = Object.entries(storeData);
  if (sortByMetric) {
    stores = stores.sort(([, aData], [, bData]) => {
      const aValue = aData.metrics[sortByMetric]?.value ?? -Infinity;
      const bValue = bData.metrics[sortByMetric]?.value ?? -Infinity;
      return bValue - aValue;
    });
  }

  // Get metric definitions to determine type (must be before allMetricKeys which uses it)
  const metrics = getMetricsForBrand(null);
  const metricDefMap = new Map<string, any>();
  metrics.forEach((m: any) => metricDefMap.set(m.name, m));

  // Build allMetricKeys with sub-metrics appearing directly below their parent
  const allMetricKeys = useMemo(() => {
    const uniqueKeys = Array.from(
      new Set(
        data.map((d) => (d.departmentName ? `${d.departmentName} - ${d.metricName}` : d.metricName)),
      ),
    );

    // Build a map of parent metric key -> list of sub-metric keys
    const parentToSubs = new Map<string, string[]>();
    const subKeySet = new Set<string>();

    uniqueKeys.forEach((key) => {
      // Sub-metrics are displayed as "↳ SubName" or "Dept - ↳ SubName"
      const isSubMetric = key.includes("↳");
      if (isSubMetric) {
        subKeySet.add(key);
        // Try to find the parent by matching the selection ID structure
        // Look for a parent by checking selectedMetrics for matching sub: entries
        selectedMetrics.forEach((selId) => {
          if (selId.startsWith("sub:")) {
            const parts = selId.split(":");
            const parentKey = parts[1];
            const subName = parts.slice(parts.length >= 4 ? 3 : 2).join(":");
            const expectedSubDisplay = `↳ ${subName}`;
            
            // Check if this key ends with the expected sub display
            if (key.endsWith(expectedSubDisplay)) {
              // Find the parent display name in the list
              const parentDef = metrics.find((m: any) => m.key === parentKey);
              if (parentDef) {
                const deptPrefix = key.includes(" - ") ? key.split(" - ↳")[0] + " - " : "";
                const parentDisplayKey = deptPrefix + parentDef.name;
                
                if (!parentToSubs.has(parentDisplayKey)) {
                  parentToSubs.set(parentDisplayKey, []);
                }
                if (!parentToSubs.get(parentDisplayKey)!.includes(key)) {
                  parentToSubs.get(parentDisplayKey)!.push(key);
                }
              }
            }
          }
        });
      }
    });

    // Build ordered list: parent followed by its sub-metrics
    const orderedKeys: string[] = [];
    const addedKeys = new Set<string>();

    uniqueKeys.forEach((key) => {
      if (addedKeys.has(key)) return;
      
      // Skip sub-metrics here; they'll be added after their parent
      if (subKeySet.has(key)) return;
      
      // Add the parent/regular metric
      orderedKeys.push(key);
      addedKeys.add(key);
      
      // Add any sub-metrics for this parent
      const subs = parentToSubs.get(key);
      if (subs) {
        subs.forEach((subKey) => {
          if (!addedKeys.has(subKey)) {
            orderedKeys.push(subKey);
            addedKeys.add(subKey);
          }
        });
      }
    });

    // Add any remaining sub-metrics that weren't matched to a parent
    uniqueKeys.forEach((key) => {
      if (!addedKeys.has(key)) {
        orderedKeys.push(key);
      }
    });

    return orderedKeys;
  }, [data, selectedMetrics, metrics]);

  // Map sub-metric display rows ("↳ ...") to the type of their parent selection.
  // This is required because sub-metric rows don't exist in the base metric defs by name.
  const subRowTypeByDisplayName = useMemo(() => {
    const map = new Map<string, "percentage" | "dollar">();

    selectedMetrics.forEach((selectionId) => {
      if (!selectionId.startsWith("sub:")) return;
      const parts = selectionId.split(":");
      if (parts.length < 3) return;

      const parentKey = parts[1];
      const parentDef = metrics.find((d: any) => d.key === parentKey);
      const displayName = `↳ ${parts.slice(parts.length >= 4 ? 3 : 2).join(":")}`;

      map.set(displayName, parentDef?.type === "percentage" ? "percentage" : "dollar");
    });

    return map;
  }, [selectedMetrics, metrics]);

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";

    // Sub-metric rows are displayed as "↳ ..." and need type info from the parent selection.
    const subRowType = subRowTypeByDisplayName.get(metricName);
    if (subRowType === "percentage") {
      return `${value.toFixed(1)}%`;
    }

    const metricDef = metricDefMap.get(metricName);
    if (metricDef?.type === "percentage" || metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
      return `${value.toFixed(1)}%`;
    }

    if (metricName === "Total Hours") {
      return Math.round(value).toLocaleString();
    }

    if (metricType === "financial") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    return value.toLocaleString();
  };

  const getVarianceIcon = (variance: number | null) => {
    if (!variance) return <Minus className="h-4 w-4 text-muted-foreground" />;
    if (variance > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getVarianceColor = (variance: number | null) => {
    if (!variance) return "text-muted-foreground";
    if (variance > 0) return "text-green-600";
    return "text-red-600";
  };

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="min-w-full">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-20 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
                <tr>
                  <th className="border-b border-r px-4 py-3 text-left font-semibold sticky left-0 bg-muted/95 backdrop-blur z-30">
                    Metric
                  </th>
                  {stores.map(([storeId, { storeName }]) => (
                    <th key={storeId} className="border-b px-4 py-3 text-left font-semibold min-w-[200px]">
                      {storeName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMetricKeys.map((metricKey, idx) => {
                  const isSortedRow = sortByMetric && metricKey === sortByMetric;
                  return (
                    <tr
                      key={metricKey}
                      className={`${isSortedRow ? "bg-primary/10 ring-1 ring-primary/30" : idx % 2 === 0 ? "bg-background" : "bg-muted/20"}`}
                    >
                      <td
                        className={`border-b border-r px-4 py-3 font-medium sticky left-0 z-10 ${isSortedRow ? "bg-primary/10 font-semibold text-primary" : "bg-inherit"}`}
                      >
                        {metricKey}
                      </td>
                      {stores.map(([storeId, { metrics }]) => {
                        const metric = metrics[metricKey];
                        return (
                          <td key={storeId} className="border-b px-4 py-3">
                            {metric ? (
                              <div className="space-y-1">
                                <div className="font-semibold">{formatValue(metric.value, metric.metricName)}</div>
                                {metric.target !== null && metric.target !== undefined && (
                                  <div className="text-xs text-muted-foreground">
                                    Target: {formatValue(metric.target, metric.metricName)}
                                  </div>
                                )}
                                {metric.variance !== null && metric.variance !== undefined && (
                                  <div className={`text-xs flex items-center gap-1 ${getVarianceColor(metric.variance)}`}>
                                    {getVarianceIcon(metric.variance)}
                                    {metric.variance > 0 ? "+" : ""}
                                    {metric.variance.toFixed(1)}%
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
