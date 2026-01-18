import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Phone, Plus, Trash2, CalendarIcon, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ConsultingGridProps {
  showAdhoc: boolean;
}

interface ConsultingCall {
  id: string;
  client_name: string;
  department_name: string | null;
  contact_names: string | null;
  call_value: number;
  is_adhoc: boolean;
  call_date: string;
  call_time: string | null;
  status: string;
  notes: string | null;
  store_id: string | null;
  department_id: string | null;
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

export function ConsultingGrid({ showAdhoc }: ConsultingGridProps) {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<Partial<ConsultingCall> | null>(null);

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

  // Fetch calls with client info denormalized
  const { data: calls, isLoading } = useQuery({
    queryKey: ['consulting-calls-full', showAdhoc],
    queryFn: async () => {
      let query = supabase
        .from('consulting_calls')
        .select(`
          id,
          call_date,
          call_time,
          status,
          notes,
          consulting_clients!inner(
            id,
            name,
            department_name,
            contact_names,
            call_value,
            is_adhoc,
            is_active
          )
        `)
        .order('call_date', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      // Transform data
      const transformed = data?.map(call => {
        const client = call.consulting_clients as any;
        return {
          id: call.id,
          client_id: client.id,
          client_name: client.name,
          department_name: client.department_name,
          contact_names: client.contact_names,
          call_value: client.call_value,
          is_adhoc: client.is_adhoc,
          call_date: call.call_date,
          call_time: call.call_time,
          status: call.status,
          notes: call.notes,
          store_id: null,
          department_id: null,
        };
      }).filter(call => showAdhoc || !call.is_adhoc) || [];

      return transformed as ConsultingCall[];
    },
  });

  const handleAddRow = () => {
    setNewRow({
      client_name: '',
      department_name: '',
      contact_names: '',
      call_value: 0,
      is_adhoc: false,
      call_date: format(new Date(), 'yyyy-MM-dd'),
      call_time: null,
      status: 'scheduled',
      notes: '',
      store_id: null,
      department_id: null,
    });
  };

  const handleSaveNewRow = async () => {
    if (!newRow?.client_name && !newRow?.store_id) {
      toast.error("Please select a dealership or enter ad-hoc name");
      return;
    }

    try {
      // First, create or find the client
      let clientName = newRow.client_name || '';
      let deptName = newRow.department_name || '';

      if (newRow.store_id) {
        const store = stores?.find(s => s.id === newRow.store_id);
        clientName = store?.name || '';
      }
      if (newRow.department_id) {
        const dept = allDepartments?.find(d => d.id === newRow.department_id);
        deptName = dept?.name || '';
      }

      // Check if client exists
      const { data: existingClient } = await supabase
        .from('consulting_clients')
        .select('id')
        .eq('name', clientName)
        .eq('department_name', deptName || '')
        .single();

      let clientId: string;

      if (existingClient) {
        clientId = existingClient.id;
        // Update client info
        await supabase
          .from('consulting_clients')
          .update({
            contact_names: newRow.contact_names || null,
            call_value: newRow.call_value || 0,
          })
          .eq('id', clientId);
      } else {
        // Create new client
        const { data: { user } } = await supabase.auth.getUser();
        const { data: newClient, error: clientError } = await supabase
          .from('consulting_clients')
          .insert({
            name: clientName,
            department_name: deptName || null,
            contact_names: newRow.contact_names || null,
            call_value: newRow.call_value || 0,
            is_adhoc: newRow.is_adhoc || false,
            created_by: user?.id,
          })
          .select('id')
          .single();

        if (clientError) throw clientError;
        clientId = newClient.id;
      }

      // Create the call
      const { error: callError } = await supabase
        .from('consulting_calls')
        .insert({
          client_id: clientId,
          call_date: newRow.call_date || format(new Date(), 'yyyy-MM-dd'),
          call_time: newRow.call_time || null,
          status: newRow.status || 'scheduled',
          notes: newRow.notes || null,
        });

      if (callError) throw callError;

      toast.success("Call added");
      setNewRow(null);
      queryClient.invalidateQueries({ queryKey: ['consulting-calls-full'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    }
  };

  const handleCancelNewRow = () => {
    setNewRow(null);
  };

  const handleUpdateCall = async (callId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .update({ [field]: value })
        .eq('id', callId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['consulting-calls-full'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to update");
    }
  };

  const handleStatusChange = async (callId: string, newStatus: string) => {
    await handleUpdateCall(callId, 'status', newStatus);
    toast.success(`Marked as ${newStatus}`);
  };

  const handleDeleteCall = async (callId: string) => {
    try {
      const { error } = await supabase
        .from('consulting_calls')
        .delete()
        .eq('id', callId);

      if (error) throw error;
      toast.success("Call deleted");
      queryClient.invalidateQueries({ queryKey: ['consulting-calls-full'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
    } catch (error: any) {
      toast.error("Failed to delete");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getDepartmentsForStore = (storeId: string | null) => {
    if (!storeId || !allDepartments) return [];
    return allDepartments.filter(d => d.store_id === storeId);
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
          Add Call
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[200px]">Dealership</TableHead>
                <TableHead className="w-[150px]">Department</TableHead>
                <TableHead className="w-[150px]">Contact</TableHead>
                <TableHead className="w-[100px] text-right">Value</TableHead>
                <TableHead className="w-[180px]">Date / Time</TableHead>
                <TableHead className="w-[200px]">Notes</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* New row being added */}
              {newRow && (
                <NewCallRow
                  row={newRow}
                  setRow={setNewRow}
                  stores={stores || []}
                  departments={getDepartmentsForStore(newRow.store_id || null)}
                  allDepartments={allDepartments || []}
                  onSave={handleSaveNewRow}
                  onCancel={handleCancelNewRow}
                />
              )}

              {/* Existing calls */}
              {calls?.map((call) => (
                <CallRow
                  key={call.id}
                  call={call}
                  onUpdateCall={handleUpdateCall}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteCall}
                />
              ))}

              {!calls?.length && !newRow && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground">No calls scheduled</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Click "Add Call" to schedule your first consulting call
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

// Inline editable row for existing calls
function CallRow({ 
  call, 
  onUpdateCall, 
  onStatusChange,
  onDelete 
}: { 
  call: ConsultingCall;
  onUpdateCall: (id: string, field: string, value: any) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<string>('');
  const [dateOpen, setDateOpen] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  const handleStartEdit = (field: string, value: string) => {
    setEditingField(field);
    setTempValue(value);
  };

  const handleSaveEdit = () => {
    if (editingField) {
      let valueToSave: any = tempValue;
      if (editingField === 'call_value') {
        valueToSave = parseFloat(tempValue) || 0;
      }
      // Note: For client fields, we'd need to update the consulting_clients table
      // For now, we only allow editing call-specific fields
      if (['notes', 'call_time'].includes(editingField)) {
        onUpdateCall(call.id, editingField, valueToSave || null);
      }
    }
    setEditingField(null);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onUpdateCall(call.id, 'call_date', format(date, 'yyyy-MM-dd'));
    }
    setDateOpen(false);
  };

  const combinedDateTime = call.call_time 
    ? `${format(parseISO(call.call_date), 'MMM d, yyyy')} ${call.call_time.slice(0, 5)}`
    : format(parseISO(call.call_date), 'MMM d, yyyy');

  return (
    <TableRow className={cn(call.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20")}>
      {/* Dealership */}
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {call.client_name}
          {call.is_adhoc && (
            <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50">
              Ad-Hoc
            </Badge>
          )}
        </div>
      </TableCell>

      {/* Department */}
      <TableCell className="text-sm text-muted-foreground">
        {call.department_name || '—'}
      </TableCell>

      {/* Contact */}
      <TableCell>
        {editingField === 'contact_names' ? (
          <Input
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            autoFocus
            className="h-8"
          />
        ) : (
          <span 
            className="cursor-text hover:bg-muted/50 px-2 py-1 rounded -mx-2"
            onClick={() => handleStartEdit('contact_names', call.contact_names || '')}
          >
            {call.contact_names || <span className="text-muted-foreground">—</span>}
          </span>
        )}
      </TableCell>

      {/* Value */}
      <TableCell className="text-right font-medium">
        ${call.call_value.toFixed(0)}
      </TableCell>

      {/* Date/Time with status indicator */}
      <TableCell>
        <ContextMenu>
          <ContextMenuTrigger>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-8 justify-start text-left font-normal px-2 -mx-2 gap-2",
                    "hover:bg-muted/50"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", getStatusColor(call.status))} />
                  <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                  <span>{combinedDateTime}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={parseISO(call.call_date)}
                  onSelect={handleDateSelect}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
                <div className="p-3 border-t">
                  <label className="text-sm font-medium">Time (optional)</label>
                  <Input
                    type="time"
                    value={call.call_time?.slice(0, 5) || ''}
                    onChange={(e) => onUpdateCall(call.id, 'call_time', e.target.value || null)}
                    className="mt-1"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onStatusChange(call.id, 'scheduled')}>
              <Clock className="h-4 w-4 mr-2 text-blue-500" />
              Mark as Scheduled
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onStatusChange(call.id, 'completed')}>
              <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              Mark as Completed
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onStatusChange(call.id, 'cancelled')}>
              <XCircle className="h-4 w-4 mr-2 text-red-500" />
              Mark as Cancelled
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </TableCell>

      {/* Notes */}
      <TableCell>
        {editingField === 'notes' ? (
          <Input
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            autoFocus
            className="h-8"
          />
        ) : (
          <span 
            className="cursor-text hover:bg-muted/50 px-2 py-1 rounded -mx-2 block truncate max-w-[180px]"
            onClick={() => handleStartEdit('notes', call.notes || '')}
          >
            {call.notes || <span className="text-muted-foreground">Add notes...</span>}
          </span>
        )}
      </TableCell>

      {/* Delete */}
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(call.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// New row for adding a call
function NewCallRow({
  row,
  setRow,
  stores,
  departments,
  allDepartments,
  onSave,
  onCancel,
}: {
  row: Partial<ConsultingCall>;
  setRow: (row: Partial<ConsultingCall> | null) => void;
  stores: Store[];
  departments: Department[];
  allDepartments: Department[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [isAdhoc, setIsAdhoc] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const handleStoreChange = (storeId: string) => {
    if (storeId === 'adhoc') {
      setIsAdhoc(true);
      setRow({ ...row, store_id: null, department_id: null, is_adhoc: true, client_name: '' });
    } else {
      setIsAdhoc(false);
      const store = stores.find(s => s.id === storeId);
      setRow({ ...row, store_id: storeId, department_id: null, is_adhoc: false, client_name: store?.name || '' });
    }
  };

  const currentDepts = row.store_id ? allDepartments.filter(d => d.store_id === row.store_id) : [];

  return (
    <TableRow className="bg-primary/5">
      {/* Dealership */}
      <TableCell>
        {isAdhoc ? (
          <div className="flex items-center gap-2">
            <Input
              value={row.client_name || ''}
              onChange={(e) => setRow({ ...row, client_name: e.target.value })}
              placeholder="Ad-hoc name"
              className="h-8"
            />
            <Button variant="ghost" size="sm" onClick={() => { setIsAdhoc(false); setRow({ ...row, is_adhoc: false, store_id: null }); }}>
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
        {isAdhoc ? (
          <Input
            value={row.department_name || ''}
            onChange={(e) => setRow({ ...row, department_name: e.target.value })}
            placeholder="Category"
            className="h-8"
          />
        ) : (
          <Select 
            value={row.department_id || ''} 
            onValueChange={(v) => {
              const dept = currentDepts.find(d => d.id === v);
              setRow({ ...row, department_id: v, department_name: dept?.name || '' });
            }}
            disabled={!row.store_id}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Select dept" />
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
          value={row.contact_names || ''}
          onChange={(e) => setRow({ ...row, contact_names: e.target.value })}
          placeholder="Contact names"
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
          className="h-8 w-20 text-right"
        />
      </TableCell>

      {/* Date/Time */}
      <TableCell>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-8 justify-start text-left font-normal gap-2">
              <CalendarIcon className="h-3 w-3" />
              {row.call_date ? format(parseISO(row.call_date), 'MMM d, yyyy') : 'Pick date'}
              {row.call_time && ` ${row.call_time.slice(0, 5)}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={row.call_date ? parseISO(row.call_date) : undefined}
              onSelect={(date) => {
                if (date) setRow({ ...row, call_date: format(date, 'yyyy-MM-dd') });
              }}
              initialFocus
              className="p-3 pointer-events-auto"
            />
            <div className="p-3 border-t">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={row.call_time || ''}
                onChange={(e) => setRow({ ...row, call_time: e.target.value || null })}
                className="mt-1"
              />
            </div>
          </PopoverContent>
        </Popover>
      </TableCell>

      {/* Notes */}
      <TableCell>
        <Input
          value={row.notes || ''}
          onChange={(e) => setRow({ ...row, notes: e.target.value })}
          placeholder="Notes"
          className="h-8"
        />
      </TableCell>

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
