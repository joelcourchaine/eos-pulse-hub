import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Activity, Mail, Building2, Store } from "lucide-react";

export const AdminStatsCards = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      const [usersResult, activeResult, storeGroupsResult, storesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_system_user", false),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_system_user", false)
          .gte("last_sign_in_at", twentyFourHoursAgo),
        supabase.from("store_groups").select("id", { count: "exact", head: true }),
        supabase.from("stores").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalUsers: usersResult.count ?? 0,
        activeToday: activeResult.count ?? 0,
        pendingInvites: "—", // Placeholder - requires auth admin
        storeGroups: storeGroupsResult.count ?? 0,
        totalStores: storesResult.count ?? 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  const cards = [
    { title: "Total Users", value: stats?.totalUsers, icon: Users, color: "text-blue-500" },
    { title: "Active Today", value: stats?.activeToday, icon: Activity, color: "text-green-500" },
    { title: "Pending Invites", value: stats?.pendingInvites, icon: Mail, color: "text-amber-500" },
    { title: "Store Groups", value: stats?.storeGroups, icon: Building2, color: "text-purple-500" },
    { title: "Total Stores", value: stats?.totalStores, icon: Store, color: "text-cyan-500" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
