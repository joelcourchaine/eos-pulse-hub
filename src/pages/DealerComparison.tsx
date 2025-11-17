import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ComparisonData {
  storeId: string;
  storeName: string;
  departmentId?: string;
  departmentName?: string;
  metricName: string;
  value: number | null;
  target: number | null;
  variance: number | null;
}

export default function DealerComparison() {
  const location = useLocation();
  const navigate = useNavigate();

  // Check if state exists, redirect if not
  useEffect(() => {
    if (!location.state) {
      navigate("/enterprise", { replace: true });
    }
  }, [location.state, navigate]);

  // Return null while redirecting
  if (!location.state) {
    return null;
  }

  const { data, metricType, selectedMetrics } = location.state as {
    data: ComparisonData[];
    metricType: string;
    selectedMetrics: string[];
  };

  // Group data by store
  const storeData = data.reduce((acc, item) => {
    if (!acc[item.storeId]) {
      acc[item.storeId] = {
        storeName: item.storeName,
        metrics: {},
      };
    }
    if (!acc[item.storeId].metrics[item.metricName]) {
      acc[item.storeId].metrics[item.metricName] = {
        value: item.value,
        target: item.target,
        variance: item.variance,
      };
    }
    return acc;
  }, {} as Record<string, { storeName: string; metrics: Record<string, { value: number | null; target: number | null; variance: number | null }> }>);

  const stores = Object.entries(storeData);

  const getVarianceColor = (variance: number | null) => {
    if (variance === null) return "secondary";
    if (variance >= 0) return "default";
    return "destructive";
  };

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null) return "N/A";
    
    // Check if it's a percentage metric
    if (metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
      return `${value.toFixed(1)}%`;
    }
    
    // Format as currency for dollar metrics
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[2000px] mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/enterprise")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Dealer Comparison Dashboard</h1>
            <p className="text-muted-foreground">
              Comparing {stores.length} stores across {selectedMetrics.length} metrics
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Side-by-Side Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold sticky left-0 bg-background z-10">Metric</TableHead>
                    {stores.map(([storeId, store]) => (
                      <TableHead key={storeId} className="text-center min-w-[200px]">
                        <div className="text-lg font-bold text-foreground">
                          {store.storeName}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMetrics.map((metric) => (
                    <TableRow key={metric}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        {metric}
                      </TableCell>
                      {stores.map(([storeId, store]) => {
                        const metricData = store.metrics[metric];
                        return (
                          <TableCell key={storeId} className="text-center">
                            {metricData ? (
                              <div className="space-y-2">
                                <div className="text-lg font-semibold">
                                  {formatValue(metricData.value, metric)}
                                </div>
                                {metricData.target !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    Target: {formatValue(metricData.target, metric)}
                                  </div>
                                )}
                                {metricData.variance !== null && (
                                  <Badge variant={getVarianceColor(metricData.variance)}>
                                    {metricData.variance >= 0 ? "+" : ""}
                                    {metricData.variance.toFixed(1)}%
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">No data</span>
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
        </Card>
      </div>
    </div>
  );
}
