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
  requestId?: string;
  accessToken?: string;
  signatureDataUrl: string; // Base64 PNG data URL of signature
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { requestId, accessToken, signatureDataUrl }: RequestBody = await req.json();

    let signatureRequest: any;

    // Support both token-based (external) and ID-based (authenticated) access
    if (accessToken) {
      // Token-based access - no authentication required
      console.log('Token-based signature submission for token:', accessToken);
      
      const { data, error: requestError } = await supabase
        .rpc('get_signature_request_by_token', { p_token: accessToken });

      if (requestError || !data || data.length === 0) {
        console.error('Error fetching signature request by token:', requestError);
        return new Response(
          JSON.stringify({ error: 'Signature request not found or invalid token' }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      signatureRequest = data[0];

      // Get signature spots using the RPC function
      const { data: spots, error: spotsError } = await supabase
        .rpc('get_signature_spots_by_request', { p_request_id: signatureRequest.id });

      if (spotsError) {
        console.error('Error fetching signature spots:', spotsError);
      }

      signatureRequest.signature_spots = spots || [];

    } else if (requestId) {
      // ID-based access - requires authentication
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

      const jwtToken = authHeader.replace('Bearer ', '');
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

      // Get the signature request
      const { data, error: requestError } = await supabase
        .from('signature_requests')
        .select('*, signature_spots(*)')
        .eq('id', requestId)
        .single();

      if (requestError || !data) {
        console.error('Error fetching signature request:', requestError);
        return new Response(
          JSON.stringify({ error: 'Signature request not found' }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Verify the user is the designated signer (for legacy requests with signer_id)
      if (data.signer_id && data.signer_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'You are not authorized to sign this document' }),
          {
            status: 403,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      signatureRequest = data;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either requestId or accessToken is required' }),
        {
          status: 400,
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

    console.log('Processing signature for request:', signatureRequest.id);

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

    // Get the signature image's natural aspect ratio
    const sigNaturalWidth = signatureImage.width;
    const sigNaturalHeight = signatureImage.height;
    const sigAspectRatio = sigNaturalWidth / sigNaturalHeight;

    for (const spot of spots) {
      const pageIndex = (spot.page_number || 1) - 1; // Convert to 0-based index
      const pages = pdfDoc.getPages();
      
      if (pageIndex >= 0 && pageIndex < pages.length) {
        const page = pages[pageIndex];
        const { width: pageWidth, height: pageHeight } = page.getSize();
        
        // Calculate actual position
        // x_position / y_position are stored as percentages of the page.
        // width/height are stored as percentages for newer requests, but may be legacy pixel values for older ones.
        const centerX = (spot.x_position / 100) * pageWidth;
        const centerY = (spot.y_position / 100) * pageHeight;

        const isPercentSize = Number(spot.width) <= 100 && Number(spot.height) <= 100;
        const boxWidth = isPercentSize ? (Number(spot.width) / 100) * pageWidth : Number(spot.width);
        const boxHeight = isPercentSize ? (Number(spot.height) / 100) * pageHeight : Number(spot.height);

        // Scale signature to fit within box while preserving aspect ratio
        let drawWidth = boxWidth;
        let drawHeight = boxWidth / sigAspectRatio;

        // If height exceeds box, scale down by height instead
        if (drawHeight > boxHeight) {
          drawHeight = boxHeight;
          drawWidth = boxHeight * sigAspectRatio;
        }

        // Center the signature within the box
        const x = centerX - (drawWidth / 2);
        const y = pageHeight - centerY - (drawHeight / 2);

        console.log(
          `Spot ${spot.id}: page=${pageIndex + 1}/${pages.length}, center=(${spot.x_position}%, ${spot.y_position}%), box=(${boxWidth.toFixed(1)}x${boxHeight.toFixed(1)}), draw=(${drawWidth.toFixed(1)}x${drawHeight.toFixed(1)}), pos=(${x.toFixed(1)},${y.toFixed(1)})`
        );

        // Draw the signature
        page.drawImage(signatureImage, {
          x,
          y,
          width: drawWidth,
          height: drawHeight,
        });

        // Add signature date below
        const dateStr = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        page.drawText(`Signed: ${dateStr}`, {
          x,
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

    // Deno TS can treat Uint8Array.buffer as ArrayBufferLike (SharedArrayBuffer),
    // so we copy into a real ArrayBuffer to satisfy BlobPart typing.
    const signedPdfArray = signedPdfBytes instanceof Uint8Array
      ? signedPdfBytes
      : new Uint8Array(signedPdfBytes);
    const ab = new ArrayBuffer(signedPdfArray.byteLength);
    new Uint8Array(ab).set(signedPdfArray);
    const signedPdfBlob = new Blob([ab], { type: 'application/pdf' });

    const { error: uploadError } = await supabase.storage
      .from('signature-documents')
      .upload(signedPdfPath, signedPdfBlob, {
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
      .eq('id', signatureRequest.id);

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

    // Get signer's name for notification
    const signerName = signatureRequest.signer_name || 'A user';

    // For token-based access, we need to fetch the full signature request to get created_by
    let creatorId = signatureRequest.created_by;
    if (!creatorId && signatureRequest.id) {
      const { data: fullRequest } = await supabase
        .from('signature_requests')
        .select('created_by')
        .eq('id', signatureRequest.id)
        .single();
      creatorId = fullRequest?.created_by;
    }

    // Get document owner's info for notification
    let ownerEmail: string | null = null;
    let ownerName: string | null = null;
    
    if (creatorId) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', creatorId)
        .single();
      ownerEmail = ownerProfile?.email || null;
      ownerName = ownerProfile?.full_name || null;
    }

    // Send notification email to document owner
    if (RESEND_API_KEY && ownerEmail) {
      const appUrl = (Deno.env.get("APP_BASE_URL") || 'https://dealergrowth.solutions').replace(/\/+$/, '');
      
      console.log(`Sending signature notification email to: ${ownerEmail}`);
      
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Dealer Growth Solutions <noreply@dealergrowth.solutions>",
            to: [ownerEmail],
            subject: `Document Signed - ${signatureRequest.title}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #1f2937; border-bottom: 2px solid #22c55e; padding-bottom: 12px;">
                  ✅ Document Signed
                </h1>
                
                <p style="color: #374151; margin-top: 16px;">
                  Hello ${ownerName || 'Admin'},
                </p>
                
                <p style="color: #374151;">
                  <strong>${signerName}</strong> has signed the document: <strong>${signatureRequest.title}</strong>
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
                  <a href="${appUrl}/admin/signatures" 
                     style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                    View Signature Requests
                  </a>
                </div>

                <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                  This is an automated message from Dealer Growth Solutions.
                </p>
              </div>
            `,
          }),
        });
        
        const emailResult = await emailResponse.json();
        console.log('Email notification result:', emailResult);
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
        // Don't fail the signature process if email fails
      }
    } else {
      console.log('Skipping email notification - missing RESEND_API_KEY or owner email');
    }

    console.log('Signature submitted successfully for request:', signatureRequest.id);

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
