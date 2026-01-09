import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { PDFDocument, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  requestId: string;
  signatureDataUrl: string; // Base64 PNG data URL of signature
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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwtToken);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { requestId, signatureDataUrl }: RequestBody = await req.json();

    // Get the signature request and verify the user is the signer
    const { data: signatureRequest, error: requestError } = await supabase
      .from('signature_requests')
      .select('*, signature_spots(*)')
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

    // Verify the user is the designated signer
    if (signatureRequest.signer_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'You are not authorized to sign this document' }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if already signed
    if (signatureRequest.status === 'signed') {
      return new Response(
        JSON.stringify({ error: 'This document has already been signed' }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Check if expired
    if (new Date(signatureRequest.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'This signature request has expired' }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log('Processing signature for request:', requestId);

    // Download the original PDF from storage
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('signature-documents')
      .download(signatureRequest.original_pdf_path);

    if (downloadError || !pdfData) {
      console.error('Error downloading PDF:', downloadError);
      return new Response(
        JSON.stringify({ error: 'Failed to download original PDF' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Load the PDF
    const pdfBytes = await pdfData.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Convert signature data URL to image
    const signatureImageData = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
    const signatureBytes = Uint8Array.from(atob(signatureImageData), c => c.charCodeAt(0));
    const signatureImage = await pdfDoc.embedPng(signatureBytes);

    // Get signature spots and embed signature at each spot
    const spots = signatureRequest.signature_spots || [];
    console.log(`Embedding signature at ${spots.length} spots`);

    for (const spot of spots) {
      const pageIndex = (spot.page_number || 1) - 1; // Convert to 0-based index
      const pages = pdfDoc.getPages();
      
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Calculate actual position (spots are stored as percentages)
        const x = (spot.x_position / 100) * pageWidth;
        const y = pageHeight - (spot.y_position / 100) * pageHeight - spot.height;
        
        // Draw the signature
        page.drawImage(signatureImage, {
          x: x,
          y: y,
          width: spot.width,
          height: spot.height,
        });

        // Add signature date below
        const dateStr = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        page.drawText(`Signed: ${dateStr}`, {
          x: x,
          y: y - 12,
          size: 8,
          color: rgb(0.4, 0.4, 0.4),
        });
      }
    }

    // Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // Upload signed PDF to storage
    const signedPdfPath = signatureRequest.original_pdf_path.replace('.pdf', '_signed.pdf');
    const { error: uploadError } = await supabase.storage
      .from('signature-documents')
      .upload(signedPdfPath, signedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading signed PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Failed to save signed document' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Update the signature request status
    const { error: updateError } = await supabase
      .from('signature_requests')
      .update({
        status: 'signed',
        signed_pdf_path: signedPdfPath,
        signed_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('Error updating signature request:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update request status' }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get signer's name and document owner's info for notification
    const { data: signerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', signatureRequest.created_by)
      .single();

    // Send notification email to document owner
    if (ownerProfile?.email) {
      const appUrl = Deno.env.get("APP_BASE_URL") || 'https://dealergrowth.solutions';
      
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Dealer Growth Solutions <noreply@dealergrowth.solutions>",
          to: [ownerProfile.email],
          subject: `Document Signed - ${signatureRequest.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1f2937; border-bottom: 2px solid #22c55e; padding-bottom: 12px;">
                ✅ Document Signed
              </h1>
              
              <p style="color: #374151; margin-top: 16px;">
                Hello ${ownerProfile.full_name},
              </p>
              
              <p style="color: #374151;">
                <strong>${signerProfile?.full_name || 'A user'}</strong> has signed the document: <strong>${signatureRequest.title}</strong>
              </p>

              <div style="margin: 24px 0; padding: 16px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 4px;">
                <p style="color: #166534; margin: 0;">
                  <strong>Signed:</strong> ${new Date().toLocaleString('en-US', { 
                    dateStyle: 'full', 
                    timeStyle: 'short' 
                  })}
                </p>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${appUrl}/dashboard" 
                   style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  View in Dashboard
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                This is an automated message from Dealer Growth Solutions.
              </p>
            </div>
          `,
        }),
      });
    }

    console.log('Signature submitted successfully for request:', requestId);

    return new Response(JSON.stringify({ 
      success: true,
      signedPdfPath,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error submitting signature:", error);
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
