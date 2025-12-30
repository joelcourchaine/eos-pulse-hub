import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Mail, Loader2, FileSpreadsheet } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, subMonths } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { DataCoverageBadge } from "./DataCoverageBadge";

interface KPITrendViewProps {
  storeIds: string[];
  selectedDepartmentNames: string[];
  selectedMetrics: string[];
  startMonth: string;
  endMonth: string;
  brandDisplayName: string;
  filterName: string;
  onBack: () => void;
}

export function KPITrendView({
  storeIds,
  selectedDepartmentNames,
  selectedMetrics,
  startMonth,
  endMonth,
  brandDisplayName,
  filterName,
  onBack,
}: KPITrendViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFormat, setEmailFormat] = useState<"html" | "excel">("html");

  // Fetch recipients (super_admins and store GMs)
  const { data: recipients = [], isLoading: loadingRecipients } = useQuery({
    queryKey: ["kpi_trend_recipients", storeIds],
    queryFn: async () => {
      const { data: superAdminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const superAdminIds = superAdminRoles?.map(r => r.user_id) || [];

      const { data: gmRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "store_gm");
      const gmIds = gmRoles?.map(r => r.user_id) || [];

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
    queryKey: ["kpi_trend_stores", storeIds],
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

  // Fetch departments for stores
  const { data: departments } = useQuery({
    queryKey: ["kpi_trend_departments", storeIds, selectedDepartmentNames],
    queryFn: async () => {
      if (storeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, store_id")
        .in("store_id", storeIds);
      if (error) throw error;
      
      // Filter by selected department names if specified
      if (selectedDepartmentNames.length > 0) {
        return data?.filter(d => selectedDepartmentNames.includes(d.name)) || [];
      }
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const departmentIds = useMemo(() => {
    return departments?.map(d => d.id) || [];
  }, [departments]);

  // Fetch KPI definitions
  const { data: kpiDefinitions } = useQuery({
    queryKey: ["kpi_trend_definitions", departmentIds],
    queryFn: async () => {
      if (departmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("kpi_definitions")
        .select("*, departments(id, name, store_id)")
        .in("department_id", departmentIds);
      if (error) throw error;
      return data || [];
    },
    enabled: departmentIds.length > 0,
  });

  const kpiIds = useMemo(() => {
    return kpiDefinitions?.map(k => k.id) || [];
  }, [kpiDefinitions]);

  // Fetch scorecard entries for the date range
  const { data: scorecardEntries, isLoading } = useQuery({
    queryKey: ["kpi_trend_entries", kpiIds, startMonth, endMonth],
    queryFn: async () => {
      if (kpiIds.length === 0) return [];
      const { data, error } = await supabase
        .from("scorecard_entries")
        .select("*")
        .in("kpi_id", kpiIds)
        .eq("entry_type", "monthly")
        .gte("month", startMonth)
        .lte("month", endMonth);
      if (error) throw error;
      return data || [];
    },
    enabled: kpiIds.length > 0,
  });

  // Process data: aggregate by store and month
  const processedData = useMemo(() => {
    if (!scorecardEntries || !stores || !departments || !kpiDefinitions) return {};
    
    // Build mapping from KPI id to department and store
    const kpiToStore = new Map<string, string>();
    const kpiToName = new Map<string, string>();
    const kpiToDept = new Map<string, string>();
    
    kpiDefinitions.forEach(kpi => {
      const dept = departments.find(d => d.id === kpi.department_id);
      if (dept) {
        kpiToStore.set(kpi.id, dept.store_id);
        kpiToDept.set(kpi.id, dept.name);
      }
      kpiToName.set(kpi.id, kpi.name);
    });

    // Group entries by store and month
    const storeMonthData: Record<string, Record<string, Map<string, number | null>>> = {};
    
    stores.forEach(store => {
      storeMonthData[store.id] = {};
      months.forEach(month => {
        storeMonthData[store.id][month] = new Map();
      });
    });

    // Aggregate entries
    scorecardEntries.forEach(entry => {
      const storeId = kpiToStore.get(entry.kpi_id);
      const kpiName = kpiToName.get(entry.kpi_id);
      if (!storeId || !kpiName || !storeMonthData[storeId]) return;
      
      const month = entry.month;
      if (!month || !storeMonthData[storeId][month]) return;
      
      // Use the actual value or null
      storeMonthData[storeId][month].set(kpiName, entry.actual_value);
    });

    // Build final data structure
    const result: Record<string, Record<string, Record<string, number | null>>> = {};
    
    stores.forEach(store => {
      result[store.id] = {
        storeName: store.name,
      } as any;
      
      selectedMetrics.forEach(metricName => {
        result[store.id][metricName] = {};
        months.forEach(month => {
          const value = storeMonthData[store.id][month].get(metricName);
          result[store.id][metricName][month] = value !== undefined ? value : null;
        });
      });
    });

    return result;
  }, [scorecardEntries, stores, departments, kpiDefinitions, months, selectedMetrics]);

  // Get KPI types for formatting
  const kpiTypeMap = useMemo(() => {
    const map = new Map<string, string>();
    kpiDefinitions?.forEach(kpi => {
      map.set(kpi.name, kpi.metric_type);
    });
    return map;
  }, [kpiDefinitions]);

  const formatValue = (value: number | null, metricName: string) => {
    if (value === null || value === undefined) return "-";

    const metricType = kpiTypeMap.get(metricName);

    if (metricType === "percentage") {
      return `${value.toFixed(1)}%`;
    }

    // KPI definitions use metric_type values like "dollar" | "unit" | "percentage"
    if (metricType === "dollar" || metricType === "currency") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }

    if (metricType === "unit") {
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0,
      }).format(value);
    }

    // Default: number format
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatMonthHeader = (month: string) => {
    return format(new Date(month + '-15'), 'MMM yy');
  };

  const handlePrint = () => {
    window.print();
  };

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

      const { data, error } = await supabase.functions.invoke("send-kpi-trend-email", {
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
          kpiTypeMap: Object.fromEntries(kpiTypeMap),
          departmentNames: selectedDepartmentNames,
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
              {filterName || "Monthly KPI Trend Report"}
            </h2>
            <p className="text-muted-foreground">
              <span className="font-medium">{brandDisplayName}</span>
              {" • "}{selectedDepartmentNames.join(", ")}
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
              {filterName || "Monthly KPI Trend Report"}
            </h1>
            <p className="text-sm text-gray-600">
              {brandDisplayName} • {selectedDepartmentNames.join(", ")} • {format(new Date(startMonth + '-15'), 'MMM yyyy')} to {format(new Date(endMonth + '-15'), 'MMM yyyy')}
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
                  There are no KPI entries for the selected stores and date range.
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
                      <span>{store.name} {selectedDepartmentNames.length > 0 && `- ${selectedDepartmentNames.join(", ")}`}</span>
                      <DataCoverageBadge monthsWithData={monthsWithData} totalMonths={months.length} />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="print:p-2">
                    <div className="overflow-x-auto">
                      <Table className="print:text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="sticky left-0 bg-background z-10 min-w-[180px] print:bg-gray-100 print:font-bold">
                              KPI
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
                            const metricType = kpiTypeMap.get(metricName);
                            const isPercentage = metricType === "percentage";
                            
                            // Calculate total/average for the metric
                            const values = months
                              .map(month => metricData?.[month])
                              .filter((v): v is number => v !== null && v !== undefined);
                            
                            // Use average for percentages, sum for everything else
                            const total = values.length > 0
                              ? isPercentage
                                ? values.reduce((sum, v) => sum + v, 0) / values.length
                                : values.reduce((sum, v) => sum + v, 0)
                              : null;
                            
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
                                <TableCell className="text-center font-bold bg-primary/10 print:bg-gray-100">
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
            <DialogTitle>Email KPI Trend Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Format</Label>
              <RadioGroup
                value={emailFormat}
                onValueChange={(v) => setEmailFormat(v as "html" | "excel")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="html" id="html" />
                  <Label htmlFor="html" className="cursor-pointer">HTML Email</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="excel" />
                  <Label htmlFor="excel" className="cursor-pointer flex items-center gap-1">
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel Attachment
                  </Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">Select Recipients</Label>
              <ScrollArea className="h-[200px] border rounded-md p-2">
                {loadingRecipients ? (
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ) : recipients.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No recipients available</p>
                ) : (
                  <div className="space-y-2">
                    {recipients.map(recipient => (
                      <div key={recipient.id} className="flex items-center space-x-2 p-1">
                        <Checkbox
                          id={`recipient-${recipient.id}`}
                          checked={selectedRecipients.includes(recipient.id)}
                          onCheckedChange={() => toggleRecipient(recipient.id)}
                        />
                        <label
                          htmlFor={`recipient-${recipient.id}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          <span className="font-medium">{recipient.full_name}</span>
                          <span className="text-muted-foreground ml-2">({recipient.email})</span>
                          {recipient.store_name && (
                            <span className="text-xs text-muted-foreground ml-1">- {recipient.store_name}</span>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmail} 
              disabled={sendingEmail || selectedRecipients.length === 0}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
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
          @page {
            size: landscape;
            margin: 0.5in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          table {
            font-size: 10px !important;
          }
          th, td {
            padding: 4px 6px !important;
          }
        }
      `}</style>
    </>
  );
}
