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
  departmentName?: string;
  monthsWithData: string[];
  lastCompleteMonth: string | null;
  isComplete: boolean;
}

interface QuestionnaireAnswer {
  storeName: string;
  departmentName: string;
  questionText: string;
  answerValue: string | null;
}

interface EmailRequest {
  recipientEmails: string[];
  stores: StoreInfo[];
  metrics: ComparisonMetric[];
  questionnaireData?: QuestionnaireAnswer[];
  metricType?: string;
  selectedMetrics: string[];
  datePeriodType: string;
  selectedMonth?: string;
  selectedYear?: number;
  startMonth?: string;
  endMonth?: string;
  comparisonMode: string;
  filterName?: string;
  brandDisplayName?: string;
}

function formatValue(value: number | null, metricName: string): string {
  if (value === null || value === undefined) return "-";
  
  // Percentage metrics that don't have % in their name
  const percentageMetrics = [
    "Return on Gross",
    "Service Absorption",
    "Parts to Service Ratio",
  ];
  
  // Check if it's a percentage metric
  const lowerName = metricName.toLowerCase();
  if (
    metricName.includes("%") || 
    lowerName.includes("percent") ||
    percentageMetrics.some(m => lowerName === m.toLowerCase())
  ) {
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
      questionnaireData,
      metricType,
      selectedMetrics,
      datePeriodType,
      selectedMonth,
      selectedYear,
      startMonth,
      endMonth,
      comparisonMode,
      filterName,
      brandDisplayName,
    }: EmailRequest = await req.json();

    console.log("Sending dealer comparison email to:", recipientEmails);
    console.log("Metric type:", metricType);
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

    // Build title based on filter name
    const reportTitle = filterName ? filterName : (metricType === "dept_info" ? "Service Dept Info Comparison" : "Dealer Comparison Report");
    const brandLine = brandDisplayName || "All Brands";

    let html = "";

    if (metricType === "dept_info" && questionnaireData && questionnaireData.length > 0) {
      // Build questionnaire comparison email
      console.log("Building questionnaire email with", questionnaireData.length, "answers");
      
      // Group data by store+department
      const storeMap = new Map<string, { storeName: string; departmentName: string; answers: Map<string, string | null> }>();
      
      questionnaireData.forEach((item: QuestionnaireAnswer) => {
        const key = `${item.storeName}|${item.departmentName}`;
        if (!storeMap.has(key)) {
          storeMap.set(key, {
            storeName: item.storeName,
            departmentName: item.departmentName,
            answers: new Map(),
          });
        }
        storeMap.get(key)!.answers.set(item.questionText, item.answerValue);
      });

      // Get unique questions in order
      const uniqueQuestions = selectedMetrics.filter(q => 
        questionnaireData.some((d: QuestionnaireAnswer) => d.questionText === q)
      );

      // Convert to array and sort
      const storesArray = Array.from(storeMap.values()).sort((a, b) => 
        a.storeName.localeCompare(b.storeName)
      );

      // Format answer for email
      const formatAnswer = (value: string | null): string => {
        if (value === null || value === undefined || value === '') {
          return '<span style="color: #999;">—</span>';
        }
        const lowerValue = value.toLowerCase().trim();
        if (lowerValue === 'yes' || lowerValue === 'true') {
          return '<span style="color: #16a34a; font-weight: 500;">✓ Yes</span>';
        }
        if (lowerValue === 'no' || lowerValue === 'false') {
          return '<span style="color: #dc2626; font-weight: 500;">✗ No</span>';
        }
        if (lowerValue === 'n/a' || lowerValue === 'na') {
          return '<span style="color: #666;">N/A</span>';
        }
        // Truncate long values
        if (value.length > 40) {
          return value.substring(0, 40) + '...';
        }
        return value;
      };

      html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            <strong>${brandLine}</strong> • ${storesArray.length} stores compared • ${uniqueQuestions.length} questions
          </p>
          
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;">Question</th>
      `;

      // Add store headers
      storesArray.forEach(store => {
        html += `
          <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 150px;">
            ${store.storeName}
            <div style="font-size: 11px; color: #666; font-weight: normal; margin-top: 2px;">${store.departmentName}</div>
          </th>
        `;
      });

      html += `</tr></thead><tbody>`;

      // Add question rows
      uniqueQuestions.forEach(question => {
        html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500; max-width: 300px;">${question}</td>`;
        
        storesArray.forEach(store => {
          const answer = store.answers.get(question);
          html += `
            <td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px;">
              ${formatAnswer(answer ?? null)}
            </td>
          `;
        });
        
        html += `</tr>`;
      });

      html += `
            </tbody>
          </table>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>This report was generated by the Growth Scorecard application.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
    } else {
      // Build financial/KPI comparison email (existing logic)
      html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            <strong>${brandLine}</strong> • ${periodDescription} • ${comparisonDescription} • ${stores.length} stores compared
          </p>
          
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;">Metric</th>
      `;

      // Add store headers with data completeness
      stores.forEach(store => {
        const statusColor = store.isComplete ? '#16a34a' : '#ca8a04';
        const statusText = store.lastCompleteMonth 
          ? `Thru ${formatMonthShort(store.lastCompleteMonth)}`
          : 'No data';
        
        html += `
          <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 180px;">
            ${store.storeName}
            ${datePeriodType !== "month" ? `<div style="font-size: 11px; color: ${statusColor}; font-weight: normal; margin-top: 4px;">${statusText}</div>` : ''}
          </th>
        `;
      });

      html += `</tr></thead><tbody>`;

      // Add metric rows
      selectedMetrics.forEach(metricName => {
        const metricData = metrics.find(m => m.metricName === metricName);
        
        html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500;">${metricName}</td>`;
        
        stores.forEach(store => {
          const storeValue = metricData?.storeValues[store.storeId];
          
          if (storeValue && storeValue.value !== null) {
            let varianceBgColor = "";
            let varianceTextColor = "";
            if (storeValue.variance !== null) {
              if (storeValue.variance >= 10) {
                varianceBgColor = "#dcfce7";
                varianceTextColor = "#166534";
              } else if (storeValue.variance >= -10) {
                varianceBgColor = "#fef9c3";
                varianceTextColor = "#854d0e";
              } else {
                varianceBgColor = "#fee2e2";
                varianceTextColor = "#991b1b";
              }
            }
            
            html += `
              <td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px;">
                <div style="font-size: 15px; font-weight: 600;">${formatValue(storeValue.value, metricName)}</div>
                ${storeValue.target !== null ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">Target: ${formatValue(storeValue.target, metricName)}</div>` : ''}
                ${storeValue.variance !== null ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; margin-top: 4px; background-color: ${varianceBgColor}; color: ${varianceTextColor};">${storeValue.variance >= 0 ? '+' : ''}${storeValue.variance.toFixed(1)}%</span>` : ''}
              </td>
            `;
          } else {
            html += `<td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; color: #999;">No data</td>`;
          }
        });
        
        html += `</tr>`;
      });

      html += `
            </tbody>
          </table>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
            <p>This report was generated by the Growth Scorecard application.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
        </html>
      `;
    }

    // Build email subject
    const emailSubject = metricType === "dept_info"
      ? (filterName ? `${filterName} - ${brandLine}` : `Service Dept Info Comparison - ${brandLine}`)
      : (filterName 
          ? `${filterName} - ${brandLine} - ${periodDescription}` 
          : `Dealer Comparison Report - ${brandLine} - ${periodDescription}`);

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
    console.error("Error sending dealer comparison email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
