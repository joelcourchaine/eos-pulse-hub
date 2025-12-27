import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

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
  format?: "html" | "excel";
  kpiTypeMap: Record<string, string>;
  departmentNames: string[];
}

function formatValue(value: number | null, metricName: string, kpiTypeMap: Record<string, string>): string {
  if (value === null || value === undefined) return "-";
  
  const metricType = kpiTypeMap[metricName];
  
  if (metricType === "percentage") {
    return `${value.toFixed(1)}%`;
  }
  
  if (metricType === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
  
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatMonthShort(month: string): string {
  const date = new Date(month + '-15');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[date.getMonth()]} '${date.getFullYear().toString().slice(-2)}`;
}

function generateExcelBuffer(
  stores: StoreData[],
  months: string[],
  selectedMetrics: string[],
  processedData: Record<string, Record<string, Record<string, number | null>>>,
  kpiTypeMap: Record<string, string>,
  brandDisplayName: string,
  filterName?: string
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  for (const store of stores) {
    const storeData = processedData[store.id];
    if (!storeData) continue;

    const rows: (string | number | null)[][] = [];
    
    // Header row
    const headerRow = ["KPI", ...months.map(m => formatMonthShort(m)), "Avg"];
    rows.push(headerRow);

    // Track which rows are percentages for formatting
    const rowFormats: { isPercentage: boolean; isCurrency: boolean }[] = [];

    // Data rows
    for (const metricName of selectedMetrics) {
      const metricData = storeData[metricName] as Record<string, number | null> | undefined;
      const row: (string | number | null)[] = [metricName];
      
      const metricType = kpiTypeMap[metricName];
      const isPercentage = metricType === "percentage";
      const isCurrency = metricType === "currency";
      rowFormats.push({ isPercentage, isCurrency });
      
      const values: number[] = [];
      for (const month of months) {
        const value = metricData?.[month] ?? null;
        if (value !== null) values.push(value);
        // For percentages, divide by 100 so Excel can format correctly
        row.push(isPercentage && value !== null ? value / 100 : value);
      }

      // Calculate average
      const avg = values.length > 0 
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;
      
      row.push(isPercentage && avg !== null ? avg / 100 : avg);
      rows.push(row);
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    
    // Apply number formatting to cells
    const numCols = months.length + 2; // KPI name + months + Avg
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const format = rowFormats[rowIdx - 1];
      for (let colIdx = 1; colIdx < numCols; colIdx++) {
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        const cell = worksheet[cellAddress];
        if (cell && cell.v !== null && cell.v !== undefined) {
          if (format.isPercentage) {
            cell.z = '0.0%';
          } else if (format.isCurrency) {
            cell.z = '"$"#,##0';
          } else {
            cell.z = '#,##0.0';
          }
        }
      }
    }
    
    // Set column widths
    const colWidths = [{ wch: 30 }];
    for (let i = 0; i < months.length; i++) {
      colWidths.push({ wch: 14 });
    }
    colWidths.push({ wch: 14 });
    worksheet['!cols'] = colWidths;

    const sheetName = store.name.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
  return new Uint8Array(buffer);
}

function generateHtmlEmail(
  stores: StoreData[],
  months: string[],
  selectedMetrics: string[],
  processedData: Record<string, Record<string, Record<string, number | null>>>,
  kpiTypeMap: Record<string, string>,
  brandDisplayName: string,
  periodDescription: string,
  reportTitle: string,
  departmentNames: string[]
): string {
  const deptDisplay = departmentNames.length > 0 ? departmentNames.join(", ") : "All Departments";
  
  let html = `
    <!DOCTYPE html>
    <html>
    <head></head>
    <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
      <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
      <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
        <strong>${brandDisplayName}</strong> • ${deptDisplay} • ${stores.length} stores • ${periodDescription}
      </p>
  `;

  for (const store of stores) {
    const storeData = processedData[store.id];
    if (!storeData) continue;

    html += `
      <h2 style="color: #1a1a1a; font-size: 18px; margin-top: 30px; margin-bottom: 10px;">
        ${store.name}${departmentNames.length > 0 ? ` - ${deptDisplay}` : ''}
      </h2>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px; font-size: 12px;">
        <thead>
          <tr>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left; background-color: #f8f8f8; font-weight: 600; min-width: 150px;">KPI</th>
    `;

    for (const month of months) {
      html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f8f8f8; font-weight: 600;">${formatMonthShort(month)}</th>`;
    }
    
    html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #e0e0e0; font-weight: 600;">Avg</th>`;
    html += `</tr></thead><tbody>`;

    for (const metricName of selectedMetrics) {
      const metricData = storeData[metricName] as Record<string, number | null> | undefined;
      
      html += `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 500;">${metricName}</td>`;
      
      const values: number[] = [];
      for (const month of months) {
        const value = metricData?.[month] ?? null;
        if (value !== null) values.push(value);
        html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatValue(value, metricName, kpiTypeMap)}</td>`;
      }
      
      const avg = values.length > 0 
        ? values.reduce((sum, v) => sum + v, 0) / values.length
        : null;
      
      html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 600; background-color: #f0f0f0;">${formatValue(avg, metricName, kpiTypeMap)}</td>`;
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

  return html;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== KPI Trend Report Email function called ===");
  
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
      format = "html",
      kpiTypeMap,
      departmentNames,
    }: EmailRequest = await req.json();

    console.log("Sending KPI trend report email to:", recipientEmails);
    console.log("Format:", format, "Stores:", stores.length, "Months:", months.length, "Metrics:", selectedMetrics.length);

    const reportTitle = filterName || "Monthly KPI Trend Report";
    const periodDescription = `${formatMonthShort(startMonth)} to ${formatMonthShort(endMonth)}`;

    const emailSubject = filterName 
      ? `${filterName} - ${brandDisplayName} - ${periodDescription}`
      : `Monthly KPI Trend Report - ${brandDisplayName} - ${periodDescription}`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let emailPayload: Record<string, unknown>;

    if (format === "excel") {
      const excelBuffer = generateExcelBuffer(
        stores,
        months,
        selectedMetrics,
        processedData,
        kpiTypeMap,
        brandDisplayName,
        filterName
      );

      const base64Excel = btoa(String.fromCharCode(...excelBuffer));
      const fileName = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${periodDescription.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

      const deptDisplay = departmentNames.length > 0 ? departmentNames.join(", ") : "All Departments";

      emailPayload = {
        from: "Growth Scorecard <reports@dealergrowth.solutions>",
        to: recipientEmails,
        subject: emailSubject,
        html: `
          <!DOCTYPE html>
          <html>
          <head></head>
          <body style="font-family: Arial, sans-serif; margin: 20px; color: #333;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">${reportTitle}</h1>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">
              <strong>${brandDisplayName}</strong> • ${deptDisplay} • ${stores.length} stores • ${periodDescription}
            </p>
            <p>Please find the attached Excel report containing monthly KPI trend data for ${stores.length} store(s).</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
              <p>This report was generated by the Growth Scorecard application.</p>
              <p>Generated on ${new Date().toLocaleString()}</p>
            </div>
          </body>
          </html>
        `,
        attachments: [
          {
            filename: fileName,
            content: base64Excel,
          },
        ],
      };
    } else {
      const html = generateHtmlEmail(
        stores,
        months,
        selectedMetrics,
        processedData,
        kpiTypeMap,
        brandDisplayName,
        periodDescription,
        reportTitle,
        departmentNames
      );

      emailPayload = {
        from: "Growth Scorecard <reports@dealergrowth.solutions>",
        to: recipientEmails,
        subject: emailSubject,
        html,
      };
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
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
    console.error("Error sending KPI trend report email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
