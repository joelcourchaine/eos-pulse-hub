import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailRequest {
  year: number;
  quarter: number;
  mode: "weekly" | "monthly";
  departmentId: string;
}

const YEAR_STARTS: Record<number, string> = {
  2025: "2024-10-28",
};

function getQuarterInfo(date: Date) {
  const year = date.getFullYear();
  const yearStart = new Date(YEAR_STARTS[year] || `${year}-01-01`);
  const daysSinceYearStart = Math.floor((date.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24));
  const weekInYear = Math.floor(daysSinceYearStart / 7) + 1;
  const quarter = Math.ceil(weekInYear / 13);
  const weekInQuarter = weekInYear - (quarter - 1) * 13;
  return { year, quarter, weekInQuarter };
}

function getWeekDates({ year, quarter }: { year: number; quarter: number }) {
  const yearStart = new Date(YEAR_STARTS[year] || `${year}-01-01`);
  const startWeek = (quarter - 1) * 13 + 1;
  const weeks = [];
  for (let i = 0; i < 13; i++) {
    const weekNum = startWeek + i;
    const weekStart = new Date(yearStart);
    weekStart.setDate(yearStart.getDate() + (weekNum - 1) * 7);
    weeks.push({
      start: weekStart,
      label: `Wk ${weekNum}`,
      type: "week" as const,
    });
  }
  return weeks;
}

function getMonthsForQuarter({ year, quarter }: { year: number; quarter: number }) {
  const yearStart = new Date(YEAR_STARTS[year] || `${year}-01-01`);
  const startWeek = (quarter - 1) * 13 + 1;
  const endWeek = startWeek + 12;
  
  const quarterStartDate = new Date(yearStart);
  quarterStartDate.setDate(yearStart.getDate() + (startWeek - 1) * 7);
  
  const quarterEndDate = new Date(yearStart);
  quarterEndDate.setDate(yearStart.getDate() + endWeek * 7 - 1);
  
  const months = [];
  let currentDate = new Date(quarterStartDate);
  const seenMonths = new Set<string>();
  
  while (currentDate <= quarterEndDate) {
    const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.push({
        label: monthNames[currentDate.getMonth()],
        identifier: monthKey,
        type: "month" as const,
      });
    }
    currentDate.setDate(currentDate.getDate() + 7);
  }
  
  return months;
}

function formatValue(value: number | null, metricType: string): string {
  if (value === null || value === undefined) return "-";
  if (metricType === "dollar") return `$${value.toLocaleString()}`;
  if (metricType === "percentage") return `${value}%`;
  return value.toString();
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Edge function called ===", { method: req.method, url: req.url });
  
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting email process...");
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

    const { year, quarter, mode, departmentId }: EmailRequest = await req.json();

    console.log("Fetching scorecard data for email...", { year, quarter, mode, departmentId });

    // Fetch department
    const { data: department } = await supabaseClient
      .from("departments")
      .select("*, stores(name)")
      .eq("id", departmentId)
      .single();

    if (!department) {
      throw new Error("Department not found");
    }

    // Fetch profiles
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, email");

    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Fetch KPIs
    const { data: kpis } = await supabaseClient
      .from("kpi_definitions")
      .select("*")
      .eq("department_id", departmentId)
      .order("display_order");

    // Fetch scorecard entries
    const periods = mode === "weekly" 
      ? getWeekDates({ year, quarter })
      : getMonthsForQuarter({ year, quarter });

    const { data: entries } = await supabaseClient
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpis?.map(k => k.id) || []);

    // Fetch financial entries for monthly
    let financialEntries: any[] = [];
    if (mode === "monthly") {
      const { data: finData } = await supabaseClient
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId);
      financialEntries = finData || [];
    }

    // Group KPIs by owner
    const kpisByOwner = new Map<string, any[]>();
    kpis?.forEach(kpi => {
      const ownerId = kpi.assigned_to || "unassigned";
      if (!kpisByOwner.has(ownerId)) {
        kpisByOwner.set(ownerId, []);
      }
      kpisByOwner.get(ownerId)!.push(kpi);
    });

    // Build HTML
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 30px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .red { background-color: #fee; }
          .yellow { background-color: #ffc; }
          .green { background-color: #efe; }
        </style>
      </head>
      <body>
        <h1>${department.stores?.name || "Store"} - ${department.name} Scorecard</h1>
        <p><strong>Q${quarter} ${year}</strong> | <strong>${mode === "weekly" ? "Weekly" : "Monthly"} View</strong></p>
    `;

    // Add KPI tables
    Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
      const ownerName = ownerId === "unassigned" ? "Unassigned" : profilesMap.get(ownerId)?.full_name || "Unknown";
      html += `<h2>${ownerName}</h2><table><thead><tr><th>KPI</th><th>Target</th>`;
      
      periods.forEach(p => {
        html += `<th>${p.label}</th>`;
      });
      html += `</tr></thead><tbody>`;

      ownerKpis.forEach(kpi => {
        html += `<tr><td>${kpi.name}</td><td>${formatValue(kpi.target_value, kpi.metric_type)}</td>`;
        
        periods.forEach(p => {
          const entry = entries?.find(e => {
            if (mode === "weekly" && 'start' in p) {
              return e.kpi_id === kpi.id && 
                     e.week_start_date === p.start.toISOString().split('T')[0];
            } else if (mode === "monthly" && 'identifier' in p) {
              return e.kpi_id === kpi.id && e.month === p.identifier;
            }
            return false;
          });

          const cellClass = entry?.status === "red" ? "red" : 
                           entry?.status === "yellow" ? "yellow" :
                           entry?.status === "green" ? "green" : "";
          
          html += `<td class="${cellClass}">${formatValue(entry?.actual_value, kpi.metric_type)}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });

    // Add financial metrics for monthly
    if (mode === "monthly") {
      html += `<h2>Financial Metrics</h2><table><thead><tr><th>Metric</th>`;
      periods.forEach(p => {
        html += `<th>${p.label}</th>`;
      });
      html += `</tr></thead><tbody>`;

      const FINANCIAL_METRICS = ["Revenue", "COGS", "Gross Profit", "Labor", "Operating Expenses"];
      FINANCIAL_METRICS.forEach(metric => {
        html += `<tr><td>${metric}</td>`;
        periods.forEach(p => {
          const entry = financialEntries.find(e => {
            if ('identifier' in p) {
              return e.metric_name === metric && e.month === p.identifier;
            }
            return false;
          });
          html += `<td>${formatValue(entry?.value, "dollar")}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }

    html += `</body></html>`;

    // Send email using Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Scorecard <onboarding@resend.dev>",
        to: [user.email!],
        subject: `${department.name} Scorecard - Q${quarter} ${year}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", emailResponse.status, errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-scorecard-email function:", error);
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
