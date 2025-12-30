import { useMemo, useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail, Loader2, FileSpreadsheet } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getMetricsForBrand } from "@/config/financialMetrics";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { DataCoverageBadge } from "./DataCoverageBadge";

interface FixedCombinedTrendViewProps {
  storeIds: string[];
  selectedMetrics: string[];
  startMonth: string;
  endMonth: string;
  brandDisplayName: string;
  filterName: string;
  onBack: () => void;
}

export function FixedCombinedTrendView({
  storeIds,
  selectedMetrics,
  startMonth,
  endMonth,
  brandDisplayName,
  filterName,
  onBack,
}: FixedCombinedTrendViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFormat, setEmailFormat] = useState<"html" | "excel">("html");

  // Fetch recipients (super_admins and store GMs)
  const { data: recipients = [], isLoading: loadingRecipients } = useQuery({
    queryKey: ["trend_report_recipients", storeIds],
    queryFn: async () => {
      // Fetch super_admins
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];

      // Fetch store_gm roles for the stores
      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");
      const gmIds = gmRoles?.map(r => r.user_id) || [];

      // Get profiles for all relevant users
      const allUserIds = [...new Set([...superAdminIds, ...gmIds])];
      if (allUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, store_id, stores(name)")
        .in("id", allUserIds);

      return (profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        role: p.role,
        store_name: (p as any).stores?.name,
      }));
    },
    enabled: emailDialogOpen,
  });

  const handleSendEmail = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }

    setSendingEmail(true);
    try {
      const recipientEmails = recipients
        .filter(r => selectedRecipients.includes(r.id))
        .map(r => r.email);

      const { data, error } = await supabase.functions.invoke("send-trend-report-email", {
        body: {
          recipientEmails,
          stores: stores?.map(s => ({ id: s.id, name: s.name })) || [],
          months,
          selectedMetrics,
          processedData,
          startMonth,
          endMonth,
          brandDisplayName,
          filterName,
          format: emailFormat,
        },
      });

      if (error) throw error;

      toast.success(`Report sent to ${recipientEmails.length} recipient(s)`);
      setEmailDialogOpen(false);
      setSelectedRecipients([]);
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

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
    queryKey: ["trend_view_stores", storeIds],
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
    queryKey: ["trend_view_departments", storeIds],
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
    queryKey: ["trend_view_financial", departmentIds, startMonth, endMonth],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("*, departments(id, name, store_id)")
        .in("department_id", departmentIds)
        .gte("month", startMonth)
        .lte("month", endMonth);
      if (error) throw error;
      console.log('[Trend View] Fetched financial entries:', data?.length, 'entries for', departmentIds.length, 'departments');
      return data || [];
    },
    enabled: departmentIds.length > 0,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: 'always',
  });

  // Process data: aggregate by store (combining Parts + Service) and month
  const processedData = useMemo(() => {
    if (!financialEntries || !stores || !departments) return {};
    
    // Build a default metric name/key map for selected metrics display
    const defaultMetrics = getMetricsForBrand(null);
    const nameToKey = new Map<string, string>();
    const keyToName = new Map<string, string>();
    
    defaultMetrics.forEach((m: any) => {
      nameToKey.set(m.name, m.key);
      keyToName.set(m.key, m.name);
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

    // Helper to find sub-metric key from month data
    const findSubMetricKey = (subName: string, monthData: Map<string, number>): string | null => {
      for (const [key] of monthData) {
        if (key.startsWith('sub:')) {
          const parts = key.split(':');
          if (parts.length >= 4) {
            const storedName = parts.slice(3).join(':');
            if (storedName === subName) {
              return key;
            }
          }
        }
      }
      return null;
    };

    // Calculate derived metrics for each store/month using store-specific brand
    stores.forEach(store => {
      const storeBrand = store.brand || (store as any).brands?.name || null;
      const storeMetricDefs = getMetricsForBrand(storeBrand);
      
      months.forEach(month => {
        const storeMetrics = storeMonthData[store.id][month];
        
        // First pass: calculate dollar metrics
        storeMetricDefs.forEach((metricDef: any) => {
          if (metricDef.type === 'dollar' && metricDef.calculation) {
            const calculated = calculateDerivedMetric(storeMetrics, metricDef);
            storeMetrics.set(metricDef.key, calculated);
          }
        });
        
        // Second pass: calculate percentage metrics
        storeMetricDefs.forEach((metricDef: any) => {
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
        const isSubMetric = metricName.startsWith('↳ ');
        
        result[store.id][metricName] = {};
        months.forEach(month => {
          let value: number | undefined;
          
          if (isSubMetric) {
            // For sub-metrics, find the key dynamically
            const subName = metricName.substring(2); // Remove "↳ "
            const monthData = storeMonthData[store.id][month];
            const subMetricKey = findSubMetricKey(subName, monthData);
            value = subMetricKey ? monthData.get(subMetricKey) : undefined;
          } else {
            // Regular metric - use name to key mapping
            const metricKey = nameToKey.get(metricName);
            if (metricKey) {
              value = storeMonthData[store.id][month].get(metricKey);
            }
          }
          
          result[store.id][metricName][month] = value !== undefined ? value : null;
        });
      });
    });

    return result;
  }, [financialEntries, stores, departments, months, selectedMetrics]);

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";
    
    // Sub-metrics (starting with ↳) are always dollar amounts
    if (metricName.startsWith('↳ ')) {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    
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
    <>
      {/* Screen header - hidden when printing */}
      <div className="print:hidden">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">
              {filterName || "Fixed Combined Monthly Trend Report"}
            </h2>
            <p className="text-muted-foreground">
              <span className="font-medium">{brandDisplayName}</span>
              {" • "}{storeEntries.length} store{storeEntries.length !== 1 ? 's' : ''}
              {" • "}{format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setEmailDialogOpen(true)} variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              Email Report
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report content - print-friendly */}
      <div ref={printRef} className="print:p-0">
        <div className="space-y-8 print:space-y-4">
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
                <Button onClick={onBack} variant="outline" className="mt-4">
                  Back to Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            storeEntries.map(([storeId, storeData]) => {
              const store = stores?.find(s => s.id === storeId);
              if (!store) return null;
              
              // Calculate months with data for this store
              const monthsWithData = months.filter(month => {
                return selectedMetrics.some(metricName => {
                  const metricData = storeData[metricName] as Record<string, number | null> | undefined;
                  return metricData?.[month] !== null && metricData?.[month] !== undefined;
                });
              }).length;
              
              return (
                <Card key={storeId} className="print:shadow-none print:border print:break-inside-avoid">
                  <CardHeader className="print:py-2">
                    <CardTitle className="text-xl print:text-lg flex items-center">
                      <span>{store.name} - Fixed Combined</span>
                      <DataCoverageBadge monthsWithData={monthsWithData} totalMonths={months.length} />
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
                            <TableHead className="text-center min-w-[100px] bg-primary/10 font-bold print:bg-gray-200 print:font-bold">
                              Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedMetrics.map(metricName => {
                            const metricData = storeData[metricName] as Record<string, number | null> | undefined;
                            const isSubMetric = metricName.startsWith('↳ ');
                            
                            // Calculate total/average for the metric
                            const values = months
                              .map(month => metricData?.[month])
                              .filter((v): v is number => v !== null && v !== undefined);
                            
                            const isPercentage = !isSubMetric && (metricName.includes("%") || 
                              getMetricsForBrand(null).find((m: any) => m.name === metricName)?.type === "percentage");
                            
                            const total = values.length > 0
                              ? isPercentage
                                ? values.reduce((sum, v) => sum + v, 0) / values.length // Average for percentages
                                : values.reduce((sum, v) => sum + v, 0) // Sum for dollar amounts
                              : null;
                            
                            return (
                              <TableRow key={metricName} className={`print:border-b print:border-gray-300 ${isSubMetric ? 'bg-muted/30' : ''}`}>
                                <TableCell className={`font-medium sticky left-0 z-10 print:bg-white ${isSubMetric ? 'bg-muted/30 pl-6 text-muted-foreground' : 'bg-background'}`}>
                                  {metricName}
                                </TableCell>
                                {months.map(month => (
                                  <TableCell key={month} className="text-center">
                                    {formatValue(metricData?.[month] ?? null, metricName)}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-semibold bg-primary/10">
                                  {formatValue(total, metricName)}
                                </TableCell>
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

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Email Trend Report</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-3 block">Email Format</Label>
              <RadioGroup
                value={emailFormat}
                onValueChange={(value) => setEmailFormat(value as "html" | "excel")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="html" id="format-html" />
                  <Label htmlFor="format-html" className="cursor-pointer flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    HTML Email
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="format-excel" />
                  <Label htmlFor="format-excel" className="cursor-pointer flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Attachment
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-3 block">Select Recipients</Label>
            </div>
            {loadingRecipients ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recipients found</p>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {recipients.map(recipient => (
                    <div key={recipient.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`recipient-${recipient.id}`}
                        checked={selectedRecipients.includes(recipient.id)}
                        onCheckedChange={() => toggleRecipient(recipient.id)}
                      />
                      <div className="grid gap-0.5 leading-none">
                        <Label
                          htmlFor={`recipient-${recipient.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {recipient.full_name}
                        </Label>
                        <p className="text-xs text-muted-foreground">{recipient.email}</p>
                        {recipient.store_name && (
                          <p className="text-xs text-muted-foreground">{recipient.store_name}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={selectedRecipients.length === 0 || sendingEmail}
              className="gap-2"
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
