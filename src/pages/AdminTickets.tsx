import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Bug, Lightbulb, HelpCircle, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/use-user-role";
import { TicketDetailSheet } from "@/components/support/TicketDetailSheet";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketCategory = "bug_report" | "feature_request" | "question" | "other";
type TicketPriority = "low" | "normal" | "urgent";

interface HelpTicket {
  id: string;
  ticket_number: number;
  user_name: string;
  user_email: string;
  page_url: string | null;
  browser_info: string | null;
  error_message: string | null;
  error_stack: string | null;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  screenshot_path: string | null;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

const categoryIcons: Record<TicketCategory, React.ReactNode> = {
  bug_report: <Bug className="h-4 w-4" />,
  feature_request: <Lightbulb className="h-4 w-4" />,
  question: <HelpCircle className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

const priorityColors: Record<TicketPriority, string> = {
  low: "bg-slate-500",
  normal: "bg-blue-500",
  urgent: "bg-red-500",
};

const statusColors: Record<TicketStatus, string> = {
  open: "bg-yellow-500",
  in_progress: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-slate-500",
};

const AdminTickets = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | undefined>();
  const { isSuperAdmin, loading: roleLoading } = useUserRole(userId);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [selectedTicket, setSelectedTicket] = useState<HelpTicket | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Redirect if not super admin
  useEffect(() => {
    if (!roleLoading && userId && !isSuperAdmin) {
      navigate("/");
    }
  }, [isSuperAdmin, roleLoading, navigate, userId]);

  const { data: tickets, isLoading: ticketsLoading, refetch } = useQuery({
    queryKey: ["help-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("help_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as HelpTicket[];
    },
    enabled: isSuperAdmin,
  });

  if (roleLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Support Tickets</h1>
        </div>
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">#</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="w-24">Category</TableHead>
              <TableHead className="w-24">Priority</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-32">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ticketsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : tickets?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets?.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <TableCell className="font-mono">{ticket.ticket_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ticket.user_name}</p>
                      <p className="text-xs text-muted-foreground">{ticket.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{ticket.subject}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1" title={ticket.category.replace("_", " ")}>
                      {categoryIcons[ticket.category]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${priorityColors[ticket.priority]} text-white capitalize`}>
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[ticket.status]} text-white capitalize`}>
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(ticket.created_at), "MMM d, h:mm a")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TicketDetailSheet
        ticket={selectedTicket}
        open={!!selectedTicket}
        onOpenChange={(open) => !open && setSelectedTicket(null)}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["help-tickets"] });
        }}
      />
    </div>
  );
};

export default AdminTickets;
