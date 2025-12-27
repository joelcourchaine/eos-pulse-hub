import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface StoreData {
  id: string;
  name: string;
}

interface EmailRequest {
  recipientEmails: string[];
  stores: StoreData[];
  months: string[];
  selectedMetrics: string[];
  processedData: Record<string, Record<string, Record<string, number | null>>>;
  startMonth: string;
  endMonth: string;
  brandDisplayName: string;
  filterName?: string;
}

function formatValue(value: number | null, metricName: string): string {
  if (value === null || value === undefined) return "-";
  
  const lowerName = metricName.toLowerCase();
  if (metricName.includes("%") || lowerName.includes("percent")) {
    return `${value.toFixed(1)}%`;
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthShort(month: string): string {
  const date = new Date(month + '-15');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Trend Report Email function called ===");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Unauthorized");
    }

    const { 
      recipientEmails, 
      stores,
      months,
      selectedMetrics,
      processedData,
      startMonth,
      endMonth,
      brandDisplayName,
      filterName,
    }: EmailRequest = await req.json();

    console.log("Sending trend report email to:", recipientEmails);
    console.log("Stores:", stores.length, "Months:", months.length, "Metrics:", selectedMetrics.length);

    const reportTitle = filterName || "Fixed Combined Monthly Trend Report";
    const periodDescription = `${formatMonthShort(startMonth)} to ${formatMonthShort(endMonth)}`;

    // Build email HTML
    let html = `
      <!DOCTYPE html>
      <html>
      <head></head>
      <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
        <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
          <strong>${brandDisplayName}</strong> • ${stores.length} stores • ${periodDescription}
        </p>
    `;

    // Generate a table for each store
    for (const store of stores) {
      const storeData = processedData[store.id];
      if (!storeData) continue;

      html += `
        <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">
          ${store.name} - Fixed Combined
        </h2>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 12px;">
          <thead>
            <tr>
              <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f8f8f8; font-weight: 600; min-width: 150px;">Metric</th>
      `;

      // Month headers
      for (const month of months) {
        html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f8f8f8; font-weight: 600;">${formatMonthShort(month)}</th>`;
      }
      
      // Total header
      html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #e0e0e0; font-weight: 600;">Total</th>`;
      html += `</tr></thead><tbody>`;

      // Metric rows
      for (const metricName of selectedMetrics) {
        const metricData = storeData[metricName] as Record<string, number | null> | undefined;
        
        html += `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 500;">${metricName}</td>`;
        
        const values: number[] = [];
        for (const month of months) {
          const value = metricData?.[month] ?? null;
          if (value !== null) values.push(value);
          html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatValue(value, metricName)}</td>`;
        }
        
        // Calculate total/average
        const isPercentage = metricName.includes("%") || metricName.toLowerCase().includes("percent");
        const total = values.length > 0 
          ? isPercentage 
            ? values.reduce((sum, v) => sum + v, 0) / values.length 
            : values.reduce((sum, v) => sum + v, 0)
          : null;
        
        html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 600; background-color: #f0f0f0;">${formatValue(total, metricName)}</td>`;
        html += `</tr>`;
      }

      html += `</tbody></table>`;
    }

    html += `
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
          <p>This report was generated by the Growth Scorecard application.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    const emailSubject = filterName 
      ? `${filterName} - ${brandDisplayName} - ${periodDescription}`
      : `Fixed Combined Trend Report - ${brandDisplayName} - ${periodDescription}`;

    // Send email using Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Growth Scorecard <reports@dealergrowth.solutions>",
        to: recipientEmails,
        subject: emailSubject,
        html,
      }),
    });

    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error sending trend report email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);