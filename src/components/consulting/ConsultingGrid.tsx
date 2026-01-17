import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { FormattedCurrency } from "@/components/ui/formatted-currency";
import { format, startOfMonth, addMonths } from "date-fns";
import { useState } from "react";
import { ScheduleCallDialog } from "./ScheduleCallDialog";
import { AddClientDialog } from "./AddClientDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
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
        .lt('call_date', format(endMonth, 'yyyy-MM-dd'));

      if (error) throw error;
      return data as ConsultingCall[];
    },
  });

  const handleCellClick = (client: ConsultingClient, month: Date, existingCalls: ConsultingCall[]) => {
    setSelectedClient(client);
    setSelectedMonth(month);
    if (existingCalls.length === 1) {
      setSelectedCall(existingCalls[0]);
    } else {
      setSelectedCall(null);
    }
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

  const getCallsForClientMonth = (clientId: string, month: Date): ConsultingCall[] => {
    if (!calls) return [];
    const monthStr = format(month, 'yyyy-MM');
    return calls.filter(call => 
      call.client_id === clientId && 
      call.call_date.startsWith(monthStr)
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3 text-red-600" />;
      default:
        return <Clock className="h-3 w-3 text-blue-600" />;
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
                <TableHead className="min-w-[200px] sticky left-[230px] bg-muted/50 z-20">Dept - Contact</TableHead>
                <TableHead className="min-w-[100px] sticky left-[430px] bg-muted/50 z-20 text-right">Value</TableHead>
                {months.map((month) => (
                  <TableHead key={month.toISOString()} className="min-w-[120px] text-center">
                    {format(month, 'MMM yyyy')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id} className={cn(client.is_adhoc && "bg-amber-50/50 dark:bg-amber-950/20")}>
                  <TableCell className="sticky left-0 bg-background z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => handleEditClient(client)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteClient(client)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="font-medium sticky left-[50px] bg-background z-10">
                    <div className="flex items-center gap-2">
                      {client.name}
                      {client.is_adhoc && (
                        <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/50">
                          Ad-Hoc
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="sticky left-[230px] bg-background z-10">
                    <div className="text-sm">
                      {client.department_name && (
                        <span className="font-medium">{client.department_name}</span>
                      )}
                      {client.contact_names && (
                        <span className="text-muted-foreground">
                          {client.department_name ? ' - ' : ''}{client.contact_names}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium sticky left-[430px] bg-background z-10">
                    <FormattedCurrency value={client.call_value} />
                  </TableCell>
                  {months.map((month) => {
                    const monthCalls = getCallsForClientMonth(client.id, month);
                    return (
                      <TableCell 
                        key={month.toISOString()} 
                        className="text-center cursor-pointer hover:bg-muted/50 transition-colors p-1"
                        onClick={() => handleCellClick(client, month, monthCalls)}
                      >
                        {monthCalls.length === 0 ? (
                          <div className="h-8 flex items-center justify-center text-muted-foreground text-xs">
                            —
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {monthCalls.slice(0, 2).map((call) => (
                              <div 
                                key={call.id} 
                                className={cn(
                                  "text-xs px-2 py-1 rounded flex items-center justify-center gap-1",
                                  call.status === 'completed' && "bg-green-100 dark:bg-green-900/30",
                                  call.status === 'cancelled' && "bg-red-100 dark:bg-red-900/30",
                                  call.status === 'scheduled' && "bg-blue-100 dark:bg-blue-900/30"
                                )}
                              >
                                {getStatusIcon(call.status)}
                                <span>{format(new Date(call.call_date), 'MMM d')}</span>
                                {call.call_time && (
                                  <span className="text-muted-foreground">
                                    {call.call_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {monthCalls.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{monthCalls.length - 2} more
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
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
