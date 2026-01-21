import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateTokenRequest {
  token: string;
}

interface AuthToken {
  id: string;
  token: string;
  token_type: 'invite' | 'password_reset';
  user_id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { token }: ValidateTokenRequest = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Validating auth token...');

    // Look up the token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token not found:', tokenError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired token',
          code: 'TOKEN_NOT_FOUND'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const authToken = tokenData as AuthToken;

    // Check if already used
    if (authToken.used_at) {
      console.log('Token already used at:', authToken.used_at);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This link has already been used',
          code: 'TOKEN_ALREADY_USED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if expired
    const expiresAt = new Date(authToken.expires_at);
    if (expiresAt < new Date()) {
      console.log('Token expired at:', authToken.expires_at);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'This link has expired',
          code: 'TOKEN_EXPIRED',
          email: authToken.email
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Token valid, generating fresh Supabase link for:', authToken.email);

    // Mark token as used immediately (prevents race conditions)
    const { error: updateError } = await supabaseAdmin
      .from('auth_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', authToken.id);

    if (updateError) {
      console.error('Error marking token as used:', updateError);
      // Continue anyway - better to let user in than lock them out
    }

    // Get origin for redirect URL
    const referer = req.headers.get('referer') || '';
    const origin = referer ? new URL(referer).origin : 'https://dealergrowth.solutions';

    // Generate fresh Supabase auth link based on token type
    let linkResult;
    if (authToken.token_type === 'invite') {
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: authToken.email,
        options: {
          redirectTo: `${origin}/set-password`,
        },
      });
    } else {
      // password_reset
      linkResult = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: authToken.email,
        options: {
          redirectTo: `${origin}/reset-password`,
        },
      });
    }

    if (linkResult.error || !linkResult.data?.properties?.action_link) {
      console.error('Error generating fresh auth link:', linkResult.error);
      
      // Rollback: unmark token as used so user can try again
      await supabaseAdmin
        .from('auth_tokens')
        .update({ used_at: null })
        .eq('id', authToken.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to generate authentication link. Please try again.',
          code: 'LINK_GENERATION_FAILED'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const freshAuthLink = linkResult.data.properties.action_link;
    console.log('Fresh auth link generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        redirectUrl: freshAuthLink,
        tokenType: authToken.token_type,
        email: authToken.email,
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
