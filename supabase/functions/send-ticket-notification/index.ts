import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supportEmail = Deno.env.get("SUPPORT_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketNotificationRequest {
  ticketId: string;
}

const priorityColors: Record<string, string> = {
  low: "#64748b",
  normal: "#3b82f6",
  urgent: "#ef4444",
};

const categoryLabels: Record<string, string> = {
  bug_report: "Bug Report",
  feature_request: "Feature Request",
  question: "Question",
  other: "Other",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticketId }: TicketNotificationRequest = await req.json();

    console.log("Fetching ticket:", ticketId);

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from("help_tickets")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("Error fetching ticket:", ticketError);
      throw new Error("Ticket not found");
    }

    console.log("Sending notification email for ticket #", ticket.ticket_number);

    const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://app.dealergrowth.solutions";
    const adminLink = `${appBaseUrl}/admin/tickets`;

    const priorityColor = priorityColors[ticket.priority] || "#3b82f6";
    const categoryLabel = categoryLabels[ticket.category] || ticket.category;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">New Support Ticket #${ticket.ticket_number}</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${categoryLabel}</p>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
        <span style="background: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase;">${ticket.priority} priority</span>
      </div>
      
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #0f172a;">${ticket.subject}</h2>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 120px;">User</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${ticket.user_name} (${ticket.user_email})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Page</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 13px;">${ticket.page_url || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Browser</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px;">${ticket.browser_info || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Created</td>
          <td style="padding: 8px 0;">${new Date(ticket.created_at).toLocaleString()}</td>
        </tr>
      </table>
      
      <div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #64748b; text-transform: uppercase;">Description</h3>
        <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; white-space: pre-wrap;">${ticket.description}</div>
      </div>
      
      ${ticket.error_message ? `
      <div style="margin-bottom: 20px; padding: 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px;">
        <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #dc2626; text-transform: uppercase;">Error Message</h3>
        <code style="font-size: 13px; color: #991b1b; word-break: break-all;">${ticket.error_message}</code>
        ${ticket.error_stack ? `
        <details style="margin-top: 12px;">
          <summary style="cursor: pointer; color: #dc2626; font-size: 13px;">Stack Trace</summary>
          <pre style="margin-top: 8px; font-size: 11px; overflow-x: auto; white-space: pre-wrap; word-break: break-all;">${ticket.error_stack}</pre>
        </details>
        ` : ""}
      </div>
      ` : ""}
      
      <a href="${adminLink}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">View in Admin Dashboard</a>
    </div>
  </div>
  
  <div style="text-align: center; padding: 16px; color: #64748b; font-size: 12px;">
    <p style="margin: 0;">Dealer Growth Solutions Support System</p>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Dealer Growth Support <support@dealergrowth.solutions>",
      to: [supportEmail!, "joelcourchaine@gmail.com"],
      subject: `[Ticket #${ticket.ticket_number}] ${ticket.subject}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
