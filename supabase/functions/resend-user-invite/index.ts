import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

interface ResendInviteRequest {
  user_id: string;
}

// Email template for invitations
function getInviteEmailHtml(continueLink: string, directLink: string): string {
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
            <h2>You've been invited</h2>
            <p>You've been invited to join the <strong>Growth Scorecard</strong> app.</p>
            <p>Click the button below to accept the invitation and create your account:</p>
            <div style="text-align: center;">
              <a href="${continueLink}" class="button">Accept Invitation</a>
            </div>

            <div class="note">
              <strong>Important:</strong> Some email providers pre-open links for security scanning, which can make one-time links appear “expired”.
              If you see an expired message, request a new invite from your administrator.
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
  console.log(`Sending email to ${to} with subject: ${subject}`);
  
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
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // SECURITY: Verify caller has super_admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized: Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Check if caller has super_admin or store_gm role
    const { data: callerRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['super_admin', 'store_gm']);

    const isSuperAdmin = callerRoles?.some(r => r.role === 'super_admin');
    const isStoreGM = callerRoles?.some(r => r.role === 'store_gm');

    if (roleError || (!isSuperAdmin && !isStoreGM)) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only super admins and store GMs can resend invites' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Authorization successful for user:', user.id, 'isSuperAdmin:', isSuperAdmin, 'isStoreGM:', isStoreGM);

    const requestBody: ResendInviteRequest = await req.json();
    const { user_id } = requestBody;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Processing invite/reset for user:', user_id);

    // If store_gm (not super_admin), verify the target user is in the same store group
    if (isStoreGM && !isSuperAdmin) {
      // Get caller's store group
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('store_group_id')
        .eq('id', user.id)
        .single();

      // Get target user's store group
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('store_group_id')
        .eq('id', user_id)
        .single();

      if (!callerProfile?.store_group_id || 
          callerProfile.store_group_id !== targetProfile?.store_group_id) {
        console.error('Store group mismatch - caller:', callerProfile?.store_group_id, 'target:', targetProfile?.store_group_id);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Forbidden: You can only resend invites for users in your store group' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
      }
      console.log('Store group verification passed');
    }

    // Get user data from auth
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (authUserError || !authUser.user) {
      console.error('Error fetching auth user:', authUserError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in auth system' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get real email from profiles table (auth email may be masked in sandbox)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.email) {
      console.error('Error fetching profile email:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'User email not found in profiles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const realEmail = profile.email;
    console.log(`Real email from profiles: ${realEmail}`);

    // Check if auth email is masked (sandbox environment) and update it to real email
    const authEmail = authUser.user.email;
    if (authEmail && (authEmail.includes('@test.local') || authEmail.startsWith('user-'))) {
      console.log('Detected masked email in auth, updating to real email:', realEmail);
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { email: realEmail }
      );
      
      if (updateError) {
        console.error('Error updating user email:', updateError);
        // Continue anyway - might still work
      } else {
        console.log('Successfully updated auth email to:', realEmail);
      }
    }

    // Check if user has confirmed their email
    const isConfirmed = authUser.user.email_confirmed_at != null;
    
    // Determine redirect URL for the app
    const appUrl = 'https://dealergrowth.solutions';

    if (isConfirmed) {
      // User is already active, generate password reset link
      console.log('User is already active, generating password reset link for:', realEmail);
      
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: realEmail, // Use real email from profiles
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
        realEmail,
        'Reset Your Password - Dealer Growth Solutions',
        getPasswordResetEmailHtml(continueLink, directLink)
      );

      console.log('Password reset email sent successfully to:', realEmail);
    } else {
      // User hasn't confirmed yet, try to generate invitation link
      console.log('User not confirmed, attempting to generate invitation link for:', realEmail);
      
      let actionLink: string;
      let linkType = 'invite';
      
      // Try invite first, fall back to recovery if user already exists
      const { data: inviteLinkData, error: inviteLinkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: realEmail,
        options: {
          redirectTo: `${appUrl}/set-password`
        }
      });

      if (inviteLinkError) {
        console.log('Invite link failed (user may already exist), trying recovery link:', inviteLinkError.message);
        
        // Fall back to recovery/password reset link
        const { data: recoveryLinkData, error: recoveryLinkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: realEmail,
          options: {
            redirectTo: `${appUrl}/set-password`
          }
        });

        if (recoveryLinkError || !recoveryLinkData) {
          console.error('Error generating recovery link:', recoveryLinkError);
          throw new Error(recoveryLinkError?.message || 'Failed to generate any auth link');
        }

        actionLink = recoveryLinkData.properties.action_link;
        linkType = 'recovery';
        console.log('Recovery link generated successfully as fallback');
      } else if (!inviteLinkData) {
        throw new Error('Failed to generate invite link - no data returned');
      } else {
        actionLink = inviteLinkData.properties.action_link;
        console.log('Invite link generated successfully');
      }
      
      // Send invitation email via Resend
      const directLink = actionLink;
      const continueLink = `${appUrl}/set-password?continue=${encodeURIComponent(directLink)}`;

      await sendEmailViaResend(
        realEmail,
        'Welcome to Dealer Growth Solutions - Set Your Password',
        getInviteEmailHtml(continueLink, directLink)
      );

      console.log(`${linkType} email sent successfully to:`, realEmail);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: isConfirmed ? 'Password reset email sent successfully' : 'Invitation email sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in resend-user-invite function:', error);
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
