import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Question {
  id: string;
  question_text: string;
  question_category: string;
  answer_type: string;
  reference_image_url?: string;
}

interface RequestBody {
  departmentId: string;
  departmentName: string;
  managerEmail: string;
  questions: Question[];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { departmentId, departmentName, managerEmail, questions }: RequestBody = await req.json();

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Generate secure token
    const token = crypto.randomUUID();
    
    // Set token expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store token in database
    const { error: tokenError } = await supabase
      .from('questionnaire_tokens')
      .insert({
        token,
        department_id: departmentId,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error('Error creating token:', tokenError);
      throw new Error('Failed to create questionnaire token');
    }

    // Generate questionnaire URL using the request origin
    // This ensures it works both in preview and production
    const referer = req.headers.get('referer') || '';
    let appUrl = '';
    
    if (referer) {
      // Extract origin from referer
      const url = new URL(referer);
      appUrl = url.origin;
    } else {
      // Fallback to using the Supabase URL pattern
      appUrl = SUPABASE_URL.replace('.supabase.co', '.lovableproject.com');
    }
    
    const questionnaireUrl = `${appUrl}/questionnaire/${token}`;
    
    console.log('Generated questionnaire URL:', questionnaireUrl);

    // Group questions by category
    const groupedQuestions = questions.reduce((acc, q) => {
      if (!acc[q.question_category]) {
        acc[q.question_category] = [];
      }
      acc[q.question_category].push(q);
      return acc;
    }, {} as Record<string, Question[]>);

    // Generate HTML for questions preview (first 3 questions)
    let questionsPreviewHtml = "";
    const previewQuestions = questions.slice(0, 3);
    previewQuestions.forEach((q) => {
      questionsPreviewHtml += `
        <li style="margin-bottom: 16px; color: #374151;">
          ${q.question_text}
          ${q.reference_image_url ? `<br><img src="${q.reference_image_url}" alt="Reference image" style="max-width: 300px; margin-top: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">` : ''}
        </li>
      `;
    });
    if (questions.length > 3) {
      questionsPreviewHtml += `
        <li style="color: #6b7280; font-style: italic;">...and ${questions.length - 3} more questions</li>
      `;
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Department Management <onboarding@resend.dev>",
        to: [managerEmail],
        subject: `Department Information Request - ${departmentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
              Department Information Request
            </h1>
            
            <p style="color: #374151; margin-top: 16px;">
              Hello,
            </p>
            
            <p style="color: #374151;">
              We need you to provide information about <strong>${departmentName}</strong>. 
              Please click the button below to fill out the questionnaire online:
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${questionnaireUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Fill Out Questionnaire
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              Or copy and paste this link into your browser:<br>
              <a href="${questionnaireUrl}" style="color: #2563eb; word-break: break-all;">${questionnaireUrl}</a>
            </p>

            <div style="margin-top: 24px; padding: 16px; background-color: #f9fafb; border-left: 4px solid #2563eb; border-radius: 4px;">
              <p style="color: #374151; margin: 0 0 8px 0; font-weight: 500;">
                Questions Preview:
              </p>
              <ul style="margin: 0; padding-left: 20px;">
                ${questionsPreviewHtml}
              </ul>
            </div>

            <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
              <p style="color: #374151; margin: 0; font-size: 14px;">
                <strong>Note:</strong> This link will expire in 7 days. You can edit your answers anytime before the link expires.
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              This is an automated message from your department management system.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    const responseData = await emailResponse.json();

    console.log("Questionnaire email sent successfully:", responseData);

    return new Response(JSON.stringify({ 
      ...responseData, 
      questionnaireUrl 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending questionnaire email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);