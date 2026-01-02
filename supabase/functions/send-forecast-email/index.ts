import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailRequest {
  departmentId: string;
  forecastYear: number;
  view: "monthly" | "quarter" | "annual";
  customRecipients: string[];
  includeSubMetrics?: boolean;
}

interface MetricData {
  key: string;
  label: string;
  type: "currency" | "percent";
  months: Record<string, { value: number; baseline: number }>;
  quarters: Record<string, { value: number; baseline: number }>;
  annual: { value: number; baseline: number; variance: number; variancePercent: number };
}

interface SubMetricData {
  key: string;
  label: string;
  parentKey: string;
  annual: { value: number; baseline: number; variance: number };
  note?: string;
}

const METRIC_DEFINITIONS = [
  { key: 'total_sales', label: 'Total Sales', type: 'currency' as const },
  { key: 'gp_net', label: 'GP Net', type: 'currency' as const },
  { key: 'gp_percent', label: 'GP %', type: 'percent' as const },
  { key: 'sales_expense', label: 'Sales Expense', type: 'currency' as const },
  { key: 'sales_expense_percent', label: 'Sales Exp %', type: 'percent' as const },
  { key: 'net_selling_gross', label: 'Net Selling Gross', type: 'currency' as const },
  { key: 'total_fixed_expense', label: 'Fixed Expense', type: 'currency' as const },
  { key: 'department_profit', label: 'Dept Profit', type: 'currency' as const },
  { key: 'parts_transfer', label: 'Parts Transfer', type: 'currency' as const },
  { key: 'net_operating_profit', label: 'Net Operating', type: 'currency' as const },
  { key: 'return_on_gross', label: 'Return on Gross', type: 'percent' as const },
];

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatCurrency(value: number): string {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatValue(value: number | null, type: "currency" | "percent"): string {
  if (value === null || value === undefined) return "-";
  if (type === "percent") return `${value.toFixed(1)}%`;
  return formatCurrency(value);
}

function formatVariance(value: number, type: "currency" | "percent"): string {
  const sign = value >= 0 ? "+" : "";
  if (type === "percent") return `${sign}${value.toFixed(1)}%`;
  return `${sign}${formatCurrency(value)}`;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== Send Forecast Email function called ===", { method: req.method });
  
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

    const { departmentId, forecastYear, view, customRecipients, includeSubMetrics = true }: EmailRequest = await req.json();
    console.log("Forecast email request:", { departmentId, forecastYear, view, customRecipients, includeSubMetrics });

    const priorYear = forecastYear - 1;

    // Fetch department info
    const { data: department, error: deptError } = await supabaseClient
      .from("departments")
      .select(`
        id, name, manager_id,
        stores!inner(id, name, brand, group_id)
      `)
      .eq("id", departmentId)
      .single();

    if (deptError || !department) {
      console.error("Error fetching department:", deptError);
      throw new Error("Department not found");
    }

    const deptData = department as unknown as {
      id: string;
      name: string;
      manager_id: string | null;
      stores: { id: string; name: string; brand: string | null; group_id: string | null };
    };

    console.log("Department loaded:", { name: deptData.name, store: deptData.stores?.name });

    // Fetch forecast data
    const { data: forecast } = await supabaseClient
      .from("department_forecasts")
      .select("id")
      .eq("department_id", departmentId)
      .eq("forecast_year", forecastYear)
      .single();

    if (!forecast) {
      throw new Error("No forecast found for this department and year");
    }

    // Fetch forecast entries
    const { data: forecastEntries } = await supabaseClient
      .from("forecast_entries")
      .select("*")
      .eq("forecast_id", forecast.id);

    console.log("Forecast entries loaded:", forecastEntries?.length || 0);

    // Fetch prior year financial data for baseline
    const { data: priorYearData } = await supabaseClient
      .from("financial_entries")
      .select("month, metric_name, value")
      .eq("department_id", departmentId)
      .gte("month", `${priorYear}-01`)
      .lte("month", `${priorYear}-12`)
      .not("metric_name", "like", "sub:%");

    console.log("Prior year data loaded:", priorYearData?.length || 0);

    // Fetch sub-metric notes (only if including sub-metrics)
    let subMetricNotes: any[] = [];
    if (includeSubMetrics) {
      const { data } = await supabaseClient
        .from("forecast_submetric_notes")
        .select("*")
        .eq("department_id", departmentId)
        .eq("forecast_year", forecastYear)
        .eq("is_resolved", false);
      subMetricNotes = data || [];
      console.log("Sub-metric notes loaded:", subMetricNotes.length);
    }

    // Fetch sub-metric overrides (forecast values) for the current year
    let subMetricOverrides: any[] = [];
    if (includeSubMetrics && forecast) {
      const { data } = await supabaseClient
        .from("forecast_submetric_overrides")
        .select("*")
        .eq("forecast_id", forecast.id);
      subMetricOverrides = data || [];
      console.log("Sub-metric overrides loaded:", subMetricOverrides.length);
    }

    // Fetch sub-metric data from prior year (only if including sub-metrics)
    let subMetricData: { parentKey: string; name: string; forecastValue: number; baselineValue: number; variance: number }[] = [];
    if (includeSubMetrics) {
      const { data: subMetricEntries } = await supabaseClient
        .from("financial_entries")
        .select("month, metric_name, value")
        .eq("department_id", departmentId)
        .gte("month", `${priorYear}-01`)
        .lte("month", `${priorYear}-12`)
        .like("metric_name", "sub:%");

      if (subMetricEntries && subMetricEntries.length > 0) {
        // Group sub-metrics and calculate annual totals
        const grouped = new Map<string, { parentKey: string; name: string; total: number }>();
        subMetricEntries.forEach((entry) => {
          const parts = entry.metric_name.split(":");
          if (parts.length >= 4) {
            const parentKey = parts[1];
            const name = parts.slice(3).join(":");
            const key = `${parentKey}:${name}`;
            if (!grouped.has(key)) {
              grouped.set(key, { parentKey, name, total: 0 });
            }
            grouped.get(key)!.total += entry.value || 0;
          }
        });
        
        // Build sub-metric data with forecast values from overrides
        subMetricData = Array.from(grouped.values()).map((g) => {
          const override = subMetricOverrides.find(
            (o) => o.sub_metric_key === g.name && o.parent_metric_key === g.parentKey
          );
          const baselineValue = g.total;
          const forecastValue = override ? override.overridden_annual_value : baselineValue;
          const variance = forecastValue - baselineValue;
          
          return {
            parentKey: g.parentKey,
            name: g.name,
            forecastValue,
            baselineValue,
            variance,
          };
        });
        console.log("Sub-metric data loaded:", subMetricData.length);
      }
    }

    // Build baseline data map
    const baselineByMonth = new Map<string, Map<string, number>>();
    priorYearData?.forEach((entry) => {
      if (!baselineByMonth.has(entry.month)) {
        baselineByMonth.set(entry.month, new Map());
      }
      const monthMap = baselineByMonth.get(entry.month)!;
      monthMap.set(entry.metric_name, (monthMap.get(entry.metric_name) || 0) + (entry.value || 0));
    });

    // Build forecast data map
    const forecastByMonth = new Map<string, Map<string, { forecast_value: number; baseline_value: number }>>();
    forecastEntries?.forEach((entry) => {
      if (!forecastByMonth.has(entry.month)) {
        forecastByMonth.set(entry.month, new Map());
      }
      forecastByMonth.get(entry.month)!.set(entry.metric_name, {
        forecast_value: entry.forecast_value || 0,
        baseline_value: entry.baseline_value || 0,
      });
    });

    // Calculate metrics for each period
    const months = Array.from({ length: 12 }, (_, i) => `${forecastYear}-${String(i + 1).padStart(2, "0")}`);
    
    const metricsData: MetricData[] = METRIC_DEFINITIONS.map((def) => {
      const monthData: Record<string, { value: number; baseline: number }> = {};
      let annualValue = 0;
      let annualBaseline = 0;

      months.forEach((month) => {
        const forecastData = forecastByMonth.get(month)?.get(def.key);
        const value = forecastData?.forecast_value || 0;
        const baseline = forecastData?.baseline_value || 0;
        monthData[month] = { value, baseline };
        annualValue += value;
        annualBaseline += baseline;
      });

      // Calculate quarters
      const quarterData: Record<string, { value: number; baseline: number }> = {};
      for (let q = 1; q <= 4; q++) {
        const startMonth = (q - 1) * 3;
        const quarterMonths = months.slice(startMonth, startMonth + 3);
        const qValue = quarterMonths.reduce((sum, m) => sum + (monthData[m]?.value || 0), 0);
        const qBaseline = quarterMonths.reduce((sum, m) => sum + (monthData[m]?.baseline || 0), 0);
        quarterData[`Q${q}`] = { 
          value: def.type === "percent" ? qValue / 3 : qValue, 
          baseline: def.type === "percent" ? qBaseline / 3 : qBaseline 
        };
      }

      // For percentages, annual is average not sum
      if (def.type === "percent") {
        annualValue = annualValue / 12;
        annualBaseline = annualBaseline / 12;
      }

      const variance = annualValue - annualBaseline;
      const variancePercent = annualBaseline !== 0 ? (variance / Math.abs(annualBaseline)) * 100 : 0;

      return {
        key: def.key,
        label: def.label,
        type: def.type,
        months: monthData,
        quarters: quarterData,
        annual: { value: annualValue, baseline: annualBaseline, variance, variancePercent },
      };
    });

    // Use customRecipients directly
    const recipients = customRecipients.filter(email => email && email.includes('@'));
    
    if (recipients.length === 0) {
      throw new Error("No valid recipients provided");
    }

    console.log("Recipients:", recipients);

    // Build HTML email
    const viewLabel = view === "monthly" ? "Monthly View" : view === "quarter" ? "Quarterly View" : "Annual View";
    const profitData = metricsData.find((m) => m.key === "department_profit");
    const profitVariance = profitData?.annual.variance || 0;
    const profitVariancePercent = profitData?.annual.variancePercent || 0;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #ffffff; color: #333; }
          .container { max-width: 900px; margin: 0 auto; }
          h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 8px; }
          h2 { color: #1a1a1a; font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 20px; }
          .summary-box { 
            background-color: #f8f9fa; 
            border-radius: 8px; 
            padding: 16px 20px; 
            margin-bottom: 24px;
            border-left: 4px solid #2563eb;
          }
          .summary-title { font-size: 14px; color: #666; margin-bottom: 4px; }
          .summary-value { font-size: 24px; font-weight: bold; color: #1a1a1a; }
          .summary-variance { font-size: 14px; margin-top: 4px; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
          th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: right; font-size: 12px; }
          th { background-color: #f3f4f6; font-weight: 600; text-align: center; }
          td:first-child, th:first-child { text-align: left; font-weight: 500; }
          .highlight-row { background-color: #eff6ff; font-weight: 600; }
          .annual-col { background-color: #f0f9ff; }
          .variance-col { background-color: #ecfdf5; }
          .baseline-col { background-color: #f9fafb; }
          .note-flag { display: inline-block; width: 8px; height: 8px; background-color: #f59e0b; border-radius: 2px; margin-left: 4px; }
          .notes-section { margin-top: 24px; padding: 16px; background-color: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d; }
          .notes-title { font-weight: 600; color: #92400e; margin-bottom: 12px; }
          .note-item { margin-bottom: 8px; font-size: 13px; }
          .note-metric { font-weight: 500; color: #92400e; }
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${deptData.stores.name} - ${deptData.name} Forecast</h1>
          <p class="subtitle"><strong>${forecastYear} Forecast</strong> • ${viewLabel} • vs ${priorYear} Baseline</p>
          
          <div class="summary-box">
            <div class="summary-title">Year Over Year Comparison</div>
            <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
              <span style="color: #666; font-size: 14px;">Dept Profit:</span>
              <span class="summary-value" style="font-size: 20px;">${formatCurrency(profitData?.annual.value || 0)}</span>
              <span style="color: #666; font-size: 14px;">vs ${formatCurrency(profitData?.annual.baseline || 0)} prior year</span>
            </div>
            <div class="summary-variance ${profitVariance >= 0 ? "positive" : "negative"}">
              ${formatVariance(profitVariance, "currency")} (${profitVariancePercent >= 0 ? "+" : ""}${profitVariancePercent.toFixed(1)}%)
            </div>
            <div style="font-size: 12px; color: #666; margin-top: 8px;">
              ${profitVariance >= 0 ? "+" : ""}${formatCurrency(profitVariance / 12)} per month variance
            </div>
          </div>
    `;

    // Build the table based on view
    if (view === "annual") {
      html += `
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="annual-col">${forecastYear}</th>
              <th class="variance-col">Variance</th>
              <th class="baseline-col">${priorYear}</th>
            </tr>
          </thead>
          <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowClass = isProfit ? ' class="highlight-row"' : "";
        
        html += `
          <tr${rowClass}>
            <td>${metric.label}</td>
            <td class="annual-col">${formatValue(metric.annual.value, metric.type)}</td>
            <td class="variance-col ${metric.annual.variance >= 0 ? "positive" : "negative"}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td class="baseline-col">${formatValue(metric.annual.baseline, metric.type)}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    } else if (view === "quarter") {
      html += `
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Q1</th>
              <th>Q2</th>
              <th>Q3</th>
              <th>Q4</th>
              <th class="annual-col">${forecastYear}</th>
              <th class="variance-col">Var</th>
              <th class="baseline-col">${priorYear}</th>
            </tr>
          </thead>
          <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowClass = isProfit ? ' class="highlight-row"' : "";
        
        html += `<tr${rowClass}><td>${metric.label}</td>`;
        
        for (let q = 1; q <= 4; q++) {
          html += `<td>${formatValue(metric.quarters[`Q${q}`]?.value, metric.type)}</td>`;
        }
        
        html += `
            <td class="annual-col">${formatValue(metric.annual.value, metric.type)}</td>
            <td class="variance-col ${metric.annual.variance >= 0 ? "positive" : "negative"}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td class="baseline-col">${formatValue(metric.annual.baseline, metric.type)}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    } else {
      // Monthly view - show 6 months at a time in two tables
      for (let half = 0; half < 2; half++) {
        const startMonth = half * 6;
        const endMonth = startMonth + 6;
        const monthsSlice = months.slice(startMonth, endMonth);
        
        html += `
          <h2>${half === 0 ? "January - June" : "July - December"}</h2>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
        `;
        
        monthsSlice.forEach((m) => {
          const monthIndex = parseInt(m.split("-")[1]) - 1;
          html += `<th>${MONTH_ABBREV[monthIndex]}</th>`;
        });
        
        html += `
              </tr>
            </thead>
            <tbody>
        `;

        metricsData.forEach((metric) => {
          const isProfit = metric.key === "department_profit";
          const rowClass = isProfit ? ' class="highlight-row"' : "";
          
          html += `<tr${rowClass}><td>${metric.label}</td>`;
          
          monthsSlice.forEach((m) => {
            html += `<td>${formatValue(metric.months[m]?.value, metric.type)}</td>`;
          });
          
          html += `</tr>`;
        });

        html += `</tbody></table>`;
      }

      // Add annual summary table
      html += `
        <h2>Annual Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th class="annual-col">${forecastYear}</th>
              <th class="variance-col">Variance</th>
              <th class="baseline-col">${priorYear}</th>
            </tr>
          </thead>
          <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowClass = isProfit ? ' class="highlight-row"' : "";
        
        html += `
          <tr${rowClass}>
            <td>${metric.label}</td>
            <td class="annual-col">${formatValue(metric.annual.value, metric.type)}</td>
            <td class="variance-col ${metric.annual.variance >= 0 ? "positive" : "negative"}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td class="baseline-col">${formatValue(metric.annual.baseline, metric.type)}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    }

    // Add sub-metrics section if included and there's data
    if (includeSubMetrics && subMetricData.length > 0) {
      // Group by parent key
      const groupedByParent = new Map<string, typeof subMetricData>();
      subMetricData.forEach((sm) => {
        if (!groupedByParent.has(sm.parentKey)) {
          groupedByParent.set(sm.parentKey, []);
        }
        groupedByParent.get(sm.parentKey)!.push(sm);
      });

      html += `<h2>Sub-Metric Details</h2>`;
      
      groupedByParent.forEach((items, parentKey) => {
        const parentLabel = METRIC_DEFINITIONS.find((m) => m.key === parentKey)?.label || parentKey;
        html += `
          <table style="margin-bottom: 16px;">
            <thead>
              <tr>
                <th colspan="4" style="background-color: #f0f9ff; color: #1a1a1a;">${parentLabel}</th>
              </tr>
              <tr>
                <th style="text-align: left;">Sub-Metric</th>
                <th class="annual-col">${forecastYear}</th>
                <th class="variance-col">Variance</th>
                <th class="baseline-col">${priorYear}</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        items.forEach((item) => {
          const note = subMetricNotes.find((n) => n.sub_metric_key === item.name);
          html += `
            <tr>
              <td>${item.name}${note ? '<span class="note-flag"></span>' : ''}</td>
              <td class="annual-col">${formatCurrency(item.forecastValue)}</td>
              <td class="variance-col ${item.variance >= 0 ? "positive" : "negative"}">${formatVariance(item.variance, "currency")}</td>
              <td class="baseline-col">${formatCurrency(item.baselineValue)}</td>
            </tr>
          `;
        });
        
        html += `</tbody></table>`;
      });
    }

    // Add notes section if there are any
    if (includeSubMetrics && subMetricNotes.length > 0) {
      html += `
        <div class="notes-section">
          <div class="notes-title">📋 Forecast Notes</div>
      `;
      
      subMetricNotes.forEach((note) => {
        html += `
          <div class="note-item">
            <span class="note-metric">${note.sub_metric_key}:</span> ${note.note || ""}
          </div>
        `;
      });
      
      html += `</div>`;
    }

    html += `
          <div class="footer">
            <p>This forecast report was generated by the Growth Scorecard application.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email using Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    console.log(`Sending forecast email to ${recipients.length} recipient(s):`, recipients);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dealer Growth Solutions <reports@dealergrowth.solutions>",
        to: recipients,
        subject: `${deptData.name} Forecast - ${forecastYear} ${viewLabel}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", emailResponse.status, errorText);
      throw new Error(`Failed to send email: ${errorText}`);
    }

    const emailData = await emailResponse.json();
    console.log("Forecast email sent successfully:", emailData);

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in send-forecast-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
