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


  const getMetricRowLabel = (metricName: string) => {
    if (metricName.startsWith("sub:")) {
      const parts = metricName.split(":");
      return `↳ ${parts.slice(2).join(":")}`;
    }
    return metricName;
  };

  // Group data by store
  const storeData = data.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        metrics: {},
      };
    }
    const rowLabel = getMetricRowLabel(item.metricName);
    const key = item.departmentName ? `${item.departmentName} - ${rowLabel}` : rowLabel;
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
        data.map((d) => {
          const rowLabel = getMetricRowLabel(d.metricName);
          return d.departmentName ? `${d.departmentName} - ${rowLabel}` : rowLabel;
        }),
      ),
    );


    // Build preferred row order from the user's selection order.
    // This avoids relying on data-map insertion order and ensures sub-metrics render
    // immediately after their parent.
    const departmentNames = Array.from(
      new Set(data.map((d) => d.departmentName).filter(Boolean) as string[]),
    );

    const buildDisplayLabelFromSelectionId = (selectionId: string) => {
      if (!selectionId.startsWith("sub:")) return selectionId;
      const parts = selectionId.split(":");
      // sub:<parentKey>:<subName...>
      return `↳ ${parts.slice(2).join(":")}`;
    };

    const preferredOrder: string[] = [];
    const deptsToOrder = departmentNames.length ? departmentNames : [null];

    deptsToOrder.forEach((dept) => {
      selectedMetrics.forEach((selectionId) => {
        const label = buildDisplayLabelFromSelectionId(selectionId);
        preferredOrder.push(dept ? `${dept} - ${label}` : label);

        // If we have a sub-metric selected, also ensure the parent appears immediately
        // above it in the preferred order (even if the parent wasn't explicitly selected).
        if (selectionId.startsWith("sub:")) {
          const parentKey = selectionId.split(":")[1];
          const parentDef = metrics.find((m: any) => m.key === parentKey);
          const parentLabel = parentDef?.name ?? parentKey;
          const parentRowKey = dept ? `${dept} - ${parentLabel}` : parentLabel;

          // Insert parent just before the sub-metric (if it isn't already in the list).
          const subRowKey = dept ? `${dept} - ${label}` : label;
          const subIdx = preferredOrder.lastIndexOf(subRowKey);
          if (subIdx !== -1 && !preferredOrder.includes(parentRowKey)) {
            preferredOrder.splice(subIdx, 0, parentRowKey);
          }
        }
      });
    });

    const preferredIndex = new Map<string, number>();
    preferredOrder.forEach((k, idx) => {
      if (!preferredIndex.has(k)) preferredIndex.set(k, idx);
    });

    return uniqueKeys.sort((a, b) => {
      const ai = preferredIndex.get(a);
      const bi = preferredIndex.get(b);
      if (ai === undefined && bi === undefined) return a.localeCompare(b);
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
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
                                <div className="font-semibold">
                                  {formatValue(metric.value, getMetricRowLabel(metric.metricName))}
                                </div>
                                {metric.target !== null && metric.target !== undefined && (
                                  <div className="text-xs text-muted-foreground">
                                    Target: {formatValue(metric.target, getMetricRowLabel(metric.metricName))}
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
