import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { format, subMonths, startOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface LocationState {
  storeIds: string[];
  selectedMetrics: string[];
  startMonth: string;
  endMonth: string;
  brandDisplayName?: string;
  filterName?: string;
}

export default function FixedCombinedTrendReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);

  // Redirect if no state
  useEffect(() => {
    if (!location.state) {
      navigate("/enterprise", { replace: true });
    }
  }, [location.state, navigate]);

  if (!location.state) {
    return null;
  }

  const { 
    storeIds = [], 
    selectedMetrics = [], 
    startMonth, 
    endMonth,
    brandDisplayName = "All Brands",
    filterName = ""
  } = location.state as LocationState;

  // Generate list of months in range
  const months = useMemo(() => {
    const result: string[] = [];
    let current = new Date(startMonth + '-15');
    const end = new Date(endMonth + '-15');
    
    while (current <= end) {
      result.push(format(current, 'yyyy-MM'));
      current = new Date(current.setMonth(current.getMonth() + 1));
    }
    
    return result;
  }, [startMonth, endMonth]);

  // Fetch stores info
  const { data: stores } = useQuery({
    queryKey: ["trend_report_stores", storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, brand, brands(name)")
        .in("id", storeIds);
      if (error) throw error;
      return data;
    },
    enabled: storeIds.length > 0,
  });

  // Fetch departments for stores (Parts and Service only)
  const { data: departments } = useQuery({
    queryKey: ["trend_report_departments", storeIds],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, store_id")
        .in("store_id", storeIds);
      if (error) throw error;
      // Filter to only Parts and Service departments
      return data?.filter(d => 
        d.name.toLowerCase().includes('parts') || 
        d.name.toLowerCase().includes('service')
      ) || [];
    },
    enabled: storeIds.length > 0,
  });

  const departmentIds = useMemo(() => {
    return departments?.map(d => d.id) || [];
  }, [departments]);

  // Fetch financial entries for date range
  const { data: financialEntries, isLoading } = useQuery({
    queryKey: ["trend_report_financial", departmentIds, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id)")
        .in("department_id", departmentIds)
        .gte("month", startMonth)
        .lte("month", endMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0,
  });

  // Process data: aggregate by store (combining Parts + Service) and month
  const processedData = useMemo(() => {
    if (!financialEntries || !stores || !departments) return {};
    
    // Build metric key/name maps
    const allMetrics = getMetricsForBrand(null);
    const nameToKey = new Map<string, string>();
    const keyToName = new Map<string, string>();
    const keyToDef = new Map<string, any>();
    
    allMetrics.forEach((m: any) => {
      nameToKey.set(m.name, m.key);
      keyToName.set(m.key, m.name);
      keyToDef.set(m.key, m);
    });

    // Group entries by store and month
    const storeMonthData: Record<string, Record<string, Map<string, number>>> = {};
    
    stores.forEach(store => {
      storeMonthData[store.id] = {};
      months.forEach(month => {
        storeMonthData[store.id][month] = new Map();
      });
    });

    // Aggregate entries
    financialEntries.forEach(entry => {
      const storeId = (entry as any)?.departments?.store_id;
      if (!storeId || !storeMonthData[storeId]) return;
      
      const month = entry.month;
      if (!storeMonthData[storeId][month]) return;
      
      const currentValue = storeMonthData[storeId][month].get(entry.metric_name) || 0;
      storeMonthData[storeId][month].set(entry.metric_name, currentValue + (entry.value || 0));
    });

    // Calculate derived metrics for each store/month
    const calculateDerivedMetric = (storeMetrics: Map<string, number>, metricDef: any): number => {
      if (!metricDef.calculation) return storeMetrics.get(metricDef.key) || 0;
      
      const calc = metricDef.calculation;
      
      if ('numerator' in calc && 'denominator' in calc) {
        const num = storeMetrics.get(calc.numerator) || 0;
        const denom = storeMetrics.get(calc.denominator) || 0;
        return denom !== 0 ? (num / denom) * 100 : 0;
      }
      
      if (calc.type === 'subtract') {
        let value = storeMetrics.get(calc.base) || 0;
        (calc.deductions || []).forEach((d: string) => {
          value -= storeMetrics.get(d) || 0;
        });
        return value;
      }
      
      if (calc.type === 'complex') {
        let value = storeMetrics.get(calc.base) || 0;
        (calc.deductions || []).forEach((d: string) => {
          value -= storeMetrics.get(d) || 0;
        });
        (calc.additions || []).forEach((a: string) => {
          value += storeMetrics.get(a) || 0;
        });
        return value;
      }
      
      return storeMetrics.get(metricDef.key) || 0;
    };

    // Calculate derived metrics for each store/month
    stores.forEach(store => {
      months.forEach(month => {
        const storeMetrics = storeMonthData[store.id][month];
        
        // First pass: calculate dollar metrics
        allMetrics.forEach((metricDef: any) => {
          if (metricDef.type === 'dollar' && metricDef.calculation) {
            const calculated = calculateDerivedMetric(storeMetrics, metricDef);
            storeMetrics.set(metricDef.key, calculated);
          }
        });
        
        // Second pass: calculate percentage metrics
        allMetrics.forEach((metricDef: any) => {
          if (metricDef.type === 'percentage') {
            const calculated = calculateDerivedMetric(storeMetrics, metricDef);
            storeMetrics.set(metricDef.key, calculated);
          }
        });
      });
    });

    // Build final data structure
    const result: Record<string, Record<string, Record<string, number | null>>> = {};
    
    stores.forEach(store => {
      result[store.id] = {
        storeName: store.name,
        metrics: {},
      } as any;
      
      selectedMetrics.forEach(metricName => {
        const metricKey = nameToKey.get(metricName);
        if (!metricKey) return;
        
        result[store.id][metricName] = {};
        months.forEach(month => {
          const value = storeMonthData[store.id][month].get(metricKey);
          result[store.id][metricName][month] = value !== undefined ? value : null;
        });
      });
    });

    return result;
  }, [financialEntries, stores, departments, months, selectedMetrics]);

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";
    
    const metrics = getMetricsForBrand(null);
    const metricDef = metrics.find((m: any) => m.name === metricName);
    
    if (metricDef?.type === "percentage" || metricName.includes("%")) {
      return `${value.toFixed(1)}%`;
    }
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatMonthHeader = (month: string) => {
    return format(new Date(month + '-15'), 'MMM yy');
  };

  const handlePrint = () => {
    window.print();
  };

  const storeEntries = Object.entries(processedData).filter(([id]) => id !== 'storeName');

  return (
    <div className="min-h-screen bg-background">
      {/* Screen header - hidden when printing */}
      <div className="p-6 print:hidden">
        <div className="max-w-[2000px] mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/enterprise")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold">
                {filterName || "Fixed Combined Monthly Trend Report"}
              </h1>
              <p className="text-muted-foreground">
                <span className="font-medium">{brandDisplayName}</span>
                {" • "}{storeEntries.length} store{storeEntries.length !== 1 ? 's' : ''}
                {" • "}{format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
              </p>
            </div>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report content - print-friendly */}
      <div ref={printRef} className="p-6 print:p-0">
        <div className="max-w-[2000px] mx-auto space-y-8 print:space-y-4">
          {/* Print header - only shown when printing */}
          <div className="hidden print:block print:mb-4">
            <h1 className="text-2xl font-bold text-black">
              {filterName || "Fixed Combined Monthly Trend Report"}
            </h1>
            <p className="text-sm text-gray-600">
              {brandDisplayName} • {format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
            </p>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : storeEntries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-lg font-semibold text-muted-foreground">No data available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  There are no financial entries for the selected stores and date range.
                </p>
                <Button onClick={() => navigate("/enterprise")} variant="outline" className="mt-4">
                  Return to Enterprise View
                </Button>
              </CardContent>
            </Card>
          ) : (
            storeEntries.map(([storeId, storeData]) => {
              const store = stores?.find(s => s.id === storeId);
              if (!store) return null;
              
              return (
                <Card key={storeId} className="print:shadow-none print:border print:break-inside-avoid">
                  <CardHeader className="print:py-2">
                    <CardTitle className="text-xl print:text-lg">
                      {store.name} - Fixed Combined
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="print:p-2">
                    <div className="overflow-x-auto">
                      <Table className="print:text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] print:bg-gray-100 print:font-bold">
                              Metric
                            </TableHead>
                            {months.map(month => (
                              <TableHead key={month} className="text-center min-w-[80px] print:bg-gray-100 print:font-bold">
                                {formatMonthHeader(month)}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMetrics.map(metricName => {
                            const metricData = storeData[metricName] as Record<string, number | null> | undefined;
                            
                            return (
                              <TableRow key={metricName} className="print:border-b print:border-gray-300">
                                <TableCell className="font-medium sticky left-0 bg-background z-10 print:bg-white">
                                  {metricName}
                                </TableCell>
                                {months.map(month => (
                                  <TableCell key={month} className="text-center">
                                    {formatValue(metricData?.[month] ?? null, metricName)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:block {
            display: block !important;
          }
          
          @page {
            size: landscape;
            margin: 0.5in;
          }
          
          table {
            font-size: 9px !important;
          }
          
          th, td {
            padding: 4px 6px !important;
            border: 1px solid #333 !important;
          }
          
          th {
            background-color: #e0e0e0 !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
}
