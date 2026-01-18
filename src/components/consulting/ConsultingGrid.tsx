import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO, addMonths, startOfMonth } from "date-fns";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from "@/components/ui/context-menu";
import { Phone, Plus, Trash2, CalendarIcon, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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

interface ClientRow {
  client: ConsultingClient;
  store_id: string | null;
  department_id: string | null;
  calls: Map<string, ConsultingCall[]>; // month key -> array of calls
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

  // Build client rows with calls mapped to months (supporting multiple calls per month)
  const clientRows = useMemo(() => {
    if (!clients) return [];

    const rows: ClientRow[] = clients.map(client => {
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

      // Map calls to months (array per month for multiple calls)
      const callsMap = new Map<string, ConsultingCall[]>();
      months.forEach(m => callsMap.set(m.key, []));

      if (calls) {
        calls
          .filter(c => c.client_id === client.id)
          .forEach(call => {
            const monthKey = call.call_date.substring(0, 7);
            if (callsMap.has(monthKey)) {
              callsMap.get(monthKey)!.push(call);
            }
          });
      }

      return { client, store_id, department_id, calls: callsMap };
    });

    return rows;
  }, [clients, calls, stores, allDepartments, months]);

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

  const handleSaveNewRow = async () => {
    if (!newRow) return;

    if (!newRow.store_id && !newRow.adhoc_name) {
      toast.error("Please select a dealership or enter ad-hoc name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      let clientName = newRow.adhoc_name;
      let deptName = newRow.adhoc_dept;

      if (newRow.store_id) {
        const store = stores?.find(s => s.id === newRow.store_id);
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
        .single();

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
      // First delete all calls
      await supabase
        .from('consulting_calls')
        .delete()
        .eq('client_id', clientId);

      const { error } = await supabase
        .from('consulting_clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      toast.success("Client deleted");
      queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
    } catch (error: any) {
      toast.error("Failed to delete");
    }
  };

  const handleCreateCall = async (clientId: string, monthKey: string, date: Date, time?: string) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .insert({
          client_id: clientId,
          call_date: format(date, 'yyyy-MM-dd'),
          call_time: time || null,
          status: 'scheduled',
        });

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to create call");
    }
  };

  const handleAddCallToMonth = async (clientId: string, monthDate: Date) => {
    // Add a call on the 15th of the month by default
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), 15);
    await handleCreateCall(clientId, format(date, 'yyyy-MM'), date);
    toast.success("Call added");
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
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px] sticky left-0 bg-muted/50 z-10">Dealership</TableHead>
                <TableHead className="w-[120px]">Department</TableHead>
                <TableHead className="w-[120px]">Contact</TableHead>
                <TableHead className="w-[80px] text-right">Value</TableHead>
                {months.map(m => (
                  <TableHead key={m.key} className="w-[130px] text-center min-w-[130px]">
                    {m.label}
                  </TableHead>
                ))}
                <TableHead className="w-[50px]"></TableHead>
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
                  onSave={handleSaveNewRow}
                  onCancel={() => setNewRow(null)}
                />
              )}

              {/* Existing clients */}
              {clientRows.map((row) => (
                <ClientRowComponent
                  key={row.client.id}
                  row={row}
                  stores={stores || []}
                  allDepartments={allDepartments || []}
                  months={months}
                  onUpdateClient={handleUpdateClient}
                  onDeleteClient={handleDeleteClient}
                  onCreateCall={handleCreateCall}
                  onAddCallToMonth={handleAddCallToMonth}
                  onUpdateCall={handleUpdateCall}
                  onDeleteCall={handleDeleteCall}
                />
              ))}

              {!clientRows.length && !newRow && (
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

// Client row component with right-click to add calls
function ClientRowComponent({
  row,
  stores,
  allDepartments,
  months,
  onUpdateClient,
  onDeleteClient,
  onCreateCall,
  onAddCallToMonth,
  onUpdateCall,
  onDeleteCall,
}: {
  row: ClientRow;
  stores: Store[];
  allDepartments: Department[];
  months: { key: string; label: string; shortLabel: string; date: Date }[];
  onUpdateClient: (id: string, field: string, value: any) => void;
  onDeleteClient: (id: string) => void;
  onCreateCall: (clientId: string, monthKey: string, date: Date, time?: string) => void;
  onAddCallToMonth: (clientId: string, monthDate: Date) => void;
  onUpdateCall: (callId: string, field: string, value: any) => void;
  onDeleteCall: (callId: string) => void;
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
        <TableRow className={cn(row.client.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20")}>
          {/* Dealership */}
          <TableCell className="sticky left-0 bg-background z-10">
            {row.client.is_adhoc ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{row.client.name}</span>
                <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50">
                  Ad-Hoc
                </Badge>
              </div>
            ) : (
              <Select value={row.store_id || ''} onValueChange={handleDealershipChange}>
                <SelectTrigger className="h-8 border-0 shadow-none hover:bg-muted/50">
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
          <TableCell>
            {row.client.is_adhoc ? (
              <span className="text-sm text-muted-foreground">{row.client.department_name || '—'}</span>
            ) : (
              <Select 
                value={row.department_id || ''} 
                onValueChange={handleDepartmentChange}
                disabled={!row.store_id}
              >
                <SelectTrigger className="h-8 border-0 shadow-none hover:bg-muted/50">
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
            {editingContact ? (
              <Input
                value={tempContact}
                onChange={(e) => setTempContact(e.target.value)}
                onBlur={handleSaveContact}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveContact()}
                autoFocus
                className="h-8"
              />
            ) : (
              <span 
                className="cursor-text hover:bg-muted/50 px-2 py-1 rounded -mx-2 block truncate"
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
          <TableCell className="text-right">
            {editingValue ? (
              <Input
                type="number"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSaveValue}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveValue()}
                autoFocus
                className="h-8 w-16 text-right ml-auto"
              />
            ) : (
              <span 
                className="cursor-text hover:bg-muted/50 px-2 py-1 rounded font-medium"
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
              calls={row.calls.get(month.key) || []}
              onCreateCall={onCreateCall}
              onAddCallToMonth={onAddCallToMonth}
              onUpdateCall={onUpdateCall}
              onDeleteCall={onDeleteCall}
            />
          ))}

          {/* Delete */}
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDeleteClient(row.client.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Plus className="h-4 w-4 mr-2" />
            Add Call to Month
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {months.map(month => (
              <ContextMenuItem
                key={month.key}
                onClick={() => onAddCallToMonth(row.client.id, month.date)}
              >
                {month.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
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

// Month cell component for scheduling calls (supports multiple calls)
function MonthCell({
  clientId,
  monthKey,
  monthDate,
  calls,
  onCreateCall,
  onAddCallToMonth,
  onUpdateCall,
  onDeleteCall,
}: {
  clientId: string;
  monthKey: string;
  monthDate: Date;
  calls: ConsultingCall[];
  onCreateCall: (clientId: string, monthKey: string, date: Date, time?: string) => void;
  onAddCallToMonth: (clientId: string, monthDate: Date) => void;
  onUpdateCall: (callId: string, field: string, value: any) => void;
  onDeleteCall: (callId: string) => void;
}) {
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

  if (calls.length === 0) {
    return (
      <TableCell className="text-center">
        <SingleCallPicker
          clientId={clientId}
          monthKey={monthKey}
          monthDate={monthDate}
          call={null}
          onCreateCall={onCreateCall}
          onUpdateCall={onUpdateCall}
          onDeleteCall={onDeleteCall}
        />
      </TableCell>
    );
  }

  return (
    <TableCell className="text-center">
      <div className="flex flex-col gap-1">
        {calls.map((call, idx) => (
          <SingleCallPicker
            key={call.id}
            clientId={clientId}
            monthKey={monthKey}
            monthDate={monthDate}
            call={call}
            onCreateCall={onCreateCall}
            onUpdateCall={onUpdateCall}
            onDeleteCall={onDeleteCall}
            isSecondary={idx > 0}
          />
        ))}
      </div>
    </TableCell>
  );
}

// Single call picker component
function SingleCallPicker({
  clientId,
  monthKey,
  monthDate,
  call,
  onCreateCall,
  onUpdateCall,
  onDeleteCall,
  isSecondary = false,
}: {
  clientId: string;
  monthKey: string;
  monthDate: Date;
  call: ConsultingCall | null;
  onCreateCall: (clientId: string, monthKey: string, date: Date, time?: string) => void;
  onUpdateCall: (callId: string, field: string, value: any) => void;
  onDeleteCall: (callId: string) => void;
  isSecondary?: boolean;
}) {
  const [dateOpen, setDateOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    call?.call_date ? parseISO(call.call_date) : undefined
  );
  const [time, setTime] = useState(call?.call_time?.slice(0, 5) || '');

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
    } else {
      onCreateCall(clientId, monthKey, date, time || undefined);
    }
    setDateOpen(false);
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
    ? `${format(parseISO(call.call_date), 'MMM d')}${call.call_time ? ` ${call.call_time.slice(0, 5)}` : ''}`
    : null;

  return (
    <ContextMenu>
      <ContextMenuTrigger disabled={!call}>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-7 justify-center text-left font-normal px-2 gap-1.5 w-full text-xs",
                "hover:bg-muted/50",
                !call && "text-muted-foreground",
                isSecondary && "border-t border-dashed"
              )}
            >
              {call && (
                <div className={cn("w-2 h-2 rounded-full shrink-0", getStatusColor(call.status))} />
              )}
              <CalendarIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {displayText || "Date / Time"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              defaultMonth={monthDate}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            <div className="p-3 border-t">
              <label className="text-sm font-medium">Time (optional)</label>
              <Input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="mt-1"
              />
            </div>
            {call && (
              <div className="p-3 border-t">
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
        </Popover>
      </ContextMenuTrigger>
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
      </ContextMenuContent>
    </ContextMenu>
  );
}

// New client row
function NewClientRow({
  row,
  setRow,
  stores,
  allDepartments,
  months,
  onSave,
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
  onSave: () => void;
  onCancel: () => void;
}) {
  const handleStoreChange = (storeId: string) => {
    if (storeId === 'adhoc') {
      setRow({ ...row, store_id: null, department_id: null, is_adhoc: true });
    } else {
      setRow({ ...row, store_id: storeId, department_id: null, is_adhoc: false });
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
              placeholder="Ad-hoc name"
              className="h-8"
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
          <Button size="sm" className="h-7 px-2" onClick={onSave}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCancel}>
            ×
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
