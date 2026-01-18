import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FormattedCurrency } from "@/components/ui/formatted-currency";
import { format, startOfMonth, addMonths, parseISO } from "date-fns";
import { useState } from "react";
import { ScheduleCallDialog } from "./ScheduleCallDialog";
import { AddClientDialog } from "./AddClientDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Phone, CheckCircle, XCircle, Clock, Plus } from "lucide-react";
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
  call_value: number;
  is_adhoc: boolean;
  is_active: boolean;
  sort_order: number;
}

interface ConsultingCall {
  id: string;
  client_id: string;
  call_date: string;
  call_time: string | null;
  status: string;
  notes: string | null;
}

interface DisplayRow {
  type: 'client' | 'call';
  client: ConsultingClient;
  call?: ConsultingCall;
  isFirstForClient: boolean;
  clientRowCount: number;
}

export function ConsultingGrid({ showAdhoc }: ConsultingGridProps) {
  const queryClient = useQueryClient();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ConsultingClient | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [selectedCall, setSelectedCall] = useState<ConsultingCall | null>(null);

  // Generate 13 months (current + next 12)
  const currentMonth = startOfMonth(new Date());
  const months = Array.from({ length: 13 }, (_, i) => addMonths(currentMonth, i));

  // Fetch clients
  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ['consulting-clients', showAdhoc],
    queryFn: async () => {
      let query = supabase
        .from('consulting_clients')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (!showAdhoc) {
        query = query.eq('is_adhoc', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConsultingClient[];
    },
  });

  // Fetch all calls for the next 13 months
  const { data: calls, isLoading: callsLoading } = useQuery({
    queryKey: ['consulting-calls', format(currentMonth, 'yyyy-MM')],
    queryFn: async () => {
      const endMonth = addMonths(currentMonth, 13);
      const { data, error } = await supabase
        .from('consulting_calls')
        .select('*')
        .gte('call_date', format(currentMonth, 'yyyy-MM-dd'))
        .lt('call_date', format(endMonth, 'yyyy-MM-dd'))
        .order('call_date', { ascending: true });

      if (error) throw error;
      return data as ConsultingCall[];
    },
  });

  // Build display rows: one row per call, plus one row for clients without calls
  const buildDisplayRows = (): DisplayRow[] => {
    if (!clients) return [];

    const rows: DisplayRow[] = [];

    clients.forEach(client => {
      const clientCalls = calls?.filter(c => c.client_id === client.id) || [];
      
      if (clientCalls.length === 0) {
        // Client with no calls - show one empty row
        rows.push({
          type: 'client',
          client,
          isFirstForClient: true,
          clientRowCount: 1,
        });
      } else {
        // One row per call, sorted by date
        const sortedCalls = [...clientCalls].sort((a, b) => 
          a.call_date.localeCompare(b.call_date)
        );
        
        sortedCalls.forEach((call, index) => {
          rows.push({
            type: 'call',
            client,
            call,
            isFirstForClient: index === 0,
            clientRowCount: sortedCalls.length,
          });
        });
      }
    });

    return rows;
  };

  const displayRows = buildDisplayRows();

  const handleAddCall = (client: ConsultingClient) => {
    setSelectedClient(client);
    setSelectedMonth(currentMonth);
    setSelectedCall(null);
    setScheduleDialogOpen(true);
  };

  const handleEditCall = (client: ConsultingClient, call: ConsultingCall) => {
    setSelectedClient(client);
    setSelectedMonth(parseISO(call.call_date));
    setSelectedCall(call);
    setScheduleDialogOpen(true);
  };

  const handleEditClient = (client: ConsultingClient) => {
    setSelectedClient(client);
    setEditClientOpen(true);
  };

  const handleDeleteClient = async (client: ConsultingClient) => {
    if (!confirm(`Are you sure you want to delete "${client.name}"? This will also delete all scheduled calls.`)) {
      return;
    }

    const { error } = await supabase
      .from('consulting_clients')
      .delete()
      .eq('id', client.id);

    if (error) {
      toast.error("Failed to delete client");
      return;
    }

    toast.success("Client deleted");
    queryClient.invalidateQueries({ queryKey: ['consulting-clients'] });
    queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
  };

  const handleDeleteCall = async (call: ConsultingCall) => {
    if (!confirm("Delete this call?")) return;

    const { error } = await supabase
      .from('consulting_calls')
      .delete()
      .eq('id', call.id);

    if (error) {
      toast.error("Failed to delete call");
      return;
    }

    toast.success("Call deleted");
    queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
    queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Cancelled</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Scheduled</Badge>;
    }
  };

  const isLoading = clientsLoading || callsLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!clients?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Phone className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No clients yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add your first dealership or ad-hoc client to get started
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[50px] sticky left-0 bg-muted/50 z-20"></TableHead>
                <TableHead className="min-w-[180px] sticky left-[50px] bg-muted/50 z-20">Dealership</TableHead>
                <TableHead className="min-w-[180px] sticky left-[230px] bg-muted/50 z-20">Dept - Contact</TableHead>
                <TableHead className="min-w-[90px] sticky left-[410px] bg-muted/50 z-20 text-right">Value</TableHead>
                <TableHead className="min-w-[110px]">Date</TableHead>
                <TableHead className="min-w-[80px]">Time</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[200px]">Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayRows.map((row, index) => (
                <TableRow 
                  key={row.call?.id || `${row.client.id}-empty`} 
                  className={cn(
                    row.client.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20",
                    !row.isFirstForClient && "border-t-0"
                  )}
                >
                  {/* Actions column */}
                  <TableCell className="sticky left-0 bg-background z-10">
                    {row.isFirstForClient && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem onClick={() => handleAddCall(row.client)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Call
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClient(row.client)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClient(row.client)} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>

                  {/* Dealership - only show on first row for client */}
                  <TableCell className="font-medium sticky left-[50px] bg-background z-10">
                    {row.isFirstForClient ? (
                      <div className="flex items-center gap-2">
                        {row.client.name}
                        {row.client.is_adhoc && (
                          <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50">
                            Ad-Hoc
                          </Badge>
                        )}
                        {row.clientRowCount > 1 && (
                          <Badge variant="secondary" className="text-xs">
                            {row.clientRowCount} calls
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">↳</span>
                    )}
                  </TableCell>

                  {/* Dept - Contact */}
                  <TableCell className="sticky left-[230px] bg-background z-10">
                    {row.isFirstForClient && (
                      <div className="text-sm">
                        {row.client.department_name && (
                          <span className="font-medium">{row.client.department_name}</span>
                        )}
                        {row.client.contact_names && (
                          <span className="text-muted-foreground">
                            {row.client.department_name ? ' - ' : ''}{row.client.contact_names}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>

                  {/* Value */}
                  <TableCell className="text-right font-medium sticky left-[410px] bg-background z-10">
                    {row.isFirstForClient && (
                      <FormattedCurrency value={row.client.call_value} />
                    )}
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    {row.call ? (
                      <div className="flex items-center gap-2">
                        {getStatusIcon(row.call.status)}
                        <span className="font-medium">
                          {format(parseISO(row.call.call_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No calls scheduled</span>
                    )}
                  </TableCell>

                  {/* Time */}
                  <TableCell>
                    {row.call?.call_time ? (
                      <span>{row.call.call_time.slice(0, 5)}</span>
                    ) : row.call ? (
                      <span className="text-muted-foreground">—</span>
                    ) : null}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {row.call && getStatusBadge(row.call.status)}
                  </TableCell>

                  {/* Notes */}
                  <TableCell>
                    {row.call?.notes && (
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {row.call.notes}
                      </span>
                    )}
                  </TableCell>

                  {/* Row Actions */}
                  <TableCell>
                    {row.call && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEditCall(row.client, row.call!)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteCall(row.call!)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Schedule Call Dialog */}
      <ScheduleCallDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        client={selectedClient}
        month={selectedMonth}
        existingCall={selectedCall}
      />

      {/* Edit Client Dialog */}
      <AddClientDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        editClient={selectedClient}
      />
    </>
  );
}
