import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Search, KeyRound, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const AdminUsersTab = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: roleBreakdown, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin-user-role-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");

      if (error) throw error;

      const counts: Record<string, number> = {};
      data?.forEach((r) => {
        counts[r.role] = (counts[r.role] || 0) + 1;
      });

      return Object.entries(counts)
        .map(([role, count]) => ({ role, count }))
        .sort((a, b) => b.count - a.count);
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, store_group_id, last_sign_in_at")
        .eq("is_system_user", false)
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  const filteredUsers = users?.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  }).slice(0, 50);

  const handleResetPassword = async (userId: string, userEmail: string) => {
    setResettingUserId(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("resend-user-invite", {
        body: { user_id: userId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success(`Password reset email sent to ${userEmail}`);
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] });
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to send password reset email");
    } finally {
      setResettingUserId(null);
    }
  };

  const roleColors: Record<string, string> = {
    super_admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    store_gm: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    department_manager: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    fixed_ops_manager: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    user: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {rolesLoading ? (
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-24" />
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
                  {item.role.replace(/_/g, " ")}: {item.count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User Management</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || "—"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={roleColors[user.role || "user"] || ""}
                        >
                          {(user.role || "user").replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.last_sign_in_at
                          ? formatDistanceToNow(new Date(user.last_sign_in_at), {
                              addSuffix: true,
                            })
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(user.id, user.email || "")}
                          disabled={resettingUserId === user.id}
                        >
                          {resettingUserId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4 mr-1" />
                          )}
                          Reset Password
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredUsers && filteredUsers.length >= 50 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 50 results. Use search to narrow down.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
