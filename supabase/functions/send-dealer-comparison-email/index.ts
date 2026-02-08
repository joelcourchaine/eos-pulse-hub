import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ComparisonMetric {
  metricName: string;
  displayName?: string;
  isPercentage?: boolean;
  lowerIsBetter?: boolean;
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
  selectedDepartmentNames?: string[];
  isYoyMonth?: boolean;
  yoyCurrentYear?: number;
  yoyPrevYear?: number;
}

function formatValue(value: number | null, isPercentage: boolean): string {
  if (value === null || value === undefined) return "-";
  
  if (isPercentage) {
    return `${value.toFixed(1)}%`;
  }
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDiffValue(diff: number, isPercentage: boolean): string {
  const sign = diff >= 0 ? "+" : "";
  if (isPercentage) {
    return `${sign}${diff.toFixed(1)}%`;
  }
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(diff)}`;
}

function formatMonthShort(month: string): string {
  const date = new Date(month + '-15');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Detect if a metric is percentage-based from its name/selectionId.
 * Used as fallback when isPercentage flag is not provided.
 */
function detectPercentage(metricName: string): boolean {
  const lowerName = metricName.toLowerCase();
  const percentageMetrics = ["return on gross", "service absorption", "parts to service ratio"];
  return (
    metricName.includes("%") ||
    lowerName.includes("percent") ||
    percentageMetrics.some(m => lowerName === m)
  );
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
      selectedDepartmentNames,
      isYoyMonth,
      yoyCurrentYear,
      yoyPrevYear,
    }: EmailRequest = await req.json();

    console.log("Sending dealer comparison email to:", recipientEmails);
    console.log("Metric type:", metricType, "isYoyMonth:", isYoyMonth);
    console.log("Stores:", stores.length, "Metrics:", metrics.length);

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
    else if (comparisonMode === "year_over_year") comparisonDescription = "vs Year over Year";

    // Build title based on filter name
    const reportTitle = filterName ? filterName : (metricType === "dept_info" ? "Service Dept Info Comparison" : "Dealer Comparison Report");
    const brandLine = brandDisplayName || "All Brands";
    const departmentLine = selectedDepartmentNames && selectedDepartmentNames.length > 0 
      ? selectedDepartmentNames.join(", ") 
      : "";

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
            <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${storesArray.length} stores compared • ${uniqueQuestions.length} questions
          </p>
          
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;">Question</th>
      `;

      storesArray.forEach(store => {
        html += `
          <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 150px;">
            ${store.storeName}
            <div style="font-size: 11px; color: #666; font-weight: normal; margin-top: 2px;">${store.departmentName}</div>
          </th>
        `;
      });

      html += `</tr></thead><tbody>`;

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
    } else if (isYoyMonth) {
      // ========== YOY Single-Month: 3-Column Layout ==========
      console.log("Building YOY 3-column email layout");
      const curYearLabel = yoyCurrentYear ?? "";
      const prevYearLabel = yoyPrevYear ?? "";

      html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${periodDescription} • Year over Year • ${stores.length} stores compared
          </p>
          
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; background-color: #f8f8f8; font-weight: 600;" rowspan="2">Metric</th>
      `;

      // Store header row (spanning 3 sub-columns each)
      stores.forEach(store => {
        html += `
          <th style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px; background-color: #f8f8f8; font-weight: 600; min-width: 280px;" colspan="3">
            ${store.storeName}
          </th>
        `;
      });

      html += `</tr><tr>`;

      // Sub-header row: Current Year | Last Year | Diff
      stores.forEach(() => {
        html += `
          <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 90px;">${curYearLabel}</th>
          <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 90px;">${prevYearLabel}</th>
          <th style="border: 1px solid #ddd; padding: 6px 8px; text-align: center; font-size: 11px; background-color: #f0f0f0; font-weight: 600; min-width: 80px;">Diff</th>
        `;
      });

      html += `</tr></thead><tbody>`;

      // Metric rows
      metrics.forEach(metric => {
        const displayName = metric.displayName || metric.metricName;
        const isPercent = metric.isPercentage ?? detectPercentage(displayName);
        const lowerIsBetter = metric.lowerIsBetter ?? false;

        html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500;">${displayName}</td>`;
        
        stores.forEach(store => {
          const storeValue = metric.storeValues[store.storeId];
          const curValue = storeValue?.value ?? null;
          const lyValue = storeValue?.target ?? null;
          const diff = (curValue !== null && lyValue !== null) ? curValue - lyValue : null;

          // Determine if diff is favorable
          let diffColor = "#666";
          if (diff !== null && diff !== 0) {
            const favorable = lowerIsBetter ? diff < 0 : diff > 0;
            diffColor = favorable ? "#16a34a" : "#dc2626";
          }

          // Current year value
          html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 14px; font-weight: 600;">${formatValue(curValue, isPercent)}</td>`;
          
          // Last year value
          html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; color: #666;">${formatValue(lyValue, isPercent)}</td>`;
          
          // Diff value with color
          if (diff !== null) {
            html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; font-weight: 500; color: ${diffColor};">${formatDiffValue(diff, isPercent)}</td>`;
          } else {
            html += `<td style="border: 1px solid #ddd; padding: 8px 10px; text-align: center; font-size: 13px; color: #999;">-</td>`;
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
    } else {
      // ========== Standard layout (non-YOY or multi-month) ==========
      html = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
          <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
            <strong>${brandLine}</strong>${departmentLine ? ` • <strong>${departmentLine}</strong>` : ''} • ${periodDescription} • ${comparisonDescription} • ${stores.length} stores compared
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

      // Add metric rows using the ordered metrics array
      metrics.forEach(metric => {
        const displayName = metric.displayName || metric.metricName;
        const isPercent = metric.isPercentage ?? detectPercentage(displayName);
        
        html += `<tr><td style="border: 1px solid #ddd; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 500;">${displayName}</td>`;
        
        stores.forEach(store => {
          const storeValue = metric.storeValues[store.storeId];
          
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
            
            const targetLabel = comparisonMode === "year_over_year" ? "LY" : "Target";
            
            html += `
              <td style="border: 1px solid #ddd; padding: 10px 12px; text-align: center; font-size: 13px;">
                <div style="font-size: 15px; font-weight: 600;">${formatValue(storeValue.value, isPercent)}</div>
                ${storeValue.target !== null ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">${targetLabel}: ${formatValue(storeValue.target, isPercent)}</div>` : ''}
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
