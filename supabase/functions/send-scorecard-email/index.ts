import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EmailRequest {
  year: number;
  quarter?: number;
  mode: "weekly" | "monthly" | "yearly";
  departmentId: string;
  recipientEmails?: string[];
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

function getAllMonthsForYear({ year }: { year: number }) {
  const months = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = 0; i < 12; i++) {
    months.push({
      label: monthNames[i],
      identifier: `${year}-${String(i + 1).padStart(2, '0')}`,
      type: "month" as const,
    });
  }
  
  return months;
}

// Monthly Trend mode shows only the selected year's 12 months
function getMonthlyTrendMonths({ year }: { year: number }) {
  const months: Array<{ label: string; identifier: string; type: "month" }> = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Only the selected year's 12 months
  for (let i = 0; i < 12; i++) {
    months.push({
      label: `${monthNames[i]} ${year}`,
      identifier: `${year}-${String(i + 1).padStart(2, '0')}`,
      type: "month",
    });
  }

  return months;
}

function formatValue(value: number | null, metricType: string, kpiName?: string): string {
  if (value === null || value === undefined) return "-";
  
  // CP Hours Per RO (including "Total CP Hours Per RO"), Total ELR, Total CP ELR, and Warranty ELR should always show 2 decimal places
  if (kpiName === "CP Hours Per RO" || kpiName === "Total CP Hours Per RO" || kpiName === "Total ELR" || kpiName === "Total CP ELR" || kpiName === "Warranty ELR") {
    return Number(value).toFixed(2);
  }
  
  // Total Labour Sales, CP Labour Sales Per RO, Total CP Labour Sales Per RO, CP ELR, and CP Labour Sales should show whole dollars
  if (kpiName === "Total Labour Sales" || kpiName === "CP Labour Sales Per RO" || kpiName === "Total CP Labour Sales Per RO" || kpiName === "CP ELR" || kpiName === "CP Labour Sales") {
    return `$${Math.round(value).toLocaleString()}`;
  }
  
  // Total Hours, CP Hours, Customer Pay Hours, CP RO's, and Total RO's should show whole numbers
  if (kpiName === "Total Hours" || kpiName === "CP Hours" || kpiName === "Customer Pay Hours" || kpiName === "CP RO's" || kpiName === "Total RO's") {
    return Math.round(value).toLocaleString();
  }
  
  // Internal ELR should show 2 decimal places with $
  if (kpiName === "Internal ELR") {
    return `$${Number(value).toFixed(2)}`;
  }
  
  if (metricType === "dollar") return `$${value.toLocaleString()}`;
  if (metricType === "percentage") return `${Math.round(value)}%`;
  
  // Default: if has decimals, show 2 decimal places
  const hasDecimals = value % 1 !== 0;
  if (hasDecimals) return Number(value).toFixed(2);
  return value.toLocaleString();
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

    const { year, quarter, mode, departmentId, recipientEmails }: EmailRequest = await req.json();

    console.log("Fetching scorecard data for email...", { year, quarter, mode, departmentId, recipientEmails });
    
    // Validate that quarter is provided for non-yearly modes
    if (mode !== "yearly" && !quarter) {
      throw new Error("Quarter is required for weekly and monthly modes");
    }

    // Fetch department with store and brand info (use LEFT join for brands since brand_id may be null)
    const { data: department, error: deptError } = await supabaseClient
      .from("departments")
      .select(`
        id,
        name,
        stores!inner(
          name,
          brand,
          brands(
            name
          )
        )
      `)
      .eq("id", departmentId)
      .single();

    if (deptError) {
      console.error("Error fetching department:", deptError);
      throw new Error("Department not found");
    }
    
    if (!department) {
      throw new Error("Department not found");
    }
    
    // Type the department properly
    const deptData = department as unknown as {
      id: string;
      name: string;
      stores: {
        name: string;
        brand: string | null;
        brands: { name: string } | null;
      };
    };
    
    console.log("Department loaded:", {
      department: deptData.name,
      store: deptData.stores?.name,
      brand: deptData.stores?.brands?.name || deptData.stores?.brand,
      departmentId: deptData.id
    });

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
    
    console.log(`Fetched ${kpis?.length || 0} KPIs for department ${departmentId}`);

    // Fetch KPI targets for the specific quarter (for monthly/weekly modes) or all quarters (for yearly mode)
    let kpiTargetsMap = new Map<string, number>();
    let kpiTargetsByQuarter = new Map<string, Map<number, number>>(); // kpi_id -> quarter -> target_value
    
    if (mode === "yearly") {
      // Fetch targets for all 4 quarters
      const { data: kpiTargets } = await supabaseClient
        .from("kpi_targets")
        .select("*")
        .eq("year", year)
        .in("kpi_id", kpis?.map(k => k.id) || []);
      
      kpiTargets?.forEach(t => {
        if (!kpiTargetsByQuarter.has(t.kpi_id)) {
          kpiTargetsByQuarter.set(t.kpi_id, new Map());
        }
        kpiTargetsByQuarter.get(t.kpi_id)!.set(t.quarter, t.target_value || 0);
      });
      
      console.log(`Fetched ${kpiTargets?.length || 0} KPI targets for all quarters of ${year}`);
    } else if (quarter) {
      // Fetch targets for specific quarter
      const { data: kpiTargets } = await supabaseClient
        .from("kpi_targets")
        .select("*")
        .eq("year", year)
        .eq("quarter", quarter)
        .in("kpi_id", kpis?.map(k => k.id) || []);
      
      kpiTargets?.forEach(t => {
        kpiTargetsMap.set(t.kpi_id, t.target_value || 0);
      });
      
      console.log(`Fetched ${kpiTargets?.length || 0} KPI targets for Q${quarter} ${year}`);
    }

    // Fetch scorecard entries
    // IMPORTANT: In the UI, when the user is on Monthly Trend view (quarter === -1) and chooses
    // "Monthly" or "Yearly Report", they expect the same rolling month window shown on screen.
    const periods = mode === "weekly"
      ? getWeekDates({ year, quarter: quarter! })
      : (mode === "yearly" || mode === "monthly") && quarter === -1
      ? getMonthlyTrendMonths({ year })
      : mode === "yearly"
      ? getAllMonthsForYear({ year })
      : getMonthsForQuarter({ year, quarter: quarter! });

    // CRITICAL: Verify KPI IDs belong to THIS department to prevent data leakage
    const kpiIds = kpis?.map((k) => k.id) || [];
    console.log(`Fetching scorecard entries for ${kpiIds.length} KPIs from department ${departmentId}`);

    // IMPORTANT: Match UI behavior
    // - monthly/yearly reports should only use monthly entries
    // - weekly reports should only use weekly entries
    // Also paginate to avoid the 1000-row default cap.
    const entryType = mode === "weekly" ? "weekly" : "monthly";

    const entries: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    // Constrain by period to reduce row count and ensure correct matching
    const monthIdentifiers =
      mode === "monthly" || mode === "yearly"
        ? periods
            .map((p) => ("identifier" in p ? p.identifier : ""))
            .filter(Boolean)
        : [];
    const weekStartDates =
      mode === "weekly"
        ? periods
            .map((p) => ("start" in p ? p.start.toISOString().split("T")[0] : ""))
            .filter(Boolean)
        : [];

    while (true) {
      let query = supabaseClient
        .from("scorecard_entries")
        .select(
          `
          *,
          kpi_definitions!inner(department_id)
        `
        )
        .in("kpi_id", kpiIds)
        .eq("kpi_definitions.department_id", departmentId)
        .eq("entry_type", entryType)
        .range(offset, offset + pageSize - 1);

      if (monthIdentifiers.length > 0) {
        query = query.in("month", monthIdentifiers);
      }
      if (weekStartDates.length > 0) {
        query = query.in("week_start_date", weekStartDates);
      }

      const { data: pageData, error: pageError } = await query;
      if (pageError) {
        console.error("Error fetching scorecard entries:", pageError);
        throw pageError;
      }

      if (!pageData || pageData.length === 0) break;
      entries.push(...pageData);

      if (pageData.length < pageSize) break;
      offset += pageSize;
    }

    console.log(`Fetched ${entries.length} scorecard entries for department ${departmentId}`);

    // Fetch financial entries for monthly and yearly modes
    // PAGINATION: financial_entries can exceed 1000 rows with sub-metrics
    let financialEntries: any[] = [];
    if (mode === "monthly" || mode === "yearly") {
      // Get the month identifiers
      const monthIdentifiers = periods.map(p => 'identifier' in p ? p.identifier : '').filter(Boolean);
      console.log("Fetching financial entries for months:", monthIdentifiers);
      
      let finOffset = 0;
      const finPageSize = 1000;

      while (true) {
        const { data: finPage, error: finError } = await supabaseClient
          .from("financial_entries")
          .select("*")
          .eq("department_id", departmentId)
          .in("month", monthIdentifiers)
          .range(finOffset, finOffset + finPageSize - 1);

        if (finError) {
          console.error("Error fetching financial entries:", finError);
          break;
        }
        if (!finPage || finPage.length === 0) break;

        financialEntries.push(...finPage);
        if (finPage.length < finPageSize) break;
        finOffset += finPageSize;
      }
      
      console.log("Financial entries fetched:", financialEntries.length);
    }

    // Fetch director notes
    let directorNotes = null;
    const periodType = mode === "weekly" ? "quarterly" : mode;
    let periodDate = "";
    
    if (mode === "yearly") {
      periodDate = `${year}`;
    } else if (mode === "monthly" && quarter) {
      // Use the last month of the quarter for monthly reports
      const lastMonthOfQuarter = quarter * 3;
      periodDate = `${year}-${String(lastMonthOfQuarter).padStart(2, '0')}`;
    } else if (mode === "weekly" && quarter) {
      periodDate = `Q${quarter}-${year}`;
    }
    
    console.log(`Fetching director notes for period: ${periodType} - ${periodDate}`);
    
    const { data: notesData } = await supabaseClient
      .from("director_notes")
      .select("*")
      .eq("department_id", departmentId)
      .eq("period_type", periodType)
      .eq("period_date", periodDate)
      .maybeSingle();
    
    if (notesData?.notes) {
      directorNotes = notesData.notes;
      console.log("Director notes found");
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
    const reportTitle = mode === "yearly" 
      ? `${year} Annual Report` 
      : `Q${quarter} ${year}`;
    const reportType = mode === "weekly" ? "Weekly" : mode === "yearly" ? "Yearly" : "Monthly";
    
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          h2 { color: #666; margin-top: 30px; }
          table { border-collapse: collapse; width: 100%; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: ${mode === "yearly" ? "9px" : "11px"}; }
          th { background-color: #f4f4f4; font-weight: bold; }
          .red { background-color: #fee; }
          .yellow { background-color: #ffc; }
          .green { background-color: #efe; }
          .director-notes {
            background-color: #f9f9f9;
            border-left: 4px solid #2563eb;
            padding: 12px 16px;
            margin: 20px 0;
          }
          .director-notes h3 {
            margin: 0 0 8px 0;
            color: #2563eb;
            font-size: 14px;
          }
          .director-notes p {
            margin: 0;
            line-height: 1.6;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <h1>${deptData.stores?.name || "Store"} - ${deptData.name} Scorecard</h1>
        <p><strong>${reportTitle}</strong> | <strong>${reportType} View</strong></p>
        ${directorNotes ? `
        <div class="director-notes">
          <h3>Director's Notes</h3>
          <p>${directorNotes}</p>
        </div>
        ` : ''}
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
        // For yearly mode, show all quarterly targets compactly; for other modes, show single target
        let displayTarget = '';
        if (mode === "yearly") {
          // Show all quarterly targets horizontally separated by slashes
          const q1 = kpiTargetsByQuarter.get(kpi.id)?.get(1) || kpi.target_value;
          const q2 = kpiTargetsByQuarter.get(kpi.id)?.get(2) || kpi.target_value;
          const q3 = kpiTargetsByQuarter.get(kpi.id)?.get(3) || kpi.target_value;
          const q4 = kpiTargetsByQuarter.get(kpi.id)?.get(4) || kpi.target_value;
          displayTarget = `${formatValue(q1, kpi.metric_type, kpi.name)}/${formatValue(q2, kpi.metric_type, kpi.name)}/${formatValue(q3, kpi.metric_type, kpi.name)}/${formatValue(q4, kpi.metric_type, kpi.name)}`;
        } else {
          const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
          displayTarget = formatValue(target, kpi.metric_type, kpi.name);
        }
        
        html += `<tr><td>${kpi.name}</td><td style="font-size: 8px; white-space: nowrap;">${displayTarget}</td>`;
        
        periods.forEach(p => {
          const entry = entries?.find(e => {
            if (mode === "weekly" && 'start' in p) {
              return e.kpi_id === kpi.id && 
                     e.week_start_date === p.start.toISOString().split('T')[0];
            } else if ((mode === "monthly" || mode === "yearly") && 'identifier' in p) {
              return e.kpi_id === kpi.id && e.month === p.identifier;
            }
            return false;
          });

          // Determine target value based on mode
          let targetValue = kpi.target_value;
          if (mode === "yearly" && 'identifier' in p) {
            // Get quarter from month identifier
            const monthIndex = parseInt(p.identifier.split('-')[1]) - 1;
            const periodQuarter = Math.ceil((monthIndex + 1) / 3);
            
            if (kpiTargetsByQuarter.has(kpi.id)) {
              targetValue = kpiTargetsByQuarter.get(kpi.id)!.get(periodQuarter) || kpi.target_value;
            }
          } else if (mode !== "yearly" && kpiTargetsMap.has(kpi.id)) {
            targetValue = kpiTargetsMap.get(kpi.id)!;
          }

          // Calculate status if we have an entry with a value
          // UNIVERSAL LOGIC: target value of 0 means "no target" - no status indicator
          let cellClass = "";
          if (entry?.actual_value !== null && entry?.actual_value !== undefined && targetValue !== null && targetValue !== 0) {
            const actualValue = entry.actual_value;
            const direction = kpi.target_direction;
            
            // UNIVERSAL VARIANCE CALCULATION: percentage types use direct subtraction, others use percentage change
            const variance = kpi.metric_type === "percentage"
              ? actualValue - targetValue
              : ((actualValue - targetValue) / targetValue) * 100;
            
            console.log(`KPI: ${kpi.name}, Period: ${('identifier' in p ? p.identifier : 'week')}, Actual: ${actualValue}, Target: ${targetValue}, Direction: ${direction}, Variance: ${variance.toFixed(2)}%`);
            
            if (direction === "above") {
              if (variance >= 0) cellClass = "green";
              else if (variance >= -10) cellClass = "yellow";
              else cellClass = "red";
            } else {
              if (variance <= 0) cellClass = "green";
              else if (variance <= 10) cellClass = "yellow";
              else cellClass = "red";
            }
            
            console.log(`  -> Status: ${cellClass || 'none'}`);
          } else {
            console.log(`KPI: ${kpi.name}, Period: ${('identifier' in p ? p.identifier : 'week')}, Entry: ${entry ? 'found' : 'not found'}, Actual: ${entry?.actual_value}, Target: ${targetValue}`);
          }
          
          html += `<td class="${cellClass}">${formatValue(entry?.actual_value, kpi.metric_type, kpi.name)}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    });

    // Add financial metrics for monthly and yearly modes
    if (mode === "monthly" || mode === "yearly") {
      // Fetch financial targets for this year
      const { data: finTargets } = await supabaseClient
        .from("financial_targets")
        .select("*")
        .eq("department_id", departmentId)
        .eq("year", year);
      
      const targetsMap = new Map<string, { value: number; direction: string }>();
      finTargets?.forEach(t => {
        const key = `${t.metric_name}_${t.quarter}`;
        targetsMap.set(key, { value: t.target_value, direction: t.target_direction });
      });
      
      // Get brand name from the brands relationship (always use brand_id relationship, not legacy brand field)
      const brandName = deptData?.stores?.brands?.name || deptData?.stores?.brand || null;
      console.log("Using brand for metrics:", brandName);
      
      // Define metrics based on brand - must match EXACTLY what's in the UI
      const getFinancialMetrics = (brand: string | null) => {
        const isNissan = brand?.toLowerCase().includes('nissan');
        const isFord = brand?.toLowerCase().includes('ford');
        const isMazda = brand?.toLowerCase().includes('mazda');
        const isStellantis = brand ? ['ram', 'dodge', 'chrysler', 'jeep', 'fiat', 'alfa romeo', 'stellantis'].some(b => brand.toLowerCase().includes(b)) : false;
        
        if (isFord) {
          // Ford-specific metrics - exact order from financialMetrics.ts
          return [
            { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
            { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
            { display: "GP %", dbName: "gp_percent", type: "percentage" as const, calc: (data: any) => 
              (data.gp_net != null && data.total_sales != null && data.total_sales !== 0) ? (data.gp_net / data.total_sales) * 100 : null },
            { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
            { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.sales_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.sales_expense / data.gp_net) * 100 : null },
            { display: "Adjusted Selling Gross", dbName: "adjusted_selling_gross", type: "dollar" as const },
            { display: "Net Selling Gross", dbName: "net_selling_gross", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null) ? data.gp_net - data.sales_expense : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - data.total_fixed_expense : null },
            { display: "Dealer Salary", dbName: "dealer_salary", type: "dollar" as const },
            { display: "Parts Transfer", dbName: "parts_transfer", type: "dollar" as const, calc: (data: any) => {
              if (data.adjusted_selling_gross == null || data.gp_net == null || data.sales_expense == null) return null;
              const netSellingGross = data.gp_net - data.sales_expense;
              return data.adjusted_selling_gross - netSellingGross;
            }},
            { display: "Net Operating Profit", dbName: "net", type: "dollar" as const, calc: (data: any) => {
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || 
                  data.dealer_salary == null || data.adjusted_selling_gross == null) return null;
              
              const departmentProfit = data.gp_net - data.sales_expense - data.total_fixed_expense;
              const netSellingGross = data.gp_net - data.sales_expense;
              const partsTransfer = data.adjusted_selling_gross - netSellingGross;
              return departmentProfit - data.dealer_salary + partsTransfer;
            }},
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || data.gp_net === 0) return null;
              const departmentProfit = data.gp_net - data.sales_expense - data.total_fixed_expense;
              return (departmentProfit / data.gp_net) * 100;
            }}
          ];
        } else if (isMazda) {
          // Mazda-specific metrics - no Parts Transfer or Net Operating Profit
          return [
            { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
            { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
            { display: "GP %", dbName: "gp_percent", type: "percentage" as const, calc: (data: any) => 
              (data.gp_net != null && data.total_sales != null && data.total_sales !== 0) ? (data.gp_net / data.total_sales) * 100 : null },
            { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
            { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.sales_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.sales_expense / data.gp_net) * 100 : null },
            { display: "Semi Fixed Expense", dbName: "semi_fixed_expense", type: "dollar" as const },
            { display: "Semi Fixed Expense %", dbName: "semi_fixed_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.semi_fixed_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.semi_fixed_expense / data.gp_net) * 100 : null },
            { display: "Net Selling Gross", dbName: "net_selling_gross", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || data.gp_net === 0) return null;
              const semiFixed = data.semi_fixed_expense ?? 0;
              const departmentProfit = data.gp_net - data.sales_expense - semiFixed - data.total_fixed_expense;
              return (departmentProfit / data.gp_net) * 100;
            }}
          ];
        } else if (isStellantis) {
          // Stellantis brands (Ram, Dodge, Chrysler, Jeep) - no Parts Transfer or Net Operating Profit
          return [
            { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
            { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
            { display: "GP %", dbName: "gp_percent", type: "percentage" as const, calc: (data: any) => 
              (data.gp_net != null && data.total_sales != null && data.total_sales !== 0) ? (data.gp_net / data.total_sales) * 100 : null },
            { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
            { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.sales_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.sales_expense / data.gp_net) * 100 : null },
            { display: "Semi Fixed Expense", dbName: "semi_fixed_expense", type: "dollar" as const },
            { display: "Semi Fixed Expense %", dbName: "semi_fixed_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.semi_fixed_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.semi_fixed_expense / data.gp_net) * 100 : null },
            { display: "Net Selling Gross", dbName: "net_selling_gross", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || data.gp_net === 0) return null;
              const semiFixed = data.semi_fixed_expense ?? 0;
              const departmentProfit = data.gp_net - data.sales_expense - semiFixed - data.total_fixed_expense;
              return (departmentProfit / data.gp_net) * 100;
            }}
          ];
        } else {
          // GMC/Chevrolet/Nissan/Other brands - standard metrics
          return [
            { display: "Total Sales", dbName: "total_sales", type: "dollar" as const },
            { display: "GP Net", dbName: "gp_net", type: "dollar" as const },
            { display: "GP %", dbName: "gp_percent", type: "percentage" as const, calc: (data: any) => 
              (data.gp_net != null && data.total_sales != null && data.total_sales !== 0) ? (data.gp_net / data.total_sales) * 100 : null },
            { display: "Sales Expense", dbName: "sales_expense", type: "dollar" as const },
            { display: "Sales Expense %", dbName: "sales_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.sales_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.sales_expense / data.gp_net) * 100 : null },
            { display: "Semi Fixed Expense", dbName: "semi_fixed_expense", type: "dollar" as const },
            { display: "Semi Fixed Expense %", dbName: "semi_fixed_expense_percent", type: "percentage" as const, calc: (data: any) =>
              (data.semi_fixed_expense != null && data.gp_net != null && data.gp_net !== 0) ? (data.semi_fixed_expense / data.gp_net) * 100 : null },
            { display: "Net Selling Gross", dbName: "net_selling_gross", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Parts Transfer", dbName: "parts_transfer", type: "dollar" as const },
            { display: "Net Operating Profit", dbName: "net", type: "dollar" as const },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || data.gp_net === 0) return null;
              const semiFixed = data.semi_fixed_expense ?? 0;
              const departmentProfit = data.gp_net - data.sales_expense - semiFixed - data.total_fixed_expense;
              return (departmentProfit / data.gp_net) * 100;
            }}
          ];
        }
      };
      
      let FINANCIAL_METRICS = getFinancialMetrics(brandName);
      
      // Filter out semi fixed expense metrics for Stellantis Service/Parts departments
      const isStellantis = brandName ? brandName.toLowerCase().includes('stellantis') : false;
      const isServiceOrParts = department?.name ? ['service', 'parts'].some(d => department.name.toLowerCase().includes(d)) : false;
      
      if (isStellantis && isServiceOrParts) {
        FINANCIAL_METRICS = FINANCIAL_METRICS.filter(m => !['semi_fixed_expense', 'semi_fixed_expense_percent'].includes(m.dbName));
      }
      
      html += `<h2>Financial Metrics</h2><table><thead><tr><th>Metric</th>`;
      
      // Add Q1-Q4 targets column for yearly mode
      if (mode === "yearly") {
        html += `<th>Q1/Q2/Q3/Q4 Targets</th>`;
      }
      
      periods.forEach(p => {
        html += `<th>${p.label}</th>`;
      });
      html += `</tr></thead><tbody>`;
      
      FINANCIAL_METRICS.forEach(metric => {
        html += `<tr><td>${metric.display}</td>`;
        
        // Add Q1-Q4 targets cell for yearly mode
        if (mode === "yearly") {
          const q1Target = targetsMap.get(`${metric.dbName}_1`);
          const q2Target = targetsMap.get(`${metric.dbName}_2`);
          const q3Target = targetsMap.get(`${metric.dbName}_3`);
          const q4Target = targetsMap.get(`${metric.dbName}_4`);
          
          const q1Value = q1Target?.value ?? 0;
          const q2Value = q2Target?.value ?? 0;
          const q3Value = q3Target?.value ?? 0;
          const q4Value = q4Target?.value ?? 0;
          
          const displayTarget = `${formatValue(q1Value, metric.type)}/${formatValue(q2Value, metric.type)}/${formatValue(q3Value, metric.type)}/${formatValue(q4Value, metric.type)}`;
          html += `<td style="font-weight: bold; background-color: #f9f9f9;">${displayTarget}</td>`;
        }
        periods.forEach(p => {
          if ('identifier' in p) {
            // Gather all financial data for this month to calculate percentages
            const monthData: any = {};
            financialEntries.forEach(e => {
              if (e.month === p.identifier) {
                monthData[e.metric_name] = e.value;
              }
            });
            
            // Log all month data for debugging
            console.log(`Financial data for ${p.identifier}:`, {
              monthIdentifier: p.identifier,
              dataKeys: Object.keys(monthData),
              gp_net: monthData.gp_net,
              sales_expense: monthData.sales_expense,
              semi_fixed_expense: monthData.semi_fixed_expense,
              total_fixed_expense: monthData.total_fixed_expense,
              parts_transfer: monthData.parts_transfer,
              net: monthData.net
            });
            
            let value = null;
            if (metric.calc) {
              value = metric.calc(monthData);
              // Debug logging for calculated metrics
              if (metric.display === "Return on Gross" || metric.display === "Department Profit") {
                console.log(`${metric.display} calc for ${p.identifier}:`, {
                  metric: metric.dbName,
                  monthData,
                  calculatedValue: value,
                  hasGpNet: monthData.gp_net != null,
                  hasSalesExpense: monthData.sales_expense != null,
                  hasSemiFixed: monthData.semi_fixed_expense != null,
                  hasFixedExpense: monthData.total_fixed_expense != null
                });
              }
            } else {
              const entry = financialEntries.find(e => 
                e.metric_name === metric.dbName && e.month === p.identifier
              );
              value = entry?.value || null;
            }
            
            // Determine quarter from month identifier
            const monthIndex = parseInt(p.identifier.split('-')[1]) - 1;
            const quarter = Math.ceil((monthIndex + 1) / 3);
            
            // Get target for this metric and quarter
            const targetKey = `${metric.dbName}_${quarter}`;
            const target = targetsMap.get(targetKey);
            
            // Calculate status - MUST match UI logic exactly
            // UI treats target value of 0 as "no target" (falsy check), so we must do the same
            let cellClass = "";
            if (value !== null && target && target.value !== null && target.value !== 0) {
              const targetValue = target.value;
              const direction = target.direction;
              
              // Match UI variance calculation: percentage types use direct subtraction, dollar types use percentage change
              const variance = metric.type === "percentage"
                ? value - targetValue
                : ((value - targetValue) / targetValue) * 100;
              
              if (direction === "above") {
                if (variance >= 0) cellClass = "green";
                else if (variance >= -10) cellClass = "yellow";
                else cellClass = "red";
              } else {
                if (variance <= 0) cellClass = "green";
                else if (variance <= 10) cellClass = "yellow";
                else cellClass = "red";
              }
            }
            
            if (metric.type === "percentage" && value !== null) {
              html += `<td class="${cellClass}">${value.toFixed(1)}%</td>`;
            } else {
              html += `<td class="${cellClass}">${formatValue(value, metric.type)}</td>`;
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

    // Use provided recipients or fall back to the authenticated user
    const recipients = recipientEmails && recipientEmails.length > 0 ? recipientEmails : [user.email!];
    
    console.log(`Sending email to ${recipients.length} recipient(s):`, recipients);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Dealer Growth Solutions <noreply@dealergrowth.solutions>",
        to: recipients,
        subject: mode === "yearly" 
          ? `${department.name} Scorecard - ${year} Annual Report`
          : `${department.name} Scorecard - Q${quarter} ${year}`,
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
