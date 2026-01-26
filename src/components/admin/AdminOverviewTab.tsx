import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { AdminLoginChart } from "./AdminLoginChart";

export const AdminOverviewTab = () => {
  const { data: roleBreakdown, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-role-breakdown"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((r) => {
        counts[r.role] = (counts[r.role] || 0) + 1;
      });

      const total = data?.length || 0;
      return Object.entries(counts)
        .map(([role, count]) => ({
          role,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: recentLogins, isLoading: loginsLoading } = useQuery({
    queryKey: ["admin-recent-logins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, last_sign_in_at")
        .not("last_sign_in_at", "is", null)
        .eq("is_system_user", false)
        .order("last_sign_in_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      return data;
    },
  });

  const roleColors: Record<string, string> = {
    super_admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    store_gm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    department_manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    fixed_ops_manager: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    user: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  return (
    <div className="space-y-6">
      <AdminLoginChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
        <CardHeader>
          <CardTitle>Users by Role</CardTitle>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roleBreakdown?.map((item) => (
                <Badge
                  key={item.role}
                  variant="secondary"
                  className={roleColors[item.role] || ""}
                >
                  {item.role.replace(/_/g, " ")}: {item.count} ({item.percentage}%)
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Logins</CardTitle>
        </CardHeader>
        <CardContent>
          {loginsLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogins?.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{user.full_name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {user.last_sign_in_at
                      ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                      : "Never"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};
