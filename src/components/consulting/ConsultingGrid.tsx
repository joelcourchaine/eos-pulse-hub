import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, addMonths, startOfMonth, addWeeks, getYear } from "date-fns";
import { Label } from "@/components/ui/label";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Phone, Plus, Trash2, CalendarIcon, CheckCircle, Clock, XCircle, Copy, Repeat, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getHolidayName, getHolidaysForYears } from "@/utils/canadianHolidays";

interface ConsultingGridProps {
  showAdhoc: boolean;
}

interface ConsultingClient {
  id: string;
  name: string;
  department_name: string | null;
  contact_names: string | null;
  call_value: number | null;
  is_adhoc: boolean | null;
  is_active: boolean | null;
}

interface ConsultingCall {
  id: string;
  client_id: string;
  call_date: string;
  call_time: string | null;
  status: string | null;
  notes: string | null;
  recurrence_group_id: string | null;
}

interface Store {
  id: string;
  name: string;
  brand: string | null;
}

interface Department {
  id: string;
  name: string;
  store_id: string;
}

// Each display row represents a single "slot" for calls across months
interface DisplayRow {
  rowId: string; // unique identifier for this row
  client: ConsultingClient;
  store_id: string | null;
  department_id: string | null;
  rowIndex: number; // 0 = first row for this client, 1 = second, etc.
  calls: Map<string, ConsultingCall | null>; // month key -> single call (or null)
}

