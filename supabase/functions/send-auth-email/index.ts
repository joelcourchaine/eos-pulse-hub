import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SEND_EMAIL_HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

interface AuthEmailRequest {
  user: {
    email: string;
    id: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Verify webhook signature
    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);
    
    let parsedPayload: AuthEmailRequest;
    
    if (SEND_EMAIL_HOOK_SECRET) {
      const wh = new Webhook(SEND_EMAIL_HOOK_SECRET);
      parsedPayload = wh.verify(payload, headers) as AuthEmailRequest;
    } else {
      // Fallback if no secret is configured (for development)
      console.warn("No SEND_EMAIL_HOOK_SECRET configured - webhook verification skipped");
      parsedPayload = JSON.parse(payload);
    }

    const { user, email_data } = parsedPayload;
    const { email_action_type, token_hash, redirect_to } = email_data;

    // Look up the REAL email from profiles table (auth email may be masked in sandbox)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let realEmail = user.email;
    
    // Check if this is a masked test email and look up real email from profiles
    if (user.email.includes('@test.local') || user.email.startsWith('user-')) {
      console.log(`Detected masked email ${user.email}, looking up real email for user ${user.id}`);
      
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else if (profile?.email) {
        realEmail = profile.email;
        console.log(`Found real email: ${realEmail}`);
      }
    }

    let subject = "";
    let html = "";

    const baseUrl = supabaseUrl;
    const actionLink = `${baseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`;

    if (email_action_type === "invite" || email_action_type === "signup") {
      subject = "Welcome to Dealer Growth Solutions - Set Your Password";
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a1a1a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .button:hover { background-color: #1d4ed8; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Dealer Growth Solutions</h1>
              </div>
              <div class="content">
                <h2>You've been invited</h2>
                <p>You've been invited to join the <strong>Growth Scorecard</strong> app.</p>
                <p>Click the button below to accept the invitation and create your account:</p>
                <div style="text-align: center;">
                  <a href="${actionLink}" class="button">Accept Invitation</a>
                </div>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${actionLink}" style="color: #2563eb; word-break: break-all;">${actionLink}</a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  This link will expire in 24 hours for security reasons.
                </p>
                <p style="margin-top: 20px; color: #999; font-size: 13px;">
                  If you weren't expecting this invitation, you can safely ignore this email.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Dealer Growth Solutions. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (email_action_type === "recovery") {
      subject = "Reset Your Password - Dealer Growth Solutions";
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a1a1a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .button:hover { background-color: #1d4ed8; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Dealer Growth Solutions</h1>
              </div>
              <div class="content">
                <h2>Password Reset Request</h2>
                <p>We received a request to reset your password. Click the button below to create a new password.</p>
                <div style="text-align: center;">
                  <a href="${actionLink}" class="button">Reset Password</a>
                </div>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${actionLink}" style="color: #2563eb; word-break: break-all;">${actionLink}</a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                  This link will expire in 1 hour for security reasons.
                </p>
                <p style="margin-top: 20px; color: #999; font-size: 13px;">
                  If you didn't request a password reset, you can safely ignore this email.
                </p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Dealer Growth Solutions. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else {
      subject = "Action Required - Dealer Growth Solutions";
      html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a1a1a; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Dealer Growth Solutions</h1>
              </div>
              <div class="content">
                <h2>Action Required</h2>
                <p>Please click the button below to proceed.</p>
                <div style="text-align: center;">
                  <a href="${actionLink}" class="button">Take Action</a>
                </div>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} Dealer Growth Solutions. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    console.log(`Sending ${email_action_type} email to ${realEmail} (original: ${user.email})`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Dealer Growth Solutions <no-reply@dealergrowth.solutions>",
        to: [realEmail],
        subject: subject,
        html: html,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error("Error sending email:", errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const data = await emailResponse.json();
    console.log("Email sent successfully:", data);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({ 
        error: {
          http_code: error.code || 500,
          message: error.message
        }
      }),
      {
        status: error.code || 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
