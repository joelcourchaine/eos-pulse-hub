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
  departmentId: string;
  recipientEmails?: string[];
  gmOverviewPeriod?: "quarterly" | "yearly";
}

const YEAR_STARTS: Record<number, string> = {
  2025: "2024-12-30",
  2026: "2025-12-29",
  2027: "2026-12-28",
};

function getMonthsForQuarter({ year, quarter }: { year: number; quarter: number }) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  const months = [];
  
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: monthNames[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    });
  }
  
  return months;
}

function getAllMonthsForYear(year: number) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];
  return monthNames.map((name, index) => ({
    label: name.substring(0, 3), // Shortened for yearly view
    identifier: `${year}-${String(index + 1).padStart(2, '0')}`,
  }));
}

function formatValue(value: number | null, metricType: string, kpiName?: string): string {
  if (value === null || value === undefined) return "-";
  
  if (kpiName === "CP Hours per RO") {
    return Number(value).toFixed(1);
  }
  
  if (kpiName === "CP Labour Sales Per RO" || kpiName === "CP ELR") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  
  if (metricType === "dollar") return `$${value.toLocaleString()}`;
  if (metricType === "percentage") return `${value}%`;
  return value.toString();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const handler = async (req: Request): Promise<Response> => {
  console.log("=== GM Overview Email function called ===", { method: req.method });
  
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

    const { year, quarter, departmentId, recipientEmails, gmOverviewPeriod = "quarterly" }: EmailRequest = await req.json();
    const isYearlyView = gmOverviewPeriod === "yearly";
    console.log("GM Overview request:", { year, quarter, departmentId, recipientEmails, gmOverviewPeriod });

    // Fetch department with store info
    const { data: department, error: deptError } = await supabaseClient
      .from("departments")
      .select(`
        id,
        name,
        store_id,
        stores!inner(
          id,
          name,
          brand,
          brands(name)
        )
      `)
      .eq("id", departmentId)
      .single();

    if (deptError || !department) {
      throw new Error("Department not found");
    }

    const deptData = department as unknown as {
      id: string;
      name: string;
      store_id: string;
      stores: {
        id: string;
        name: string;
        brand: string | null;
        brands: { name: string } | null;
      };
    };

    const storeId = deptData.store_id;
    console.log("Department loaded:", deptData.name, "Store:", deptData.stores?.name, "Store ID:", storeId);

    // Fetch profiles for name lookups - only from the same store
    const { data: profiles } = await supabaseClient
      .from("profiles")
      .select("id, full_name, email, birthday_month, birthday_day, start_month, start_year")
      .eq("store_id", storeId);
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // ============ 1. ISSUES & TODOS ============
    console.log("Fetching issues and todos...");
    
    const { data: issues } = await supabaseClient
      .from("issues")
      .select("*")
      .eq("department_id", departmentId)
      .in("status", ["open", "in_progress"])
      .order("display_order");

    const { data: todos } = await supabaseClient
      .from("todos")
      .select("*")
      .eq("department_id", departmentId)
      .in("status", ["pending", "in_progress"])
      .order("due_date");

    console.log(`Found ${issues?.length || 0} issues and ${todos?.length || 0} todos`);

    // ============ 2. SCORECARD ============
    console.log("Fetching scorecard data...");
    
    const { data: kpis } = await supabaseClient
      .from("kpi_definitions")
      .select("*")
      .eq("department_id", departmentId)
      .order("display_order");

    // For yearly view, get all quarters' targets; for quarterly, just the selected quarter
    let kpiTargets: any[] = [];
    if (isYearlyView) {
      const { data } = await supabaseClient
        .from("kpi_targets")
        .select("*")
        .eq("year", year)
        .in("kpi_id", kpis?.map(k => k.id) || []);
      kpiTargets = data || [];
    } else {
      const { data } = await supabaseClient
        .from("kpi_targets")
        .select("*")
        .eq("year", year)
        .eq("quarter", quarter)
        .in("kpi_id", kpis?.map(k => k.id) || []);
      kpiTargets = data || [];
    }

    const kpiTargetsMap = new Map(kpiTargets?.map(t => [t.kpi_id, t.target_value || 0]) || []);

    const periods = isYearlyView ? getAllMonthsForYear(year) : getMonthsForQuarter({ year, quarter });
    const monthIdentifiers = periods.map(p => p.identifier);

    const { data: scorecardEntries } = await supabaseClient
      .from("scorecard_entries")
      .select("*")
      .in("kpi_id", kpis?.map(k => k.id) || [])
      .in("month", monthIdentifiers);

    console.log(`Found ${kpis?.length || 0} KPIs, ${scorecardEntries?.length || 0} entries`);

    // ============ 3. FINANCIAL SUMMARY ============
    console.log("Fetching financial data...");
    
    const { data: financialEntries } = await supabaseClient
      .from("financial_entries")
      .select("*")
      .eq("department_id", departmentId)
      .in("month", monthIdentifiers);

    // For yearly view, get all quarters' targets; for quarterly, just the selected quarter
    let financialTargets: any[] = [];
    if (isYearlyView) {
      const { data } = await supabaseClient
        .from("financial_targets")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year);
      financialTargets = data || [];
    } else {
      const { data } = await supabaseClient
        .from("financial_targets")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year)
        .eq("quarter", quarter);
      financialTargets = data || [];
    }

    const finTargetsMap = new Map<string, { value: number; direction: string }>();
    financialTargets?.forEach(t => {
      finTargetsMap.set(t.metric_name, { value: t.target_value, direction: t.target_direction });
    });

    console.log(`Found ${financialEntries?.length || 0} financial entries`);

    // ============ 4. ROCKS ============
    console.log("Fetching rocks...");
    
    // For yearly view, get all rocks for the year; for quarterly, just the selected quarter
    let rocks: any[] = [];
    if (isYearlyView) {
      const { data } = await supabaseClient
        .from("rocks")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year)
        .order("quarter")
        .order("title");
      rocks = data || [];
    } else {
      const { data } = await supabaseClient
        .from("rocks")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year)
        .eq("quarter", quarter)
        .order("title");
      rocks = data || [];
    }

    console.log(`Found ${rocks?.length || 0} rocks`);

    // ============ 5. CELEBRATIONS ============
    console.log("Fetching celebrations...");
    
    // Get current month info for celebrations
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    
    // Filter celebrations from profiles already fetched for this store
    const birthdayProfiles = profiles?.filter(p => p.birthday_month === currentMonth) || [];
    const anniversaryProfiles = profiles?.filter(p => 
      p.start_month === currentMonth && 
      p.start_year && 
      p.start_year < now.getFullYear()
    ) || [];

    console.log(`Found ${birthdayProfiles.length} birthdays, ${anniversaryProfiles.length} anniversaries for store`);

    // ============ BUILD HTML EMAIL ============
    const brandName = deptData.stores?.brands?.name || deptData.stores?.brand || null;
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          h1 { color: #1a1a1a; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
          h2 { color: #2563eb; margin-top: 30px; padding: 10px; background: #f0f7ff; border-radius: 6px; }
          h3 { color: #444; margin-top: 20px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .red { background-color: #fee; }
          .yellow { background-color: #ffc; }
          .green { background-color: #efe; }
          .section { margin-bottom: 30px; }
          .issue-card, .todo-card, .rock-card { 
            border: 1px solid #e0e0e0; 
            border-radius: 8px; 
            padding: 12px; 
            margin-bottom: 10px; 
            background: #fafafa;
          }
          .issue-card.high { border-left: 4px solid #ef4444; }
          .issue-card.medium { border-left: 4px solid #f59e0b; }
          .issue-card.low { border-left: 4px solid #22c55e; }
          .rock-on-track { border-left: 4px solid #22c55e; }
          .rock-off-track { border-left: 4px solid #ef4444; }
          .rock-at-risk { border-left: 4px solid #f59e0b; }
          .badge { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 12px; 
            font-size: 11px; 
            font-weight: bold;
          }
          .badge-high { background: #fee2e2; color: #dc2626; }
          .badge-medium { background: #fef3c7; color: #d97706; }
          .badge-low { background: #dcfce7; color: #16a34a; }
          .badge-status { background: #e0e7ff; color: #4338ca; }
          .celebration { 
            padding: 10px 15px; 
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); 
            border-radius: 8px; 
            margin: 8px 0;
          }
          .progress-bar {
            background: #e5e7eb;
            border-radius: 4px;
            height: 8px;
            margin-top: 5px;
          }
          .progress-fill {
            height: 100%;
            border-radius: 4px;
            background: #22c55e;
          }
          .meta { color: #666; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>🏢 ${deptData.stores?.name || "Store"} - ${deptData.name}</h1>
        <p><strong>GM Overview Report</strong> | ${isYearlyView ? `${year} Monthly Trend` : `Q${quarter} ${year}`}</p>
    `;

    // ============ 1. ISSUES & TODOS SECTION ============
    html += `<div class="section"><h2>📋 Issues & To-Dos</h2>`;
    
    if (issues && issues.length > 0) {
      html += `<h3>Open Issues (${issues.length})</h3>`;
      issues.forEach(issue => {
        html += `
          <div class="issue-card ${issue.severity}">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${issue.title}</strong>
              <span class="badge badge-${issue.severity}">${issue.severity.toUpperCase()}</span>
            </div>
            ${issue.description ? `<p style="margin: 8px 0 0 0; color: #666;">${issue.description}</p>` : ''}
            <div class="meta" style="margin-top: 8px;">
              Status: <span class="badge badge-status">${issue.status.replace('_', ' ')}</span>
            </div>
          </div>
        `;
      });
    } else {
      html += `<p style="color: #666;">✅ No open issues</p>`;
    }

    if (todos && todos.length > 0) {
      html += `<h3>Pending To-Dos (${todos.length})</h3>`;
      todos.forEach(todo => {
        const assignee = todo.assigned_to ? profilesMap.get(todo.assigned_to)?.full_name || 'Unknown' : 'Unassigned';
        html += `
          <div class="todo-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${todo.title}</strong>
              <span class="badge badge-${todo.severity}">${todo.severity.toUpperCase()}</span>
            </div>
            ${todo.description ? `<p style="margin: 8px 0 0 0; color: #666;">${todo.description}</p>` : ''}
            <div class="meta" style="margin-top: 8px;">
              Assigned to: ${assignee} | Due: ${formatDate(todo.due_date)}
            </div>
          </div>
        `;
      });
    } else {
      html += `<p style="color: #666;">✅ No pending to-dos</p>`;
    }
    html += `</div>`;

    // ============ 2. SCORECARD SECTION ============
    html += `<div class="section"><h2>📊 GO Scorecard</h2>`;
    
    if (kpis && kpis.length > 0) {
      // Group KPIs by owner
      const kpisByOwner = new Map<string, any[]>();
      kpis.forEach(kpi => {
        const ownerId = kpi.assigned_to || "unassigned";
        if (!kpisByOwner.has(ownerId)) {
          kpisByOwner.set(ownerId, []);
        }
        kpisByOwner.get(ownerId)!.push(kpi);
      });

      Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
        const ownerName = ownerId === "unassigned" ? "Unassigned" : profilesMap.get(ownerId)?.full_name || "Unknown";
        html += `<h3>${ownerName}</h3><table><thead><tr><th>KPI</th><th>Target</th>`;
        periods.forEach(p => {
          html += `<th>${p.label}</th>`;
        });
        html += `</tr></thead><tbody>`;

        ownerKpis.forEach(kpi => {
          const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
          html += `<tr><td>${kpi.name}</td><td>${formatValue(target, kpi.metric_type, kpi.name)}</td>`;
          
          periods.forEach(p => {
            const entry = scorecardEntries?.find(e => e.kpi_id === kpi.id && e.month === p.identifier);
            
            let cellClass = "";
            if (entry?.actual_value !== null && entry?.actual_value !== undefined && target !== null && target !== 0) {
              const variance = kpi.metric_type === "percentage"
                ? entry.actual_value - target
                : ((entry.actual_value - target) / target) * 100;
              
              if (kpi.target_direction === "above") {
                if (variance >= 0) cellClass = "green";
                else if (variance >= -10) cellClass = "yellow";
                else cellClass = "red";
              } else {
                if (variance <= 0) cellClass = "green";
                else if (variance <= 10) cellClass = "yellow";
                else cellClass = "red";
              }
            }
            
            html += `<td class="${cellClass}">${formatValue(entry?.actual_value ?? null, kpi.metric_type, kpi.name)}</td>`;
          });
          html += `</tr>`;
        });
        html += `</tbody></table>`;
      });
    } else {
      html += `<p style="color: #666;">No KPIs configured</p>`;
    }
    html += `</div>`;

    // ============ 3. FINANCIAL SUMMARY SECTION ============
    html += `<div class="section"><h2>💰 Financial Summary</h2>`;
    
    // Define standard metrics
    const FINANCIAL_METRICS = [
      { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
      { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
      { display: "GP %", dbName: "gp_percent", type: "percentage" as const },
      { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
      { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const },
      { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
      { display: "Department Profit", dbName: "department_profit", type: "dollar" as const },
      { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const },
    ];

    html += `<table><thead><tr><th>Metric</th><th>Target</th>`;
    periods.forEach(p => {
      html += `<th>${p.label}</th>`;
    });
    html += `</tr></thead><tbody>`;

    FINANCIAL_METRICS.forEach(metric => {
      const target = finTargetsMap.get(metric.dbName);
      html += `<tr><td>${metric.display}</td><td>${target ? formatValue(target.value, metric.type) : '-'}</td>`;
      
      periods.forEach(p => {
        const entry = financialEntries?.find(e => e.metric_name === metric.dbName && e.month === p.identifier);
        let value = entry?.value ?? null;
        
        // Calculate derived values
        if (!entry && financialEntries) {
          const monthData: any = {};
          financialEntries.filter(e => e.month === p.identifier).forEach(e => {
            monthData[e.metric_name] = e.value;
          });
          
          if (metric.dbName === "gp_percent" && monthData.gp_net != null && monthData.total_sales != null && monthData.total_sales !== 0) {
            value = (monthData.gp_net / monthData.total_sales) * 100;
          } else if (metric.dbName === "sales_expense_percent" && monthData.sales_expense != null && monthData.gp_net != null && monthData.gp_net !== 0) {
            value = (monthData.sales_expense / monthData.gp_net) * 100;
          } else if (metric.dbName === "department_profit" && monthData.gp_net != null && monthData.sales_expense != null && monthData.total_fixed_expense != null) {
            value = monthData.gp_net - monthData.sales_expense - (monthData.semi_fixed_expense ?? 0) - monthData.total_fixed_expense;
          } else if (metric.dbName === "return_on_gross" && monthData.gp_net != null && monthData.sales_expense != null && monthData.total_fixed_expense != null && monthData.gp_net !== 0) {
            const deptProfit = monthData.gp_net - monthData.sales_expense - (monthData.semi_fixed_expense ?? 0) - monthData.total_fixed_expense;
            value = (deptProfit / monthData.gp_net) * 100;
          }
        }
        
        // Calculate status
        let cellClass = "";
        if (value !== null && target && target.value !== 0) {
          const variance = metric.type === "percentage"
            ? value - target.value
            : ((value - target.value) / target.value) * 100;
          
          if (target.direction === "above") {
            if (variance >= 0) cellClass = "green";
            else if (variance >= -10) cellClass = "yellow";
            else cellClass = "red";
          } else {
            if (variance <= 0) cellClass = "green";
            else if (variance <= 10) cellClass = "yellow";
            else cellClass = "red";
          }
        }
        
        html += `<td class="${cellClass}">${metric.type === "percentage" && value !== null ? `${value.toFixed(1)}%` : formatValue(value, metric.type)}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;

    // ============ 4. ROCKS SECTION ============
    html += `<div class="section"><h2>🪨 Rocks (${isYearlyView ? year : `Q${quarter} ${year}`})</h2>`;
    
    if (rocks && rocks.length > 0) {
      // Group rocks by quarter for yearly view
      if (isYearlyView) {
        const rocksByQuarter = new Map<number, any[]>();
        rocks.forEach(rock => {
          const q = rock.quarter;
          if (!rocksByQuarter.has(q)) rocksByQuarter.set(q, []);
          rocksByQuarter.get(q)!.push(rock);
        });

        [1, 2, 3, 4].forEach(q => {
          const quarterRocks = rocksByQuarter.get(q) || [];
          html += `<h3>Q${q} (${quarterRocks.length} rock${quarterRocks.length !== 1 ? 's' : ''})</h3>`;
          if (quarterRocks.length > 0) {
            quarterRocks.forEach(rock => {
              const assignee = rock.assigned_to ? profilesMap.get(rock.assigned_to)?.full_name || 'Unknown' : 'Unassigned';
              const statusClass = rock.status === 'on_track' ? 'rock-on-track' : 
                                 rock.status === 'off_track' ? 'rock-off-track' : 'rock-at-risk';
              html += `
                <div class="rock-card ${statusClass}">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>${rock.title}</strong>
                    <span class="badge badge-status">${rock.status?.replace('_', ' ') || 'on track'}</span>
                  </div>
                  ${rock.description ? `<p style="margin: 8px 0 0 0; color: #666;">${rock.description}</p>` : ''}
                  <div class="meta" style="margin-top: 8px;">
                    Assigned to: ${assignee} | Due: ${formatDate(rock.due_date)} | Progress: ${rock.progress_percentage || 0}%
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${rock.progress_percentage || 0}%;"></div>
                  </div>
                </div>
              `;
            });
          } else {
            html += `<p style="color: #888; font-style: italic;">No rocks</p>`;
          }
        });
      } else {
        rocks.forEach(rock => {
          const assignee = rock.assigned_to ? profilesMap.get(rock.assigned_to)?.full_name || 'Unknown' : 'Unassigned';
          const statusClass = rock.status === 'on_track' ? 'rock-on-track' : 
                             rock.status === 'off_track' ? 'rock-off-track' : 'rock-at-risk';
          html += `
            <div class="rock-card ${statusClass}">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong>${rock.title}</strong>
                <span class="badge badge-status">${rock.status?.replace('_', ' ') || 'on track'}</span>
              </div>
              ${rock.description ? `<p style="margin: 8px 0 0 0; color: #666;">${rock.description}</p>` : ''}
              <div class="meta" style="margin-top: 8px;">
                Assigned to: ${assignee} | Due: ${formatDate(rock.due_date)} | Progress: ${rock.progress_percentage || 0}%
              </div>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${rock.progress_percentage || 0}%;"></div>
              </div>
            </div>
          `;
        });
      }
    } else {
      html += `<p style="color: #666;">No rocks set for this quarter</p>`;
    }
    html += `</div>`;

    // ============ 5. CELEBRATIONS SECTION ============
    html += `<div class="section"><h2>🎉 Celebrations</h2>`;
    
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
    
    if ((birthdayProfiles && birthdayProfiles.length > 0) || (anniversaryProfiles && anniversaryProfiles.length > 0)) {
      if (birthdayProfiles && birthdayProfiles.length > 0) {
        html += `<h3>🎂 ${monthName} Birthdays</h3>`;
        birthdayProfiles.forEach(profile => {
          html += `
            <div class="celebration">
              <strong>${profile.full_name}</strong> - ${monthName} ${profile.birthday_day}
            </div>
          `;
        });
      }
      
      if (anniversaryProfiles && anniversaryProfiles.length > 0) {
        html += `<h3>🎊 Work Anniversaries</h3>`;
        anniversaryProfiles.forEach(profile => {
          const yearsOfService = now.getFullYear() - (profile.start_year || now.getFullYear());
          html += `
            <div class="celebration">
              <strong>${profile.full_name}</strong> - ${yearsOfService} year${yearsOfService !== 1 ? 's' : ''} of service!
            </div>
          `;
        });
      }
    } else {
      html += `<p style="color: #666;">No celebrations this month</p>`;
    }
    html += `</div>`;

    html += `
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
        <p style="color: #888; font-size: 11px;">
          This report was generated by GO Scorecard on ${new Date().toLocaleString()}
        </p>
      </body>
      </html>
    `;

    // ============ SEND EMAIL ============
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const recipients = recipientEmails && recipientEmails.length > 0 ? recipientEmails : [user.email!];
    console.log(`Sending GM Overview email to ${recipients.length} recipient(s)`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dealer Growth Solutions <noreply@dealergrowth.solutions>",
        to: recipients,
        subject: `${deptData.name} GM Overview - ${isYearlyView ? `${year} Monthly Trend` : `Q${quarter} ${year}`}`,
        html,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email API response:", emailResult);

    if (!emailResponse.ok) {
      throw new Error(`Email failed: ${JSON.stringify(emailResult)}`);
    }

    return new Response(JSON.stringify({ success: true, emailId: emailResult.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in GM Overview email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
