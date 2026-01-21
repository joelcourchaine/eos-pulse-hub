import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CheckCircle, AlertCircle, XCircle, FileSpreadsheet } from "lucide-react";

interface ImportLog {
  id: string;
  department_id: string | null;
  store_id: string | null;
  imported_by: string | null;
  import_source: string;
  file_name: string;
  month: string;
  metrics_imported: Record<string, any>;
  user_mappings: Record<string, any>;
  unmatched_users: string[];
  warnings: string[];
  status: string;
  created_at: string;
  departments?: { name: string } | null;
  stores?: { name: string } | null;
  profiles?: { full_name: string } | null;
}

export const ScorecardImportLogsPanel = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["scorecard-import-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_import_logs")
        .select("*, departments(name), stores(name), profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ImportLog[];
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "partial":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/20 text-green-700">Success</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/20 text-yellow-700">Partial</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split("-");
    const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
    return format(date, "MMMM yyyy");
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Recent import history showing status, metrics imported, and any warnings
      </p>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Imported By</TableHead>
              <TableHead>Metrics</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No import logs yet
                </TableCell>
              </TableRow>
            ) : (
              logs?.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate max-w-[200px]" title={log.file_name}>
                        {log.file_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{formatMonth(log.month)}</TableCell>
                  <TableCell>{log.stores?.name || "-"}</TableCell>
                  <TableCell>{log.profiles?.full_name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm">
                        {Object.keys(log.metrics_imported || {}).length} metrics
                      </span>
                      {(log.unmatched_users?.length || 0) > 0 && (
                        <span className="text-xs text-yellow-600">
                          {log.unmatched_users.length} unmatched
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
