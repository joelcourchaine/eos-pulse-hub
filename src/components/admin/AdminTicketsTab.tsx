import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketDetailSheet } from "@/components/support/TicketDetailSheet";
import { Bug, Lightbulb, HelpCircle, MoreHorizontal, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketCategory = Database["public"]["Enums"]["ticket_category"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

interface HelpTicket {
  id: string;
  ticket_number: number;
  user_id: string;
  user_name: string;
  user_email: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  page_url: string | null;
  browser_info: string | null;
  error_message: string | null;
  error_stack: string | null;
  screenshot_path: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

const categoryIcons: Record<TicketCategory, React.ReactNode> = {
  bug_report: <Bug className="h-4 w-4 text-destructive" />,
  feature_request: <Lightbulb className="h-4 w-4 text-yellow-500" />,
  question: <HelpCircle className="h-4 w-4 text-blue-500" />,
  other: <MoreHorizontal className="h-4 w-4 text-muted-foreground" />,
};

const priorityColors: Record<TicketPriority, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const statusColors: Record<TicketStatus, string> = {
  open: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  closed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

export const AdminTicketsTab = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<HelpTicket | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets-tab", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("help_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as TicketStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HelpTicket[];
    },
  });

  const handleTicketClick = (ticket: HelpTicket) => {
    setSelectedTicket(ticket);
    setIsSheetOpen(true);
  };

  const handleTicketUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-tickets-tab"] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Support Tickets</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-tickets-tab"] })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tickets && tickets.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ticket #</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-[60px]">Category</TableHead>
                  <TableHead className="w-[90px]">Priority</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleTicketClick(ticket)}
                  >
                    <TableCell className="font-mono text-sm">
                      #{ticket.ticket_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.user_name}</div>
                        <div className="text-xs text-muted-foreground">{ticket.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ticket.subject}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center">
                        {categoryIcons[ticket.category]}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[ticket.priority]} variant="secondary">
                        {ticket.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[ticket.status]} variant="secondary">
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ticket.created_at), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No tickets found
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTicket && (
        <TicketDetailSheet
          ticket={selectedTicket}
          open={isSheetOpen}
          onOpenChange={setIsSheetOpen}
          onUpdate={handleTicketUpdate}
        />
      )}
    </>
  );
};
