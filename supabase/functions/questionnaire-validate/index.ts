import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Question {
  id: string;
  question_text: string;
  answer_type: string;
  answer_description: string | null;
  reference_image_url: string | null;
  question_category: string;
  display_order: number;
}

interface Answer {
  question_id: string;
  answer_value: string | null;
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
    
    const { token } = await req.json();

    if (!token) {
      console.error('No token provided');
      return new Response(
        JSON.stringify({ error: 'Token is required', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token and get department info
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('questionnaire_tokens')
      .select('department_id, expires_at')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.error('Invalid token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      console.error('Token expired');
      return new Response(
        JSON.stringify({ error: 'Token has expired', valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get department info
    const { data: departmentData, error: departmentError } = await supabaseAdmin
      .from('departments')
      .select('id, name, department_type_id')
      .eq('id', tokenData.department_id)
      .single();

    if (departmentError || !departmentData) {
      console.error('Department not found:', departmentError);
      return new Response(
        JSON.stringify({ error: 'Department not found', valid: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active questions
    const { data: questionsData, error: questionsError } = await supabaseAdmin
      .from('department_questions')
      .select('id, question_text, answer_type, answer_description, reference_image_url, question_category, display_order')
      .eq('is_active', true)
      .order('display_order');

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to load questions', valid: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing answers for this department
    const { data: answersData, error: answersError } = await supabaseAdmin
      .from('department_answers')
      .select('question_id, answer_value')
      .eq('department_id', tokenData.department_id);

    if (answersError) {
      console.error('Error fetching answers:', answersError);
      // Continue without answers - they're optional
    }

    // Convert answers to a map
    const answersMap: Record<string, string> = {};
    answersData?.forEach((answer: Answer) => {
      answersMap[answer.question_id] = answer.answer_value || "";
    });

    console.log('Questionnaire validated successfully for department:', departmentData.name);

    return new Response(
      JSON.stringify({
        valid: true,
        departmentName: departmentData.name,
        departmentId: departmentData.id,
        questions: questionsData || [],
        answers: answersMap,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in questionnaire-validate:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', valid: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
