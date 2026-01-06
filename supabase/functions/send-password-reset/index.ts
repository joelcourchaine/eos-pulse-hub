import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface PasswordResetRequest {
  email: string;
}

// Email template for password reset
function getPasswordResetEmailHtml(continueLink: string, directLink: string): string {
  return `
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
          .note { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 13px; color: #444; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">Dealer Growth Solutions</h1>
          </div>
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>We received a request to reset your password. Click the button below to continue and create a new password.</p>
            <div style="text-align: center;">
              <a href="${continueLink}" class="button">Reset Password</a>
            </div>

            <div class="note">
              <strong>Important:</strong> Some email providers pre-open links for security scanning, which can make one-time links appear “expired”.
              If you see an expired message, simply request a new reset link.
            </div>

            <p style="margin-top: 30px; color: #666; font-size: 14px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${continueLink}" style="color: #2563eb; word-break: break-all;">${continueLink}</a>
            </p>

            <p style="margin-top: 18px; color: #666; font-size: 12px;">
              Having trouble? You can also try the direct link (may expire if scanned):<br>
              <a href="${directLink}" style="color: #2563eb; word-break: break-all;">${directLink}</a>
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
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<void> {
  console.log(`Sending password reset email to ${to}`);
  
  const emailResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Dealer Growth Solutions <no-reply@dealergrowth.solutions>",
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!emailResponse.ok) {
    const errorData = await emailResponse.text();
    console.error("Resend API error:", errorData);
    throw new Error(`Failed to send email: ${errorData}`);
  }

  const data = await emailResponse.json();
  console.log("Email sent successfully via Resend:", data);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestBody: PasswordResetRequest = await req.json();
    const { email } = requestBody;

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing password reset request for email:', email);

    // Look up user in profiles table by email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (profileError || !profile) {
      // Don't reveal if user exists or not for security
      console.log('User not found, but returning success to prevent email enumeration');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link will be sent.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get user data from auth to verify they exist
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(profile.id);

    if (authUserError || !authUser.user) {
      console.error('Error fetching auth user:', authUserError);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'If an account exists with this email, a password reset link will be sent.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if auth email is masked (sandbox environment) and update it to real email
    const authEmail = authUser.user.email;
    if (authEmail && (authEmail.includes('@test.local') || authEmail.startsWith('user-'))) {
      console.log('Detected masked email in auth, updating to real email:', profile.email);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.id,
        { email: profile.email }
      );
      
      if (updateError) {
        console.error('Error updating user email:', updateError);
        // Continue anyway - might still work
      } else {
        console.log('Successfully updated auth email to:', profile.email);
      }
    }

    // Determine redirect URL for the app
    const appUrl = 'https://dealergrowth.solutions';

    // Generate password reset link using the real email
    console.log('Generating password reset link for:', profile.email);
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email, // Use real email from profiles
      options: {
        redirectTo: `${appUrl}/reset-password`
      }
    });

    if (linkError || !linkData) {
      console.error('Error generating recovery link:', linkError);
      throw new Error(linkError?.message || 'Failed to generate recovery link');
    }

    console.log('Recovery link generated successfully');
    
    // Send password reset email via Resend
    const directLink = linkData.properties.action_link;
    const continueLink = `${appUrl}/reset-password?continue=${encodeURIComponent(directLink)}`;

    await sendEmailViaResend(
      profile.email, // Use real email from profiles
      'Reset Your Password - Dealer Growth Solutions',
      getPasswordResetEmailHtml(continueLink, directLink)
    );

    console.log('Password reset email sent successfully to:', profile.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, a password reset link will be sent.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-password-reset function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
