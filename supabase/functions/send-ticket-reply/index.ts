import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TicketReplyRequest {
  ticketId: string;
  message: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticketId, message }: TicketReplyRequest = await req.json();

    console.log("Fetching ticket for reply:", ticketId);

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

    console.log("Sending reply notification to:", ticket.user_email);

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <h1 style="margin: 0; font-size: 24px;">Reply to Ticket #${ticket.ticket_number}</h1>
    <p style="margin: 8px 0 0 0; opacity: 0.9;">${ticket.subject}</p>
  </div>
  
  <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
    <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <p style="margin: 0 0 16px 0; color: #64748b;">Hi ${ticket.user_name},</p>
      
      <p style="margin: 0 0 16px 0;">We've responded to your support ticket:</p>
      
      <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #0f172a;">
        <p style="margin: 0; white-space: pre-wrap;">${message}</p>
      </div>
      
      <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px;">
        If you have any further questions, please reply to your original ticket in the application.
      </p>
    </div>
  </div>
  
  <div style="text-align: center; padding: 16px; color: #64748b; font-size: 12px;">
    <p style="margin: 0;">Dealer Growth Solutions Support Team</p>
    <p style="margin: 8px 0 0 0;">This is an automated message. Please do not reply directly to this email.</p>
  </div>
</body>
</html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Dealer Growth Support <support@dealergrowth.solutions>",
      to: [ticket.user_email],
      subject: `Re: [Ticket #${ticket.ticket_number}] ${ticket.subject}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-ticket-reply:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
