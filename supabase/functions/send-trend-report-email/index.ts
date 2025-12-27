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

function generateExcelBuffer(
  stores: StoreData[],
  months: string[],
  selectedMetrics: string[],
  processedData: Record<string, Record<string, Record<string, number | null>>>,
  brandDisplayName: string,
  filterName?: string
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  for (const store of stores) {
    const storeData = processedData[store.id];
    if (!storeData) continue;

    // Build rows for this store
    const rows: (string | number | null)[][] = [];
    
    // Header row
    const headerRow = ["Metric", ...months.map(m => formatMonthShort(m)), "Total"];
    rows.push(headerRow);

    // Track which rows are percentages for formatting
    const rowFormats: boolean[] = []; // true = percentage, false = currency

    // Data rows
    for (const metricName of selectedMetrics) {
      const metricData = storeData[metricName] as Record<string, number | null> | undefined;
      const row: (string | number | null)[] = [metricName];
      
      const isPercentage = metricName.includes("%") || metricName.toLowerCase().includes("percent");
      rowFormats.push(isPercentage);
      
      const values: number[] = [];
      for (const month of months) {
        const value = metricData?.[month] ?? null;
        if (value !== null) values.push(value);
        // For percentages, divide by 100 so Excel can format correctly
        row.push(isPercentage && value !== null ? value / 100 : value);
      }

      // Calculate total/average
      const total = values.length > 0 
        ? isPercentage 
          ? values.reduce((sum, v) => sum + v, 0) / values.length 
          : values.reduce((sum, v) => sum + v, 0)
        : null;
      
      // For percentages, divide by 100 so Excel can format correctly
      row.push(isPercentage && total !== null ? total / 100 : total);
      rows.push(row);
    }

    // Create worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    
    // Apply number formatting to cells
    const numCols = months.length + 2; // Metric name + months + Total
    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) { // Skip header row
      const isPercentage = rowFormats[rowIdx - 1];
      for (let colIdx = 1; colIdx < numCols; colIdx++) { // Skip metric name column
        const cellAddress = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
        const cell = worksheet[cellAddress];
        if (cell && cell.v !== null && cell.v !== undefined) {
          if (isPercentage) {
            cell.z = '0.0%'; // Percentage format with 1 decimal
          } else {
            cell.z = '"$"#,##0'; // Currency format without decimals
          }
        }
      }
    }
    
    // Set column widths
    const colWidths = [{ wch: 30 }];
    for (let i = 0; i < months.length; i++) {
      colWidths.push({ wch: 14 });
    }
    colWidths.push({ wch: 16 });
    worksheet['!cols'] = colWidths;

    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = store.name.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Write to buffer with cellStyles enabled
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx", cellStyles: true });
  return new Uint8Array(buffer);
}

function generateHtmlEmail(
  stores: StoreData[],
  months: string[],
  selectedMetrics: string[],
  processedData: Record<string, Record<string, Record<string, number | null>>>,
  brandDisplayName: string,
  periodDescription: string,
  reportTitle: string
): string {
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

    for (const month of months) {
      html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #f8f8f8; font-weight: 600;">${formatMonthShort(month)}</th>`;
    }
    
    html += `<th style="border: 1px solid #ddd; padding: 8px; text-align: center; background-color: #e0e0e0; font-weight: 600;">Total</th>`;
    html += `</tr></thead><tbody>`;

    for (const metricName of selectedMetrics) {
      const metricData = storeData[metricName] as Record<string, number | null> | undefined;
      
      html += `<tr><td style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 500;">${metricName}</td>`;
      
      const values: number[] = [];
      for (const month of months) {
        const value = metricData?.[month] ?? null;
        if (value !== null) values.push(value);
        html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${formatValue(value, metricName)}</td>`;
      }
      
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

  return html;
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
      format = "html",
    }: EmailRequest = await req.json();

    console.log("Sending trend report email to:", recipientEmails);
    console.log("Format:", format, "Stores:", stores.length, "Months:", months.length, "Metrics:", selectedMetrics.length);

    const reportTitle = filterName || "Fixed Combined Monthly Trend Report";
    const periodDescription = `${formatMonthShort(startMonth)} to ${formatMonthShort(endMonth)}`;

    const emailSubject = filterName 
      ? `${filterName} - ${brandDisplayName} - ${periodDescription}`
      : `Fixed Combined Trend Report - ${brandDisplayName} - ${periodDescription}`;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    let emailPayload: Record<string, unknown>;

    if (format === "excel") {
      // Generate Excel file
      const excelBuffer = generateExcelBuffer(
        stores,
        months,
        selectedMetrics,
        processedData,
        brandDisplayName,
        filterName
      );

      // Convert to base64
      const base64Excel = btoa(String.fromCharCode(...excelBuffer));
      const fileName = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${periodDescription.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;

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
              <strong>${brandDisplayName}</strong> • ${stores.length} stores • ${periodDescription}
            </p>
            <p>Please find the attached Excel report containing monthly trend data for ${stores.length} store(s).</p>
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
      // Generate HTML email
      const html = generateHtmlEmail(
        stores,
        months,
        selectedMetrics,
        processedData,
        brandDisplayName,
        periodDescription,
        reportTitle
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
    console.error("Error sending trend report email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
