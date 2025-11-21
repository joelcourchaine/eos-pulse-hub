import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
}

export default function MetricComparisonTable({
  data,
  metricType,
  selectedMetrics,
}: MetricComparisonTableProps) {
  console.log("MetricComparisonTable render:", {
    dataLength: data.length,
    selectedMetricsCount: selectedMetrics.length,
    metricType,
    sampleData: data.slice(0, 2),
  });

  if (selectedMetrics.length === 0 || data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select metrics and stores to view comparison
        <div className="text-xs mt-2">
          (Data: {data.length}, Metrics: {selectedMetrics.length})
        </div>
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
    const key = item.departmentName 
      ? `${item.departmentName} - ${item.metricName}`
      : item.metricName;
    acc[item.storeId].metrics[key] = item;
    return acc;
  }, {} as Record<string, { storeName: string; metrics: Record<string, MetricData> }>);

  const stores = Object.entries(storeData);
  const allMetricKeys = Array.from(
    new Set(data.map(d => 
      d.departmentName 
        ? `${d.departmentName} - ${d.metricName}`
        : d.metricName
    ))
  );

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";
    
    const lowerMetricName = metricName.toLowerCase();
    
    // Check if it's a percentage metric
    if (lowerMetricName.includes("%") || lowerMetricName.includes("percent")) {
      return `${value.toFixed(1)}%`;
    }
    
    // Check if it's a currency metric
    if (metricType === "financial" || lowerMetricName.includes("$") || 
        lowerMetricName.includes("sales") || lowerMetricName.includes("expense") ||
        lowerMetricName.includes("profit") || lowerMetricName.includes("gross")) {
      // Only format as currency if it's not a percentage
      if (!lowerMetricName.includes("%") && !lowerMetricName.includes("percent")) {
        return `$${value.toLocaleString()}`;
      }
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
                    <th
                      key={storeId}
                      className="border-b px-4 py-3 text-left font-semibold min-w-[200px]"
                    >
                      {storeName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMetricKeys.map((metricKey, idx) => (
                  <tr
                    key={metricKey}
                    className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className="border-b border-r px-4 py-3 font-medium sticky left-0 bg-inherit z-10">
                      {metricKey}
                    </td>
                    {stores.map(([storeId, { metrics }]) => {
                      const metric = metrics[metricKey];
                      return (
                        <td key={storeId} className="border-b px-4 py-3">
                          {metric ? (
                            <div className="space-y-1">
                              <div className="font-semibold">
                                {formatValue(metric.value, metric.metricName)}
                              </div>
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
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
