import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsultingGrid } from "@/components/consulting/ConsultingGrid";
import { AddClientDialog } from "@/components/consulting/AddClientDialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FormattedCurrency } from "@/components/ui/formatted-currency";
import { startOfMonth, addMonths, format } from "date-fns";

const ConsultingScheduler = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { isSuperAdmin, loading: roleLoading } = useUserRole(userId);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdhoc, setShowAdhoc] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
      setAuthLoading(false);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!authLoading && !roleLoading) {
      if (!userId) {
        navigate("/auth");
      } else if (!isSuperAdmin) {
        navigate("/dashboard");
      }
    }
  }, [userId, isSuperAdmin, authLoading, roleLoading, navigate]);

  // Calculate current month stats
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = addMonths(currentMonthStart, 1);

  const { data: monthlyStats } = useQuery({
    queryKey: ['consulting-monthly-stats', format(currentMonthStart, 'yyyy-MM')],
    queryFn: async () => {
      const { data: calls, error } = await supabase
        .from('consulting_calls')
        .select(`
          id,
          call_date,
          status,
          client_id,
          consulting_clients!inner(call_value, is_adhoc)
        `)
        .gte('call_date', format(currentMonthStart, 'yyyy-MM-dd'))
        .lt('call_date', format(currentMonthEnd, 'yyyy-MM-dd'));

      if (error) throw error;

      const scheduled = calls?.filter(c => c.status === 'scheduled') || [];
      const completed = calls?.filter(c => c.status === 'completed') || [];
      
      const scheduledValue = scheduled.reduce((sum, c) => {
        const client = c.consulting_clients as { call_value: number; is_adhoc: boolean } | null;
        return sum + (client?.call_value || 0);
      }, 0);
      
      const completedValue = completed.reduce((sum, c) => {
        const client = c.consulting_clients as { call_value: number; is_adhoc: boolean } | null;
        return sum + (client?.call_value || 0);
      }, 0);

      return {
        scheduledCount: scheduled.length,
        scheduledValue,
        completedCount: completed.length,
        completedValue,
      };
    },
    enabled: isSuperAdmin,
  });

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-full mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-full mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Consulting Call Scheduler</h1>
              <p className="text-muted-foreground mt-1">Schedule and track consulting calls with dealerships</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Monthly Stats */}
            <div className="flex items-center gap-6 bg-muted/50 rounded-lg px-4 py-2">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-lg font-semibold text-foreground">
                  <FormattedCurrency value={monthlyStats?.scheduledValue || 0} />
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-semibold text-green-600">
                  <FormattedCurrency value={monthlyStats?.completedValue || 0} />
                </p>
              </div>
            </div>

            {/* Toggle Ad-hoc */}
            <div className="flex items-center gap-2">
              <Switch
                id="show-adhoc"
                checked={showAdhoc}
                onCheckedChange={setShowAdhoc}
              />
              <Label htmlFor="show-adhoc" className="text-sm">Show Ad-Hoc</Label>
            </div>

            {/* Add Client Button */}
            <Button onClick={() => setAddClientOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <ConsultingGrid showAdhoc={showAdhoc} />

        {/* Add Client Dialog */}
        <AddClientDialog 
          open={addClientOpen} 
          onOpenChange={setAddClientOpen} 
        />
      </div>
    </div>
  );
};

export default ConsultingScheduler;
