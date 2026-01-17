import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { CalendarIcon, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConsultingClient {
  id: string;
  name: string;
  department_name: string | null;
  contact_names: string | null;
  call_value: number;
  is_adhoc: boolean;
}

interface ConsultingCall {
  id: string;
  client_id: string;
  call_date: string;
  call_time: string | null;
  status: string;
  notes: string | null;
}

interface ScheduleCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ConsultingClient | null;
  month: Date | null;
  existingCall?: ConsultingCall | null;
}

export function ScheduleCallDialog({ 
  open, 
  onOpenChange, 
  client, 
  month,
  existingCall 
}: ScheduleCallDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [notes, setNotes] = useState('');

  // Fetch all calls for this client/month when dialog opens
  const { data: monthCalls, refetch: refetchMonthCalls } = useQuery({
    queryKey: ['consulting-calls-month', client?.id, month ? format(month, 'yyyy-MM') : null],
    queryFn: async () => {
      if (!client || !month) return [];
      const monthStart = format(startOfMonth(month), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('consulting_calls')
        .select('*')
        .eq('client_id', client.id)
        .gte('call_date', monthStart)
        .lte('call_date', monthEnd)
        .order('call_date', { ascending: true });

      if (error) throw error;
      return data as ConsultingCall[];
    },
    enabled: open && !!client && !!month,
  });

  useEffect(() => {
    if (open && month) {
      if (existingCall) {
        setDate(new Date(existingCall.call_date));
        setTime(existingCall.call_time?.slice(0, 5) || '');
        setStatus(existingCall.status);
        setNotes(existingCall.notes || '');
      } else {
        // Default to first of the month
        setDate(startOfMonth(month));
        setTime('');
        setStatus('scheduled');
        setNotes('');
      }
    }
  }, [open, existingCall, month]);

  const resetForm = () => {
    setDate(month ? startOfMonth(month) : undefined);
    setTime('');
    setStatus('scheduled');
    setNotes('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client || !date) {
      toast.error("Please select a date");
      return;
    }

    setLoading(true);

    const callData = {
      client_id: client.id,
      call_date: format(date, 'yyyy-MM-dd'),
      call_time: time || null,
      status,
      notes: notes.trim() || null,
    };

    try {
      if (existingCall) {
        const { error } = await supabase
          .from('consulting_calls')
          .update(callData)
          .eq('id', existingCall.id);

        if (error) throw error;
        toast.success("Call updated");
      } else {
        const { error } = await supabase
          .from('consulting_calls')
          .insert(callData);

        if (error) throw error;
        toast.success("Call scheduled");
      }

      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
      refetchMonthCalls();
      
      if (!existingCall) {
        resetForm();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save call");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (callId: string) => {
    if (!confirm("Delete this call?")) return;

    try {
      const { error } = await supabase
        .from('consulting_calls')
        .delete()
        .eq('id', callId);

      if (error) throw error;
      
      toast.success("Call deleted");
      queryClient.invalidateQueries({ queryKey: ['consulting-calls'] });
      queryClient.invalidateQueries({ queryKey: ['consulting-monthly-stats'] });
      refetchMonthCalls();
      
      if (existingCall?.id === callId) {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error("Failed to delete call");
    }
  };

  if (!client || !month) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {existingCall ? 'Edit Call' : 'Schedule Call'} - {client.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Existing calls this month */}
          {monthCalls && monthCalls.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">
                Calls in {format(month, 'MMMM yyyy')}
              </Label>
              <ScrollArea className="max-h-[120px]">
                <div className="space-y-2">
                  {monthCalls.map((call) => (
                    <div 
                      key={call.id} 
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg text-sm",
                        call.status === 'completed' && "bg-green-100 dark:bg-green-900/30",
                        call.status === 'cancelled' && "bg-red-100 dark:bg-red-900/30",
                        call.status === 'scheduled' && "bg-blue-100 dark:bg-blue-900/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{format(new Date(call.call_date), 'MMM d')}</span>
                        {call.call_time && <span className="text-muted-foreground">{call.call_time.slice(0, 5)}</span>}
                        <span className="capitalize text-muted-foreground">({call.status})</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(call.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      defaultMonth={month}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Time (optional)</Label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about the call..."
                rows={3}
              />
            </div>

            <DialogFooter className="flex gap-2">
              {existingCall && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => handleDelete(existingCall.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit" disabled={loading}>
                <Plus className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : (existingCall ? 'Update Call' : 'Add Call')}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
