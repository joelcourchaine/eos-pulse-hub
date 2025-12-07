import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnswerData {
  question_id: string;
  answer_value: string | null;
}

interface RequestBody {
  token: string;
  answers: AnswerData[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { token, answers }: RequestBody = await req.json();

    if (!token) {
      console.error('No token provided');
      return new Response(
        JSON.stringify({ error: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('questionnaire_tokens')
      .select('department_id, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired');
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate answers - sanitize and ensure they're safe
    const sanitizedAnswers = answers.map(answer => ({
      department_id: tokenData.department_id,
      question_id: answer.question_id,
      // Trim and limit answer length to prevent abuse
      answer_value: answer.answer_value ? 
        String(answer.answer_value).substring(0, 10000).trim() : 
        null,
    }));

    // Upsert answers using service role (bypasses RLS)
    const { error: upsertError } = await supabaseAdmin
      .from('department_answers')
      .upsert(sanitizedAnswers, {
        onConflict: 'department_id,question_id',
      });

    if (upsertError) {
      console.error('Error upserting answers:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save answers' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark token as used
    await supabaseAdmin
      .from('questionnaire_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    console.log('Questionnaire submitted successfully for department:', tokenData.department_id);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in questionnaire-submit:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
