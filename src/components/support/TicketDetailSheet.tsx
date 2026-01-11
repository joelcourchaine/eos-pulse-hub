import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, Loader2, ExternalLink, Image as ImageIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "normal" | "urgent";
type TicketCategory = "bug_report" | "feature_request" | "question" | "other";

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

interface TicketReply {
  id: string;
  user_name: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
}

interface TicketDetailSheetProps {
  ticket: HelpTicket | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const statusColors: Record<TicketStatus, string> = {
  open: "bg-yellow-500",
  in_progress: "bg-blue-500",
  resolved: "bg-green-500",
  closed: "bg-slate-500",
};

const priorityColors: Record<TicketPriority, string> = {
  low: "bg-slate-500",
  normal: "bg-blue-500",
  urgent: "bg-red-500",
};

export const TicketDetailSheet = ({ ticket, open, onOpenChange, onUpdate }: TicketDetailSheetProps) => {
  const queryClient = useQueryClient();
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

  // Fetch replies
  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ["ticket-replies", ticket?.id],
    queryFn: async () => {
      if (!ticket) return [];
      const { data, error } = await supabase
        .from("help_ticket_replies")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TicketReply[];
    },
    enabled: !!ticket,
  });

  // Fetch super admins for assignment
  const { data: admins } = useQuery({
    queryKey: ["super-admins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      if (error) throw error;
      
      if (data.length === 0) return [];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", data.map(r => r.user_id));
      
      return profiles || [];
    },
  });

  // Fetch screenshot URL when ticket has one
  React.useEffect(() => {
    const fetchScreenshot = async () => {
      if (ticket?.screenshot_path) {
        const { data } = await supabase.storage
          .from("note-attachments")
          .createSignedUrl(ticket.screenshot_path, 3600);
        if (data?.signedUrl) {
          setScreenshotUrl(data.signedUrl);
        }
      } else {
        setScreenshotUrl(null);
      }
    };
    fetchScreenshot();
  }, [ticket?.screenshot_path]);

  // Update ticket status
  const updateStatus = useMutation({
    mutationFn: async (status: TicketStatus) => {
      if (!ticket) return;
      const updates: Partial<HelpTicket> = { status };
      if (status === "resolved" || status === "closed") {
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from("help_tickets")
        .update(updates)
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Status updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error updating status", description: error.message, variant: "destructive" });
    },
  });

  // Assign ticket
  const assignTicket = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      if (!ticket) return;
      const { error } = await supabase
        .from("help_tickets")
        .update({ assigned_to: assignedTo === "unassigned" ? null : assignedTo })
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Ticket assigned" });
    },
    onError: (error: any) => {
      toast({ title: "Error assigning ticket", description: error.message, variant: "destructive" });
    },
  });

  // Send reply
  const sendReply = async () => {
    if (!ticket || !replyMessage.trim()) return;
    
    setIsReplying(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const { error: replyError } = await supabase
        .from("help_ticket_replies")
        .insert({
          ticket_id: ticket.id,
          user_id: user.id,
          user_name: profile?.full_name || "Admin",
          message: replyMessage,
          is_admin_reply: true,
        });

      if (replyError) throw replyError;

      // Send email notification
      await supabase.functions.invoke("send-ticket-reply", {
        body: { ticketId: ticket.id, message: replyMessage },
      });

      setReplyMessage("");
      queryClient.invalidateQueries({ queryKey: ["ticket-replies", ticket.id] });
      toast({ title: "Reply sent" });
    } catch (error: any) {
      toast({ title: "Error sending reply", description: error.message, variant: "destructive" });
    } finally {
      setIsReplying(false);
    }
  };

  if (!ticket) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col h-full">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <span className="font-mono text-muted-foreground">#{ticket.ticket_number}</span>
            {ticket.subject}
          </SheetTitle>
          <SheetDescription>
            From {ticket.user_name} • {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Status and Assignment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={ticket.status} onValueChange={(v) => updateStatus.mutate(v as TicketStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select 
                  value={ticket.assigned_to || "unassigned"} 
                  onValueChange={(v) => assignTicket.mutate(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {admins?.map((admin) => (
                      <SelectItem key={admin.id} value={admin.id}>{admin.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Badge className={`${priorityColors[ticket.priority]} text-white capitalize`}>
                {ticket.priority} priority
              </Badge>
              <Badge variant="outline" className="capitalize">
                {ticket.category.replace("_", " ")}
              </Badge>
            </div>

            <Separator />

            {/* Ticket Details */}
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground text-xs">Description</Label>
                <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Page URL</Label>
                  <p className="font-mono text-xs">{ticket.page_url || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Browser</Label>
                  <p className="text-xs">{ticket.browser_info || "N/A"}</p>
                </div>
              </div>

              {ticket.error_message && (
                <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                  <Label className="text-destructive text-xs">Error Message</Label>
                  <p className="mt-1 text-sm font-mono break-all">{ticket.error_message}</p>
                  {ticket.error_stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-destructive/70">Stack trace</summary>
                      <pre className="text-[10px] mt-1 whitespace-pre-wrap break-all">{ticket.error_stack}</pre>
                    </details>
                  )}
                </div>
              )}

              {screenshotUrl && (
                <div>
                  <Label className="text-muted-foreground text-xs">Screenshot</Label>
                  <a href={screenshotUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
                    <img
                      src={screenshotUrl}
                      alt="Screenshot"
                      className="max-h-48 rounded border hover:opacity-80 transition-opacity"
                    />
                  </a>
                </div>
              )}
            </div>

            <Separator />

            {/* Replies */}
            <div className="space-y-4">
              <Label>Replies</Label>
              {repliesLoading ? (
                <p className="text-sm text-muted-foreground">Loading replies...</p>
              ) : replies?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No replies yet</p>
              ) : (
                <div className="space-y-3">
                  {replies?.map((reply) => (
                    <div
                      key={reply.id}
                      className={`p-3 rounded-lg ${
                        reply.is_admin_reply ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">{reply.user_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reply.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{reply.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Reply input */}
        <div className="flex-shrink-0 pt-4 border-t space-y-2">
          <Textarea
            placeholder="Write a reply..."
            value={replyMessage}
            onChange={(e) => setReplyMessage(e.target.value)}
            className="min-h-[80px]"
          />
          <Button 
            onClick={sendReply} 
            disabled={!replyMessage.trim() || isReplying}
            className="w-full"
          >
            {isReplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
