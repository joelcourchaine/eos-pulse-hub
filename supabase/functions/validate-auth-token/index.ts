import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateTokenRequest {
  token: string;
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

    const requestBody: ValidateTokenRequest = await req.json();
    const { token } = requestBody;

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Validating auth token...');

    // Look up the token in auth_tokens table
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenRecord) {
      console.error('Token lookup failed:', tokenError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This link is invalid or has already been used. Please request a new invite.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      console.log('Token expired at:', tokenRecord.expires_at);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This link has expired. Please request a new invite.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Token valid for user:', tokenRecord.user_id, 'type:', tokenRecord.token_type);

    // Determine redirect URL based on token type
    const appUrl = 'https://dealergrowth.solutions';
    const redirectTo = tokenRecord.token_type === 'invite' 
      ? `${appUrl}/set-password` 
      : `${appUrl}/reset-password`;

    // Generate a fresh Supabase auth link (1-hour expiry, used immediately)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: tokenRecord.token_type === 'invite' ? 'invite' : 'recovery',
      email: tokenRecord.email,
      options: { redirectTo }
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating auth link:', linkError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate authentication link. Please try again.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('Fresh Supabase link generated successfully');

    // Mark the token as used
    const { error: updateError } = await supabaseAdmin
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error('Error marking token as used:', updateError);
      // Continue anyway - the link was generated successfully
    }

    console.log('Token marked as used, returning redirect URL');

    return new Response(
      JSON.stringify({
        success: true,
        redirect_url: linkData.properties.action_link,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in validate-auth-token function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
