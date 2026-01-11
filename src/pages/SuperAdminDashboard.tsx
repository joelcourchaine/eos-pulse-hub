import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminStatsCards } from "@/components/admin/AdminStatsCards";
import { AdminOverviewTab } from "@/components/admin/AdminOverviewTab";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AdminStoreGroupsTab } from "@/components/admin/AdminStoreGroupsTab";
import { AdminSystemTab } from "@/components/admin/AdminSystemTab";
import { AdminTicketsTab } from "@/components/admin/AdminTicketsTab";
import { Ticket } from "lucide-react";

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { isSuperAdmin, loading: roleLoading } = useUserRole(userId);
  const [authLoading, setAuthLoading] = useState(true);

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

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
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
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System-wide management and monitoring</p>
        </div>

        <AdminStatsCards />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="store-groups">Store Groups</TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-1.5">
              <Ticket className="h-4 w-4" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AdminOverviewTab />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersTab />
          </TabsContent>

          <TabsContent value="store-groups">
            <AdminStoreGroupsTab />
          </TabsContent>

          <TabsContent value="tickets">
            <AdminTicketsTab />
          </TabsContent>

          <TabsContent value="system">
            <AdminSystemTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
