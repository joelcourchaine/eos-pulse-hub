import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const AdminStoreGroupsTab = () => {
  const { data: storeGroups, isLoading } = useQuery({
    queryKey: ["admin-store-groups-detailed"],
    queryFn: async () => {
      const { data: groups, error: groupsError } = await supabase
        .from("store_groups")
        .select("id, name")
        .order("name");

      if (groupsError) throw groupsError;

      const enrichedGroups = await Promise.all(
        (groups || []).map(async (group) => {
          const [storesResult, usersResult] = await Promise.all([
            supabase
              .from("stores")
              .select("id", { count: "exact", head: true })
              .eq("group_id", group.id),
            supabase
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .eq("store_group_id", group.id)
              .eq("is_system_user", false),
          ]);

          return {
            ...group,
            storesCount: storesResult.count ?? 0,
            usersCount: usersResult.count ?? 0,
          };
        })
      );

      return enrichedGroups;
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Groups</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead className="text-center">Stores</TableHead>
                <TableHead className="text-center">Users</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {storeGroups?.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-center">{group.storesCount}</TableCell>
                  <TableCell className="text-center">{group.usersCount}</TableCell>
                </TableRow>
              ))}
              {storeGroups?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    No store groups found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
