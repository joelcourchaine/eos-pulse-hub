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
  2025: "2024-12-30", // Dec 30, 2024 (Monday)
  2026: "2025-12-29", // Dec 29, 2025 (Monday)
  2027: "2026-12-28", // Dec 28, 2026 (Monday)
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
  const quarterStartWeek = (quarter - 1) * 13;
  const weeks = [];
  
  for (let i = 0; i < 13; i++) {
    const weekStart = new Date(yearStart);
    weekStart.setDate(yearStart.getDate() + ((quarterStartWeek + i) * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Format as "M/D-M/D" (e.g., "12/30-1/5")
    const startLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    const endLabel = `${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    weeks.push({
      start: weekStart,
      label: `${startLabel}-${endLabel}`,
      type: "week" as const,
    });
  }
  return weeks;
}

function getMonthsForQuarter({ year, quarter }: { year: number; quarter: number }) {
  const months = [];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  
  // Q1: Jan, Feb, Mar (months 0, 1, 2)
  // Q2: Apr, May, Jun (months 3, 4, 5)
  // Q3: Jul, Aug, Sep (months 6, 7, 8)
  // Q4: Oct, Nov, Dec (months 9, 10, 11)
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      type: "month" as const,
    });
  }
  
  return months;
}

function formatValue(value: number | null, metricType: string, kpiName?: string): string {
  if (value === null || value === undefined) return "-";
  
  // CP Hours per RO should always show 1 decimal place
  if (kpiName === "CP Hours per RO") {
    return Number(value).toFixed(1);
  }
  
  // CP Labour Sales Per RO and CP ELR should show whole dollars
  if (kpiName === "CP Labour Sales Per RO" || kpiName === "CP ELR") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  
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

    // Fetch department with store info
    const { data: department } = await supabaseClient
      .from("departments")
      .select(`
        *,
        stores(
          name,
          brand,
          brands:brand_id (
            name
          )
        )
      `)
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
      // Get the month identifiers for this quarter
      const monthIdentifiers = periods.map(p => 'identifier' in p ? p.identifier : '').filter(Boolean);
      console.log("Fetching financial entries for months:", monthIdentifiers);
      
      const { data: finData } = await supabaseClient
        .from("financial_entries")
        .select("*")
        .eq("department_id", departmentId)
        .in("month", monthIdentifiers);
      
      console.log("Financial entries fetched:", finData?.length || 0);
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
        html += `<tr><td>${kpi.name}</td><td>${formatValue(kpi.target_value, kpi.metric_type, kpi.name)}</td>`;
        
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
          
          html += `<td class="${cellClass}">${formatValue(entry?.actual_value, kpi.metric_type, kpi.name)}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });

    // Add financial metrics for monthly
    if (mode === "monthly") {
      // Get brand name
      const brandName = department?.stores?.brands?.name || department?.stores?.brand || null;
      
      // Define metrics based on brand
      const getFinancialMetrics = (brand: string | null) => {
        const isNissan = brand?.toLowerCase().includes('nissan');
        const isFord = brand?.toLowerCase().includes('ford');
        const isMazda = brand?.toLowerCase().includes('mazda');
        
        const baseMetrics = [
          { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
          { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
          { display: "GP %", dbName: "gp_percent", type: "percentage" as const, calc: (data: any) => 
            data.gp_net && data.total_sales ? (data.gp_net / data.total_sales) * 100 : null },
          { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
          { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const, calc: (data: any) =>
            data.sales_expense && data.gp_net ? (data.sales_expense / data.gp_net) * 100 : null },
          { display: "Semi Fixed Expense", dbName: "semi_fixed_expense", type: "dollar" as const },
          { display: "Semi Fixed Expense %", dbName: "semi_fixed_expense_percent", type: "percentage" as const, calc: (data: any) =>
            data.semi_fixed_expense && data.gp_net ? (data.semi_fixed_expense / data.gp_net) * 100 : null },
          { display: "Net Selling Gross", dbName: "net_selling_gross", type: "dollar" as const, calc: (data: any) =>
            data.gp_net && data.sales_expense && data.semi_fixed_expense ? 
            data.gp_net - data.sales_expense - data.semi_fixed_expense : null },
          { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
          { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
            data.gp_net && data.sales_expense && data.semi_fixed_expense && data.total_fixed_expense ?
            data.gp_net - data.sales_expense - data.semi_fixed_expense - data.total_fixed_expense : null },
        ];
        
        // Add brand-specific metrics
        if (!isMazda) {
          baseMetrics.push(
            { display: "Parts Transfer", dbName: "parts_transfer", type: "dollar" as const },
            { display: "Net Operating Profit", dbName: "net", type: "dollar" as const }
          );
        }
        
        // Add Return on Gross for all brands
        baseMetrics.push(
          { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) =>
            data.department_profit && data.gp_net ? (data.department_profit / data.gp_net) * 100 : null }
        );
        
        // Add Dealer Salary for Ford
        if (isFord) {
          baseMetrics.splice(baseMetrics.length - 1, 0, 
            { display: "Dealer Salary", dbName: "dealer_salary", type: "dollar" as const }
          );
        }
        
        return baseMetrics;
      };
      
      const FINANCIAL_METRICS = getFinancialMetrics(brandName);
      
      html += `<h2>Financial Metrics</h2><table><thead><tr><th>Metric</th>`;
      periods.forEach(p => {
        html += `<th>${p.label}</th>`;
      });
      html += `</tr></thead><tbody>`;
      
      FINANCIAL_METRICS.forEach(metric => {
        html += `<tr><td>${metric.display}</td>`;
        periods.forEach(p => {
          if ('identifier' in p) {
            // Gather all financial data for this month to calculate percentages
            const monthData: any = {};
            financialEntries.forEach(e => {
              if (e.month === p.identifier) {
                monthData[e.metric_name] = e.value;
              }
            });
            
            let value = null;
            if (metric.calc) {
              value = metric.calc(monthData);
            } else {
              const entry = financialEntries.find(e => 
                e.metric_name === metric.dbName && e.month === p.identifier
              );
              value = entry?.value || null;
            }
            
            if (metric.type === "percentage" && value !== null) {
              html += `<td>${value.toFixed(1)}%</td>`;
            } else {
              html += `<td>${formatValue(value, metric.type)}</td>`;
            }
          }
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
