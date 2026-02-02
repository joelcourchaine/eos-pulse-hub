import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  user_id?: string;
  email?: string;
  token_type?: string;
  action_link?: string;
  error?: 'expired' | 'already_used' | 'invalid';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client (no auth required for this endpoint)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const requestBody: ValidateTokenRequest = await req.json();
    const { token } = requestBody;

    if (!token) {
      const response: ValidateTokenResponse = { valid: false, error: 'invalid' };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Validating auth token...');

    // Query auth_tokens table for the token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('auth_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      console.log('Token not found in database');
      const response: ValidateTokenResponse = { valid: false, error: 'invalid' };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if token has been used
    if (tokenRecord.used_at) {
      console.log('Token has already been used');
      const response: ValidateTokenResponse = { valid: false, error: 'already_used' };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(tokenRecord.expires_at);
    if (expiresAt < new Date()) {
      console.log('Token has expired');
      const response: ValidateTokenResponse = { valid: false, error: 'expired' };
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Token is valid - return details including action_link
    console.log('Token is valid for user:', tokenRecord.user_id);
    
    const response: ValidateTokenResponse = {
      valid: true,
      user_id: tokenRecord.user_id,
      email: tokenRecord.email,
      token_type: tokenRecord.token_type,
      action_link: tokenRecord.action_link
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Error in validate-auth-token function:', error);
    const response: ValidateTokenResponse = { valid: false, error: 'invalid' };
    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