export function ConsultingGrid({ showAdhoc }: ConsultingGridProps) {
  const queryClient = useQueryClient();
  const [newRow, setNewRow] = useState<{
    store_id: string | null;
    department_id: string | null;
    contact_names: string;
    call_value: number;
    is_adhoc: boolean;
    adhoc_name: string;
    adhoc_dept: string;
  } | null>(null);

  // Get 12 months starting from current month
  const months = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 12 }, (_, offset) => {
      const date = addMonths(startOfMonth(today), offset);
      return {
        key: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM'),
        shortLabel: format(date, 'MMM'),
        date,
      };
    });
  }, []);

  // Calculate today for the "Today" marker
  const today = new Date();
  const currentMonthKey = format(today, 'yyyy-MM');

  // Fetch stores
  const { data: stores } = useQuery({
    queryKey: ['all-stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, name, brand')
        .order('name');
      if (error) throw error;
      return data as Store[];
    },
  });

  // Fetch all departments
  const { data: allDepartments } = useQuery({
    queryKey: ['all-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, store_id')
        .order('name');
      if (error) throw error;
      return data as Department[];
    },
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ['consulting-clients', showAdhoc],
    queryFn: async () => {
      let query = supabase
        .from('consulting_clients')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!showAdhoc) {
        query = query.eq('is_adhoc', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConsultingClient[];
    },
  });

  // Fetch all calls for these months
  const { data: calls, isLoading } = useQuery({
    queryKey: ['consulting-calls', months[0]?.key, months[11]?.key],
    queryFn: async () => {
      const startDate = format(months[0].date, 'yyyy-MM-01');
      const endDate = format(addMonths(months[11].date, 1), 'yyyy-MM-01');

      const { data, error } = await supabase
        .from('consulting_calls')
        .select('*')
        .gte('call_date', startDate)
        .lt('call_date', endDate)
        .order('call_date');

      if (error) throw error;
      return data as ConsultingCall[];
    },
  });

  // Build display rows - each client gets N rows where N = max calls in any single month
  const displayRows = useMemo(() => {
    if (!clients) return [];

    const rows: DisplayRow[] = [];

    clients.forEach(client => {
      // Find matching store/department
      let store_id: string | null = null;
      let department_id: string | null = null;

      if (stores && allDepartments) {
        const store = stores.find(s => s.name === client.name);
        if (store) {
          store_id = store.id;
          if (client.department_name) {
            const dept = allDepartments.find(
              d => d.store_id === store.id && d.name === client.department_name
            );
            if (dept) department_id = dept.id;
          }
        }
      }

      // Group calls by month for this client
      const callsByMonth = new Map<string, ConsultingCall[]>();
      months.forEach(m => callsByMonth.set(m.key, []));

      if (calls) {
        calls
          .filter(c => c.client_id === client.id)
          .forEach(call => {
            const monthKey = call.call_date.substring(0, 7);
            if (callsByMonth.has(monthKey)) {
              callsByMonth.get(monthKey)!.push(call);
            }
          });
      }

      // Determine how many rows needed for this client (max calls in any month, minimum 1)
      let maxCallsInMonth = 1;
      callsByMonth.forEach(monthCalls => {
        if (monthCalls.length > maxCallsInMonth) {
          maxCallsInMonth = monthCalls.length;
        }
      });

      // Create rows for this client
      for (let rowIndex = 0; rowIndex < maxCallsInMonth; rowIndex++) {
        const rowCalls = new Map<string, ConsultingCall | null>();
        
        months.forEach(m => {
          const monthCalls = callsByMonth.get(m.key) || [];
          rowCalls.set(m.key, monthCalls[rowIndex] || null);
        });

        rows.push({
          rowId: `${client.id}-${rowIndex}`,
          client,
          store_id,
          department_id,
          rowIndex,
          calls: rowCalls,
        });
      }
    });

    // Sort rows by earliest call date/time (later dates appear lower)
    rows.sort((a, b) => {
      // Find the earliest call for each row
      const getEarliestCall = (row: DisplayRow): { date: string; time: string } | null => {
        let earliest: { date: string; time: string } | null = null;
        row.calls.forEach((call) => {
          if (call) {
            const callDateTime = { date: call.call_date, time: call.call_time || '00:00' };
            if (!earliest) {
              earliest = callDateTime;
            } else {
              const currentSort = `${callDateTime.date}T${callDateTime.time}`;
              const earliestSort = `${earliest.date}T${earliest.time}`;
              if (currentSort < earliestSort) {
                earliest = callDateTime;
              }
            }
          }
        });
        return earliest;
      };

      const earliestA = getEarliestCall(a);
      const earliestB = getEarliestCall(b);

      // Rows without calls go to the bottom
      if (!earliestA && !earliestB) {
        return a.client.name.localeCompare(b.client.name);
      }
      if (!earliestA) return 1;
      if (!earliestB) return -1;

      // Sort by date and time (earlier dates/times first, later ones lower in list)
      const sortKeyA = `${earliestA.date}T${earliestA.time}`;
      const sortKeyB = `${earliestB.date}T${earliestB.time}`;
      
      return sortKeyA.localeCompare(sortKeyB);
    });

    return rows;
  }, [clients, calls, stores, allDepartments, months]);

  // Find the next upcoming call in the current month (for the "next appointment" line)
  const nextUpcomingCallRowId = useMemo(() => {
    const now = new Date();
    let nextCall: { rowId: string; dateTime: Date } | null = null;

    for (const row of displayRows) {
      const call = row.calls.get(currentMonthKey);
      if (call && call.status !== 'completed' && call.status !== 'cancelled') {
        const callDate = parseISO(call.call_date);
        if (call.call_time) {
          const [hours, minutes] = call.call_time.split(':').map(Number);
          callDate.setHours(hours, minutes, 0, 0);
        } else {
          callDate.setHours(0, 0, 0, 0);
        }
        
        // Only consider future calls
        if (callDate >= now) {
          if (!nextCall || callDate < nextCall.dateTime) {
            nextCall = { rowId: row.rowId, dateTime: callDate };
          }
        }
      }
    }

    return nextCall?.rowId || null;
  }, [displayRows, currentMonthKey]);

  const handleAddRow = () => {
    setNewRow({
      store_id: null,
      department_id: null,
      contact_names: '',
      call_value: 0,
      is_adhoc: false,
      adhoc_name: '',
      adhoc_dept: '',
    });
  };

  const handleSaveNewRow = async (overrideStoreId?: string) => {
    if (!newRow) return;

    const storeId = overrideStoreId || newRow.store_id;

    if (!storeId && !newRow.adhoc_name) {
      toast.error("Please select a dealership or enter ad-hoc name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let clientName = newRow.adhoc_name;
      let deptName = newRow.adhoc_dept;

      if (storeId) {
        const store = stores?.find(s => s.id === storeId);
        clientName = store?.name || '';
      }
      if (newRow.department_id) {
        const dept = allDepartments?.find(d => d.id === newRow.department_id);
        deptName = dept?.name || '';
      }

      // Check if client already exists
      const { data: existingClient } = await supabase
        .from('consulting_clients')
        .select('id')
        .eq('name', clientName)
        .eq('department_name', deptName || '')
        .maybeSingle();

      if (existingClient) {
        toast.error("This dealership/department combination already exists");
        return;
      }

      const { error } = await supabase
        .from('consulting_clients')
        .insert({
          name: clientName,
          department_name: deptName || null,
          contact_names: newRow.contact_names || null,
          call_value: newRow.call_value || 0,
          is_adhoc: newRow.is_adhoc,
          created_by: user?.id,
        });

      if (error) throw error;

      toast.success("Client added");
      setNewRow(null);
      queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  };

  const handleUpdateClient = async (clientId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('consulting_clients')
        .update({ [field]: value })
        .eq('id', clientId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
    } catch (error: any) {
      toast.error("Failed to update");
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await supabase.from('consulting_calls').delete().eq('client_id', clientId);
      const { error } = await supabase.from('consulting_clients').delete().eq('id', clientId);
      if (error) throw error;
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
    } catch (error: any) {
      toast.error("Failed to delete");
    }
  };

  const handleCreateCall = async (
    clientId: string, 
    date: Date, 
    time?: string,
    recurrenceType?: 'weekly' | 'bi-weekly' | 'every-4-weeks' | 'monthly' | 'quarterly'
  ) => {
    try {
      if (recurrenceType) {
        // Calculate number of occurrences based on frequency
        let occurrences: number;
        let addInterval: (date: Date, count: number) => Date;
        let label: string;
        
        switch (recurrenceType) {
          case 'weekly':
            occurrences = 104; // ~2 years
            addInterval = (d, c) => addWeeks(d, c);
            label = 'Weekly';
            break;
          case 'bi-weekly':
            occurrences = 52; // ~2 years
            addInterval = (d, c) => addWeeks(d, c * 2);
            label = 'Bi-weekly';
            break;
          case 'every-4-weeks':
            occurrences = 26; // ~2 years
            addInterval = (d, c) => addWeeks(d, c * 4);
            label = 'Every 4 weeks';
            break;
          case 'monthly':
            occurrences = 24; // 2 years
            addInterval = (d, c) => addMonths(d, c);
            label = 'Monthly';
            break;
          case 'quarterly':
            occurrences = 8; // 2 years
            addInterval = (d, c) => addMonths(d, c * 3);
            label = 'Quarterly';
            break;
        }
        
        const recurrenceGroupId = crypto.randomUUID();
        
        const callsToInsert = [];
        for (let i = 0; i < occurrences; i++) {
          const callDate = addInterval(date, i);
          callsToInsert.push({
            client_id: clientId,
            call_date: format(callDate, 'yyyy-MM-dd'),
            call_time: time || null,
            status: 'scheduled',
            recurrence_group_id: recurrenceGroupId,
          });
        }
        
        const { error } = await supabase
          .from('consulting_calls')
          .insert(callsToInsert);

        if (error) throw error;
        toast.success(`${label} recurring calls scheduled`);
      } else {
        // Single call
        const { error } = await supabase
          .from('consulting_calls')
          .insert({
            client_id: clientId,
            call_date: format(date, 'yyyy-MM-dd'),
            call_time: time || null,
            status: 'scheduled',
          });

        if (error) throw error;
      }
      
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to create call");
    }
  };

  // Add a new row for this client (creates an empty call slot)
  const handleAddRowForClient = async (clientId: string) => {
    // We just need to create a call to trigger a new row
    // The new row will appear automatically when there's a call
    // For now, we'll create a placeholder call in the current month
    const today = new Date();
    await handleCreateCall(clientId, today);
    toast.success("New row added");
  };

  const handleUpdateCall = async (callId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .update({ [field]: value })
        .eq('id', callId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to update");
    }
  };

  const handleDeleteCall = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .delete()
        .eq('id', callId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteRecurringSeries = async (recurrenceGroupId: string, keepCallId?: string) => {
    try {
      let query = supabase
        .from('consulting_calls')
        .delete()
        .eq('recurrence_group_id', recurrenceGroupId);
      
      // If keepCallId is provided, exclude that call from deletion
      if (keepCallId) {
        query = query.neq('id', keepCallId);
      }

      const { error } = await query;

      if (error) throw error;
      
      // If we kept a call, also clear its recurrence_group_id
      if (keepCallId) {
        await supabase
          .from('consulting_calls')
          .update({ recurrence_group_id: null })
          .eq('id', keepCallId);
        toast.success("Recurring series removed, original call kept");
      } else {
        toast.success("Recurring series deleted");
      }
      
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to delete series");
    }
  };

  const handleCancelRecurringSeries = async (recurrenceGroupId: string) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .update({ status: 'cancelled' })
        .eq('recurrence_group_id', recurrenceGroupId)
        .eq('status', 'scheduled');

      if (error) throw error;
      toast.success("Recurring series cancelled");
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to cancel series");
    }
  };

  const handleDeleteRow = async (row: DisplayRow) => {
    const callIds: string[] = [];
    row.calls.forEach((call) => {
      if (call) callIds.push(call.id);
    });
    
    if (callIds.length === 0) {
      toast.info("No calls to delete in this row");
      return;
    }
    
    const { error } = await supabase
      .from('consulting_calls')
      .delete()
      .in('id', callIds);
      
    if (error) {
      toast.error('Failed to delete row calls');
      return;
    }
    
    toast.success(`Deleted ${callIds.length} call(s) from this row`);
    queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
    queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddRow} disabled={!!newRow}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 h-8">
                <TableHead className="w-[280px] min-w-[280px] sticky left-0 bg-muted/50 z-10 py-1 text-xs">Dealership</TableHead>
                <TableHead className="w-[120px] py-1 text-xs">Department</TableHead>
                <TableHead className="w-[120px] py-1 text-xs">Contact</TableHead>
                <TableHead className="w-[80px] text-right py-1 text-xs">Value</TableHead>
                {months.map(m => {
                  const isCurrentMonth = m.key === currentMonthKey;
                  return (
                    <TableHead 
                      key={m.key} 
                      className={cn(
                        "w-[130px] text-center min-w-[130px] py-1 text-xs",
                        isCurrentMonth && "bg-destructive/10"
                      )}
                    >
                      <span className={cn(isCurrentMonth && "font-semibold text-destructive")}>
                        {m.label}
                      </span>
                    </TableHead>
                  );
                })}
                <TableHead className="w-[50px] py-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* New row */}
              {newRow && (
                <NewClientRow
                  row={newRow}
                  setRow={setNewRow}
                  stores={stores || []}
                  allDepartments={allDepartments || []}
                  months={months}
                  onSaveWithStoreId={handleSaveNewRow}
                  onCancel={() => setNewRow(null)}
                />
              )}

              {/* Existing rows */}
              {displayRows.map((row) => (
                <DisplayRowComponent
                  key={row.rowId}
                  row={row}
                  stores={stores || []}
                  allDepartments={allDepartments || []}
                  months={months}
                  currentMonthKey={currentMonthKey}
                  isNextUpcoming={row.rowId === nextUpcomingCallRowId}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                  onCreateCall={handleCreateCall}
                  onAddRowForClient={handleAddRowForClient}
                  onUpdateCall={handleUpdateCall}
                  onDeleteCall={handleDeleteCall}
                  onDeleteRecurringSeries={handleDeleteRecurringSeries}
                  onCancelRecurringSeries={handleCancelRecurringSeries}
                  onDeleteRow={handleDeleteRow}
                />
              ))}

              {!displayRows.length && !newRow && (
                <TableRow>
                  <TableCell colSpan={5 + months.length} className="text-center py-12">
                    <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">No clients yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Add Client" to add your first consulting client
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

// Display row component
function DisplayRowComponent({
  row,
  stores,
  allDepartments,
  months,
  currentMonthKey,
  isNextUpcoming,
  onUpdateClient,
  onDeleteClient,
  onCreateCall,
  onAddRowForClient,
  onUpdateCall,
  onDeleteCall,
  onDeleteRecurringSeries,
  onCancelRecurringSeries,
  onDeleteRow,
}: {
  row: DisplayRow;
  stores: Store[];
  allDepartments: Department[];
  months: { key: string; label: string; shortLabel: string; date: Date }[];
  currentMonthKey: string;
  isNextUpcoming: boolean;
  onUpdateClient: (id: string, field: string, value: any) => void;
  onDeleteClient: (id: string) => void;
  onCreateCall: (clientId: string, date: Date, time?: string, recurrenceType?: 'weekly' | 'bi-weekly' | 'every-4-weeks' | 'monthly' | 'quarterly') => void;
  onAddRowForClient: (clientId: string) => void;
  onUpdateCall: (callId: string, field: string, value: any) => void;
  onDeleteCall: (callId: string) => void;
  onDeleteRecurringSeries: (recurrenceGroupId: string, keepCallId?: string) => void;
  onCancelRecurringSeries: (recurrenceGroupId: string) => void;
  onDeleteRow: (row: DisplayRow) => void;
}) {
  const [editingValue, setEditingValue] = useState(false);
  const [tempValue, setTempValue] = useState(row.client.call_value?.toString() || '0');
  const [editingContact, setEditingContact] = useState(false);
  const [tempContact, setTempContact] = useState(row.client.contact_names || '');

  const currentDepts = row.store_id 
    ? allDepartments.filter(d => d.store_id === row.store_id) 
    : [];

  const handleDealershipChange = async (storeId: string) => {
    const store = stores.find(s => s.id === storeId);
    if (store) {
      await onUpdateClient(row.client.id, 'name', store.name);
      await onUpdateClient(row.client.id, 'department_name', null);
    }
  };

  const handleDepartmentChange = async (deptId: string) => {
    const dept = allDepartments.find(d => d.id === deptId);
    if (dept) {
      await onUpdateClient(row.client.id, 'department_name', dept.name);
    }
  };

  const handleSaveValue = () => {
    const val = parseFloat(tempValue) || 0;
    onUpdateClient(row.client.id, 'call_value', val);
    setEditingValue(false);
  };

  const handleSaveContact = () => {
    onUpdateClient(row.client.id, 'contact_names', tempContact || null);
    setEditingContact(false);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow className={cn(
          "h-8",
          row.client.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20"
        )}>
          {/* Dealership */}
          <TableCell className="sticky left-0 bg-background z-10 py-0.5">
            {row.client.is_adhoc ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.client.name}</span>
                <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50">
                  Ad-Hoc
                </Badge>
              </div>
            ) : (
              <Select value={row.store_id || ''} onValueChange={handleDealershipChange}>
                <SelectTrigger className="h-6 border-0 shadow-none hover:bg-muted/50 text-xs">
                  <SelectValue placeholder="Select dealership" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TableCell>

          {/* Department */}
          <TableCell className="py-0.5">
            {row.client.is_adhoc ? (
              <span className="text-sm text-muted-foreground">{row.client.department_name || '—'}</span>
            ) : (
              <Select 
                value={row.department_id || ''} 
                onValueChange={handleDepartmentChange}
                disabled={!row.store_id}
              >
                <SelectTrigger className="h-6 border-0 shadow-none hover:bg-muted/50 text-xs">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {currentDepts.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </TableCell>

          {/* Contact */}
          <TableCell className="py-0.5">
            {editingContact ? (
              <Input
                value={tempContact}
                onChange={(e) => setTempContact(e.target.value)}
                onBlur={handleSaveContact}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveContact()}
                autoFocus
                className="h-6 text-xs"
              />
            ) : (
              <span 
                className="cursor-text hover:bg-muted/50 px-1 py-0.5 rounded -mx-1 block truncate text-xs"
                onClick={() => {
                  setTempContact(row.client.contact_names || '');
                  setEditingContact(true);
                }}
              >
                {row.client.contact_names || <span className="text-muted-foreground">—</span>}
              </span>
            )}
          </TableCell>

          {/* Value */}
          <TableCell className="text-right py-0.5">
            {editingValue ? (
              <Input
                type="number"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSaveValue}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveValue()}
                autoFocus
                className="h-6 w-14 text-right ml-auto text-xs"
              />
            ) : (
              <span 
                className="cursor-text hover:bg-muted/50 px-1 py-0.5 rounded font-medium text-xs"
                onClick={() => {
                  setTempValue(row.client.call_value?.toString() || '0');
                  setEditingValue(true);
                }}
              >
                ${row.client.call_value?.toFixed(0) || '0'}
              </span>
            )}
          </TableCell>

          {/* Month columns */}
          {months.map(month => (
            <MonthCell
              key={month.key}
              clientId={row.client.id}
              monthKey={month.key}
              monthDate={month.date}
              call={row.calls.get(month.key) || null}
              isCurrentMonth={month.key === currentMonthKey}
              showNextLine={isNextUpcoming && month.key === currentMonthKey}
              onCreateCall={onCreateCall}
              onUpdateCall={onUpdateCall}
              onDeleteCall={onDeleteCall}
              onDeleteRecurringSeries={onDeleteRecurringSeries}
              onCancelRecurringSeries={onCancelRecurringSeries}
            />
          ))}

          {/* Delete */}
          <TableCell className="py-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteClient(row.client.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onAddRowForClient(row.client.id)}>
          <Copy className="h-4 w-4 mr-2" />
          Add Another Row
        </ContextMenuItem>
        <ContextMenuSeparator />
        {(() => {
          let callCount = 0;
          row.calls.forEach((call) => { if (call) callCount++; });
          return (
            <ContextMenuItem 
              className="text-destructive"
              onClick={() => onDeleteRow(row)}
              disabled={callCount === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Row ({callCount} calls)
            </ContextMenuItem>
          );
        })()}
        <ContextMenuItem 
          className="text-destructive"
          onClick={() => onDeleteClient(row.client.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Client
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Month cell component
function MonthCell({
  clientId,
  monthKey,
  monthDate,
  call,
  isCurrentMonth,
  showNextLine,
  onCreateCall,
  onUpdateCall,
  onDeleteCall,
  onDeleteRecurringSeries,
  onCancelRecurringSeries,
}: {
  clientId: string;
  monthKey: string;
  monthDate: Date;
  call: ConsultingCall | null;
  isCurrentMonth: boolean;
  showNextLine: boolean;
  onCreateCall: (clientId: string, date: Date, time?: string, recurrenceType?: 'weekly' | 'bi-weekly' | 'every-4-weeks' | 'monthly' | 'quarterly') => void;
  onUpdateCall: (callId: string, field: string, value: any) => void;
  onDeleteCall: (callId: string) => void;
  onDeleteRecurringSeries: (recurrenceGroupId: string, keepCallId?: string) => void;
  onCancelRecurringSeries: (recurrenceGroupId: string) => void;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    call?.call_date ? parseISO(call.call_date) : undefined
  );
  const [time, setTime] = useState(call?.call_time?.slice(0, 5) || '');
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'bi-weekly' | 'every-4-weeks' | 'monthly' | 'quarterly' | 'none'>('none');

  // Sync local state when call prop changes (e.g., after individual edit)
  useEffect(() => {
    setSelectedDate(call?.call_date ? parseISO(call.call_date) : undefined);
    setTime(call?.call_time?.slice(0, 5) || '');
  }, [call?.call_date, call?.call_time]);

  // Get holidays for calendar display (current year +/- 1)
  const currentYear = getYear(new Date());
  const holidayMap = useMemo(() => getHolidaysForYears(currentYear - 1, currentYear + 2), [currentYear]);

  // Check if call date is a holiday
  const holidayName = call?.call_date ? getHolidayName(call.call_date) : null;
  const isHolidayCall = !!holidayName;

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);

    if (call) {
      onUpdateCall(call.id, 'call_date', format(date, 'yyyy-MM-dd'));
      setDateOpen(false);
    }
    // For new calls, don't auto-close - let user set recurrence first
  };

  const handleCreateNewCall = () => {
    if (!selectedDate) return;
    onCreateCall(clientId, selectedDate, time || undefined, recurrenceType !== 'none' ? recurrenceType : undefined);
    setDateOpen(false);
    // Reset for next time
    setRecurrenceType('none');
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (call) {
      onUpdateCall(call.id, 'call_time', newTime || null);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (call) {
      onUpdateCall(call.id, 'status', newStatus);
      toast.success(`Marked as ${newStatus}`);
    }
  };

  const displayText = call
    ? `${format(parseISO(call.call_date), 'EEE MMM d')}${call.call_time ? ` ${call.call_time.slice(0, 5)}` : ''}`
    : null;

  // Check if the call date/time is in the past
  const isCallInPast = call ? (() => {
    const callDate = parseISO(call.call_date);
    if (call.call_time) {
      const [hours, minutes] = call.call_time.split(':').map(Number);
      callDate.setHours(hours, minutes, 0, 0);
    } else {
      // If no time specified, consider it past if the whole day is past
      callDate.setHours(23, 59, 59, 999);
    }
    return callDate < new Date();
  })() : false;

  // Calendar modifiers for holidays
  const holidayModifier = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return holidayMap.has(dateStr);
  };

  const buttonContent = (
    <Button
      variant="ghost"
      className={cn(
        "h-6 justify-start text-left font-normal px-1.5 w-full text-xs",
        "hover:bg-muted/50",
        !call && "text-muted-foreground",
        isHolidayCall && "bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"
      )}
    >
      <div className="flex items-center gap-1 w-full">
        {/* Left side - always aligned */}
        {call && (
          <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusColor(call.status))} />
        )}
        <CalendarIcon className={cn("h-3 w-3 shrink-0", isCallInPast && "opacity-50")} />
        <span className={cn("truncate", isCallInPast && "opacity-50")}>
          {displayText || "Date / Time"}
        </span>
        
        {/* Right side - recurring and holiday indicators */}
        <div className="flex items-center gap-0.5 ml-auto shrink-0">
          {call?.recurrence_group_id && (
            <Repeat className="h-3 w-3 text-muted-foreground" />
          )}
          {isHolidayCall && (
            <span className="text-amber-600 dark:text-amber-400" title={holidayName!}>🍁</span>
          )}
        </div>
      </div>
    </Button>
  );

  return (
    <TableCell className={cn("text-center py-0.5 relative", isCurrentMonth && "bg-destructive/5")}>
      {/* "Next appointment" line - only shown on the row with the next upcoming call */}
      {showNextLine && (
        <div className="absolute left-0 right-0 top-0 h-0.5 bg-destructive z-10 pointer-events-none" />
      )}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <ContextMenu>
          <ContextMenuTrigger disabled={!call} asChild>
            <PopoverTrigger asChild>
              {isHolidayCall ? (
                <span className="block">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        {buttonContent}
                      </TooltipTrigger>
                      <TooltipContent className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="font-medium text-amber-800 dark:text-amber-200">{holidayName}</span>
                        <span className="text-amber-600 dark:text-amber-400 text-xs">- Consider rescheduling</span>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </span>
              ) : (
                buttonContent
              )}
            </PopoverTrigger>
          </ContextMenuTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                defaultMonth={monthDate}
                initialFocus
                className="p-3 pointer-events-auto"
                modifiers={{
                  holiday: holidayModifier
                }}
                modifiersStyles={{
                  holiday: {
                    backgroundColor: 'rgb(254 243 199)',
                    color: 'rgb(180 83 9)',
                    fontWeight: 'bold'
                  }
                }}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const holiday = holidayMap.get(dateStr);
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full h-full flex items-center justify-center">
                              {date.getDate()}
                            </span>
                          </TooltipTrigger>
                          {holiday && (
                            <TooltipContent side="top" className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                              <div className="flex items-center gap-2">
                                <span>🍁</span>
                                <span className="font-medium text-amber-800 dark:text-amber-200">{holiday}</span>
                              </div>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }
                }}
              />
              <div className="p-3 border-t">
                <Label className="text-sm font-medium">Time (optional)</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => handleTimeChange(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              {/* Recurrence options - only for new calls */}
              {!call && selectedDate && (
                <div className="p-3 border-t space-y-3">
                  {/* Show holiday warning if selected date is a holiday */}
                  {(() => {
                    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                    const selectedHoliday = holidayMap.get(selectedDateStr);
                    if (selectedHoliday) {
                      return (
                        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/50 rounded-md border border-amber-200 dark:border-amber-800">
                          <span>🍁</span>
                          <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">{selectedHoliday}</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Repeat className="h-3 w-3" />
                      Recurrence
                    </Label>
                    <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as typeof recurrenceType)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="No recurrence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No recurrence</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                        <SelectItem value="every-4-weeks">Every 4 weeks</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={handleCreateNewCall}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {recurrenceType !== 'none' ? 'Create Recurring Calls' : 'Schedule Call'}
                  </Button>
                </div>
              )}
              
              {call && (
                <div className="p-3 border-t space-y-3">
                  {/* Show holiday warning if this call is on a holiday */}
                  {isHolidayCall && (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/50 rounded-md border border-amber-200 dark:border-amber-800">
                      <span>🍁</span>
                      <span className="text-sm text-amber-800 dark:text-amber-200 font-medium">{holidayName}</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">- Consider rescheduling</span>
                    </div>
                  )}
                  
                  {call.recurrence_group_id ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium flex items-center gap-2">
                          <Repeat className="h-3 w-3" />
                          Recurring call
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Keep this call but remove all others in the series
                            onDeleteRecurringSeries(call.recurrence_group_id!, call.id);
                            setDateOpen(false);
                          }}
                        >
                          Stop recurring
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Repeat className="h-3 w-3" />
                        Make recurring
                      </Label>
                      <Select 
                        value="none" 
                        onValueChange={(v) => {
                          if (v !== 'none') {
                            const callDate = parseISO(call.call_date);
                            onDeleteCall(call.id);
                            onCreateCall(clientId, callDate, call.call_time || undefined, v as 'weekly' | 'bi-weekly' | 'every-4-weeks' | 'monthly' | 'quarterly');
                            setDateOpen(false);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not recurring</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                          <SelectItem value="every-4-weeks">Every 4 weeks</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onDeleteCall(call.id);
                      setDateOpen(false);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Remove Call
                  </Button>
                </div>
              )}
            </PopoverContent>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleStatusChange('scheduled')}>
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              Mark as Scheduled
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleStatusChange('completed')}>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Mark as Completed
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleStatusChange('cancelled')}>
              <XCircle className="h-4 w-4 mr-2 text-red-500" />
              Mark as Cancelled
            </ContextMenuItem>
            {call?.recurrence_group_id && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem 
                  onClick={() => onCancelRecurringSeries(call.recurrence_group_id!)}
                  className="text-amber-600"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel All in Series
                </ContextMenuItem>
                <ContextMenuItem 
                  onClick={() => onDeleteRecurringSeries(call.recurrence_group_id!)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All in Series
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </Popover>
    </TableCell>
  );
}

// New client row
function NewClientRow({
  row,
  setRow,
  stores,
  allDepartments,
  months,
  onSaveWithStoreId,
  onCancel,
}: {
  row: {
    store_id: string | null;
    department_id: string | null;
    contact_names: string;
    call_value: number;
    is_adhoc: boolean;
    adhoc_name: string;
    adhoc_dept: string;
  };
  setRow: (row: any) => void;
  stores: Store[];
  allDepartments: Department[];
  months: { key: string; label: string; shortLabel: string; date: Date }[];
  onSaveWithStoreId: (storeId?: string) => void;
  onCancel: () => void;
}) {
  const handleStoreChange = (storeId: string) => {
    if (storeId === 'adhoc') {
      setRow({ ...row, store_id: null, department_id: null, is_adhoc: true });
    } else {
      // Auto-save when a dealership is selected
      onSaveWithStoreId(storeId);
    }
  };

  const currentDepts = row.store_id 
    ? allDepartments.filter(d => d.store_id === row.store_id) 
    : [];

  return (
    <TableRow className="bg-primary/5">
      {/* Dealership */}
      <TableCell className="sticky left-0 bg-primary/5 z-10">
        {row.is_adhoc ? (
          <div className="flex items-center gap-2">
            <Input
              value={row.adhoc_name}
              onChange={(e) => setRow({ ...row, adhoc_name: e.target.value })}
              onBlur={() => {
                if (row.adhoc_name.trim()) {
                  onSaveWithStoreId();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && row.adhoc_name.trim()) {
                  onSaveWithStoreId();
                }
              }}
              placeholder="Ad-hoc name"
              className="h-8"
              autoFocus
            />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setRow({ ...row, is_adhoc: false, store_id: null })}
            >
              ×
            </Button>
          </div>
        ) : (
          <Select value={row.store_id || ''} onValueChange={handleStoreChange}>
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select dealership" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adhoc">
                <span className="text-amber-600">+ Ad-Hoc Client</span>
              </SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Department */}
      <TableCell>
        {row.is_adhoc ? (
          <Input
            value={row.adhoc_dept}
            onChange={(e) => setRow({ ...row, adhoc_dept: e.target.value })}
            placeholder="Category"
            className="h-8"
          />
        ) : (
          <Select 
            value={row.department_id || ''} 
            onValueChange={(v) => setRow({ ...row, department_id: v })}
            disabled={!row.store_id}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {currentDepts.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </TableCell>

      {/* Contact */}
      <TableCell>
        <Input
          value={row.contact_names}
          onChange={(e) => setRow({ ...row, contact_names: e.target.value })}
          placeholder="Contact"
          className="h-8"
        />
      </TableCell>

      {/* Value */}
      <TableCell>
        <Input
          type="number"
          value={row.call_value || ''}
          onChange={(e) => setRow({ ...row, call_value: parseFloat(e.target.value) || 0 })}
          placeholder="0"
          className="h-8 w-16 text-right"
        />
      </TableCell>

      {/* Empty month columns */}
      {months.map(m => (
        <TableCell key={m.key} className="text-center text-muted-foreground text-sm">
          —
        </TableCell>
      ))}

      {/* Actions */}
      <TableCell>
        <div className="flex items-center gap-1">
          {row.is_adhoc && (
            <Button size="sm" className="h-7 px-2" onClick={() => onSaveWithStoreId()}>
              Save
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}>
            ×
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
