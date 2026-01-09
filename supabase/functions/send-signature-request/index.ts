import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  requestId: string;
  signerEmail: string;
  signerName: string;
  title: string;
  message?: string;
  storeName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization token from the request
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Verify the user is authenticated
    const jwtToken = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(jwtToken);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if user has super_admin role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userRoles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (roleError) {
      console.error('Error fetching user roles:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const roles = userRoles?.map(r => r.role) || [];
    const isSuperAdmin = roles.includes('super_admin');

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Only super admins can send signature requests.' }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { requestId, signerEmail, signerName, title, message, storeName }: RequestBody = await req.json();

    console.log('Processing signature request:', { requestId, signerEmail, signerName, title });

    // Verify the signature request exists and get its access_token
    const { data: signatureRequest, error: requestError } = await supabase
      .from('signature_requests')
      .select('*, access_token')
      .eq('id', requestId)
      .single();

    if (requestError || !signatureRequest) {
      console.error('Error fetching signature request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Signature request not found' }),
        {
          status: 404,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get sender's name
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const senderName = senderProfile?.full_name || 'Your administrator';

    // Build the token-based signing URL (no login required)
    const appUrl = (Deno.env.get("APP_BASE_URL") || 'https://dealergrowth.solutions').replace(/\/+$/, '');
    const signatureUrl = `${appUrl}/sign/t/${signatureRequest.access_token}`;
    
    console.log('Generated token-based signature URL:', signatureUrl);

    // Send email notification
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Dealer Growth Solutions <noreply@dealergrowth.solutions>",
        to: [signerEmail],
        subject: `Signature Required - ${title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px;">
              Signature Required
            </h1>
            ${storeName ? `<p style="color: #6b7280; margin-top: 8px; font-size: 16px;"><strong>Store:</strong> ${storeName}</p>` : ''}
            
            <p style="color: #374151; margin-top: 16px;">
              Hello ${signerName},
            </p>
            
            <p style="color: #374151;">
              ${senderName} has requested your signature on the document: <strong>${title}</strong>
            </p>

            ${message ? `
              <div style="margin: 20px 0; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
                <p style="color: #374151; margin: 0; font-style: italic;">
                  "${message}"
                </p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 32px 0;">
              <a href="${signatureUrl}" 
                 style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                View & Sign Document
              </a>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              Or copy and paste this link into your browser:<br>
              <a href="${signatureUrl}" style="color: #2563eb; word-break: break-all;">${signatureUrl}</a>
            </p>

            <div style="margin-top: 24px; padding: 16px; background-color: #f3f4f6; border-radius: 8px;">
              <p style="color: #374151; margin: 0; font-size: 14px;">
                <strong>Note:</strong> This request will expire in 7 days. Please sign the document at your earliest convenience. No account is required to sign.
              </p>
            </div>

            <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
              This is an automated message from Dealer Growth Solutions.
            </p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      console.error('Resend API error:', errorData);
      throw new Error(`Resend API error: ${errorData}`);
    }

    const responseData = await emailResponse.json();
    console.log("Signature request email sent successfully:", responseData);

    return new Response(JSON.stringify({ 
      success: true,
      signatureUrl 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending signature request email:", error);
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
