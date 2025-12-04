import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ComparisonMetric {
  metricName: string;
  storeValues: Record<string, { value: number | null; target: number | null; variance: number | null }>;
}

interface StoreInfo {
  storeId: string;
  storeName: string;
  monthsWithData: string[];
  lastCompleteMonth: string | null;
  isComplete: boolean;
}

interface EmailRequest {
  recipientEmails: string[];
  stores: StoreInfo[];
  metrics: ComparisonMetric[];
  selectedMetrics: string[];
  datePeriodType: string;
  selectedMonth?: string;
  selectedYear?: number;
  startMonth?: string;
  endMonth?: string;
  comparisonMode: string;
}

function formatValue(value: number | null, metricName: string): string {
  if (value === null || value === undefined) return "-";
  
  // Check if it's a percentage metric
  if (metricName.includes("%") || metricName.toLowerCase().includes("percent")) {
    return `${value.toFixed(1)}%`;
  }
  
  // Format as currency for dollar metrics
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getVarianceColor(variance: number | null): string {
  if (variance === null) return "";
  if (variance >= 10) return "background-color: #dcfce7;"; // Green
  if (variance >= -10) return "background-color: #fef9c3;"; // Yellow
  return "background-color: #fee2e2;"; // Red
}

function formatMonthShort(month: string): string {
  const date = new Date(month + '-15');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Dealer Comparison Email function called ===");
  
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
      metrics,
      selectedMetrics,
      datePeriodType,
      selectedMonth,
      selectedYear,
      startMonth,
      endMonth,
      comparisonMode 
    }: EmailRequest = await req.json();

    console.log("Sending dealer comparison email to:", recipientEmails);
    console.log("Stores:", stores.length, "Metrics:", selectedMetrics.length);

    // Build period description
    let periodDescription = "";
    if (datePeriodType === "month" && selectedMonth) {
      periodDescription = formatMonthShort(selectedMonth);
    } else if (datePeriodType === "full_year" && selectedYear) {
      periodDescription = `Full Year ${selectedYear}`;
    } else if (datePeriodType === "custom_range" && startMonth && endMonth) {
      periodDescription = `${formatMonthShort(startMonth)} - ${formatMonthShort(endMonth)}`;
    }

    // Build comparison mode description
    let comparisonDescription = "";
    if (comparisonMode === "targets") comparisonDescription = "vs Store Targets";
    else if (comparisonMode === "current_year_avg") comparisonDescription = "vs Current Year Average";
    else if (comparisonMode === "previous_year") comparisonDescription = "vs Previous Year";

    // Build HTML email
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; }
          th { background-color: #f8f8f8; font-weight: 600; }
          th.metric { text-align: left; }
          td.metric { text-align: left; font-weight: 500; }
          .store-header { min-width: 180px; }
          .data-status { font-size: 11px; color: #888; font-weight: normal; margin-top: 4px; }
          .data-complete { color: #16a34a; }
          .data-incomplete { color: #ca8a04; }
          .variance-badge { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 11px; 
            font-weight: 500;
            margin-top: 4px;
          }
          .variance-green { background-color: #dcfce7; color: #166534; }
          .variance-yellow { background-color: #fef9c3; color: #854d0e; }
          .variance-red { background-color: #fee2e2; color: #991b1b; }
          .value { font-size: 15px; font-weight: 600; }
          .target { font-size: 11px; color: #888; margin-top: 2px; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <h1>Dealer Comparison Report</h1>
        <p class="subtitle">
          ${periodDescription} • ${comparisonDescription} • ${stores.length} stores compared
        </p>
        
        <table>
          <thead>
            <tr>
              <th class="metric">Metric</th>
    `;

    // Add store headers with data completeness
    stores.forEach(store => {
      const statusClass = store.isComplete ? 'data-complete' : 'data-incomplete';
      const statusText = store.lastCompleteMonth 
        ? `Thru ${formatMonthShort(store.lastCompleteMonth)}`
        : 'No data';
      
      html += `
        <th class="store-header">
          ${store.storeName}
          ${datePeriodType !== "month" ? `<div class="data-status ${statusClass}">${statusText}</div>` : ''}
        </th>
      `;
    });

    html += `</tr></thead><tbody>`;

    // Add metric rows
    selectedMetrics.forEach(metricName => {
      const metricData = metrics.find(m => m.metricName === metricName);
      
      html += `<tr><td class="metric">${metricName}</td>`;
      
      stores.forEach(store => {
        const storeValue = metricData?.storeValues[store.storeId];
        
        if (storeValue && storeValue.value !== null) {
          let varianceClass = "";
          if (storeValue.variance !== null) {
            if (storeValue.variance >= 10) varianceClass = "variance-green";
            else if (storeValue.variance >= -10) varianceClass = "variance-yellow";
            else varianceClass = "variance-red";
          }
          
          html += `
            <td>
              <div class="value">${formatValue(storeValue.value, metricName)}</div>
              ${storeValue.target !== null ? `<div class="target">Target: ${formatValue(storeValue.target, metricName)}</div>` : ''}
              ${storeValue.variance !== null ? `<span class="variance-badge ${varianceClass}">${storeValue.variance >= 0 ? '+' : ''}${storeValue.variance.toFixed(1)}%</span>` : ''}
            </td>
          `;
        } else {
          html += `<td style="color: #999;">No data</td>`;
        }
      });
      
      html += `</tr>`;
    });

    html += `
          </tbody>
        </table>
        
        <div class="footer">
          <p>This report was generated by the Growth Scorecard application.</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

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
        subject: `Dealer Comparison Report - ${periodDescription}`,
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
    console.error("Error sending dealer comparison email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
