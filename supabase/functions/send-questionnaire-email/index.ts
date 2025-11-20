import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Question {
  id: string;
  question_text: string;
  question_category: string;
  answer_type: string;
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

    // Group questions by category
    const groupedQuestions = questions.reduce((acc, q) => {
      if (!acc[q.question_category]) {
        acc[q.question_category] = [];
      }
      acc[q.question_category].push(q);
      return acc;
    }, {} as Record<string, Question[]>);

    // Generate HTML for questions
    let questionsHtml = "";
    Object.entries(groupedQuestions).forEach(([category, categoryQuestions]) => {
      questionsHtml += `
        <h3 style="color: #1f2937; margin-top: 24px; margin-bottom: 12px;">${category}</h3>
      `;
      categoryQuestions.forEach((q) => {
        questionsHtml += `
          <div style="margin-bottom: 16px;">
            <p style="font-weight: 500; margin-bottom: 4px;">${q.question_text}</p>
            <p style="color: #6b7280; font-size: 14px;">Answer: ___________________________________________</p>
          </div>
        `;
      });
    });

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
            Please review and answer the following questions:
          </p>

          ${questionsHtml}

          <div style="margin-top: 32px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
            <p style="color: #374151; margin: 0;">
              <strong>Note:</strong> Please reply to this email with your answers, or log into the system 
              to update the information directly.
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

    return new Response(JSON.stringify(responseData), {
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
