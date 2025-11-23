import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResendInviteRequest {
  user_id: string;
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

    // Check if caller has super_admin role
    const { data: callerRoles, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin');

    if (roleError || !callerRoles || callerRoles.length === 0) {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Forbidden: Only super admins can resend invites' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('Authorization successful for user:', user.id);

    const requestBody: ResendInviteRequest = await req.json();
    const { user_id } = requestBody;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Resending invitation for user:', user_id);

    // Get user data from auth
    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (authUserError || !authUser.user) {
      console.error('Error fetching auth user:', authUserError);
      return new Response(
        JSON.stringify({ success: false, error: 'User not found in auth system' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const userEmail = authUser.user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: false, error: 'User has no email address' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user has confirmed their email
    const isConfirmed = authUser.user.email_confirmed_at != null;

    if (isConfirmed) {
      // User is already active, send password reset email instead
      console.log('User is already active, sending password reset email to:', userEmail);
      
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
        userEmail,
        {
          redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/reset-password`
        }
      );

      if (resetError) {
        console.error('Error sending password reset:', resetError);
        throw resetError;
      }

      console.log('Password reset email sent successfully to:', userEmail);
    } else {
      // User hasn't confirmed yet, resend invitation
      console.log('User not confirmed, resending invitation to:', userEmail);
      
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        userEmail,
        {
          redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/reset-password`
        }
      );

      if (inviteError) {
        console.error('Error resending invitation:', inviteError);
        throw inviteError;
      }

      console.log('Invitation resent successfully to:', userEmail);
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
