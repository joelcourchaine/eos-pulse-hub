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
  mode: "weekly" | "monthly" | "yearly" | "quarterly-trend";
  departmentId: string;
  recipientEmails?: string[];
  roleFilter?: string;
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

// Quarterly Trend mode shows rolling 5 quarters ending at current quarter
// This matches the UI's Quarter Trend view
function getQuarterlyTrendPeriods({ year }: { year: number }) {
  const quarters: Array<{ 
    label: string; 
    identifier: string; 
    type: "quarter"; 
    year: number; 
    quarter: number;
    months: string[];
  }> = [];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;
  
  // Start from Q1 of ACTUAL previous year (ignore passed year parameter)
  // This matches the UI's Quarter Trend view which always shows current rolling window
  let qYear = currentYear - 1;
  let q = 1;
  
  // Generate quarters from Q1 of previous year up to current quarter
  while (qYear < currentYear || (qYear === currentYear && q <= currentQuarter)) {
    const months: string[] = [];
    for (let m = 0; m < 3; m++) {
      const monthIndex = (q - 1) * 3 + m;
      months.push(`${qYear}-${String(monthIndex + 1).padStart(2, '0')}`);
    }
    
    quarters.push({
      label: `Q${q} ${qYear}`,
      identifier: `${qYear}-Q${q}`,
      type: "quarter",
      year: qYear,
      quarter: q,
      months,
    });
    
    q++;
    if (q > 4) {
      q = 1;
      qYear++;
    }
  }
  
  return quarters;
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

    const { year, quarter, mode, departmentId, recipientEmails, roleFilter }: EmailRequest = await req.json();

    console.log("Fetching scorecard data for email...", { year, quarter, mode, departmentId, recipientEmails });
    
    // Validate that quarter is provided for non-yearly and non-quarterly-trend modes
    // Use == null to allow quarter = 0 (Quarter Trend mode) while catching undefined/null
    if (mode !== "yearly" && mode !== "quarterly-trend" && quarter == null) {
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
    // For quarterly-trend mode, we use the quarterly periods which contain their constituent months.
    const quarterlyPeriods = mode === "quarterly-trend" ? getQuarterlyTrendPeriods({ year }) : null;
    const periods = mode === "weekly"
      ? getWeekDates({ year, quarter: quarter! })
      : mode === "quarterly-trend"
      ? quarterlyPeriods!
      : (mode === "yearly" || mode === "monthly") && (quarter === -1 || quarter === 0)
      ? getMonthlyTrendMonths({ year })
      : mode === "yearly"
      ? getAllMonthsForYear({ year })
      : getMonthsForQuarter({ year, quarter: quarter! });

    // CRITICAL: Verify KPI IDs belong to THIS department to prevent data leakage
    const kpiIds = kpis?.map((k) => k.id) || [];
    console.log(`Fetching scorecard entries for ${kpiIds.length} KPIs from department ${departmentId}`);

    // IMPORTANT: Match UI behavior
    // - monthly/yearly/quarterly-trend reports should only use monthly entries
    // - weekly reports should only use weekly entries
    // Also paginate to avoid the 1000-row default cap.
    const entryType = mode === "weekly" ? "weekly" : "monthly";

    const entries: any[] = [];
    const pageSize = 1000;
    let offset = 0;

    // Constrain by period to reduce row count and ensure correct matching
    // For quarterly-trend, we need all months from the quarterly periods
    let monthIdentifiers: string[] = [];
    if (mode === "monthly" || mode === "yearly") {
      monthIdentifiers = periods
        .map((p) => ("identifier" in p ? p.identifier : ""))
        .filter(Boolean);
    } else if (mode === "quarterly-trend" && quarterlyPeriods) {
      // Collect all months from all quarters
      monthIdentifiers = quarterlyPeriods.flatMap((q) => q.months);
    }
    
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

    // Fetch financial entries for monthly, yearly, and quarterly-trend modes
    // PAGINATION: financial_entries can exceed 1000 rows with sub-metrics
    let financialEntries: any[] = [];
    if (mode === "monthly" || mode === "yearly" || mode === "quarterly-trend") {
      // Get the month identifiers - for quarterly-trend use the already computed monthIdentifiers
      const finMonthIdentifiers = mode === "quarterly-trend" 
        ? monthIdentifiers 
        : periods.map(p => 'identifier' in p ? p.identifier : '').filter(Boolean);
      console.log("Fetching financial entries for months:", finMonthIdentifiers);
      
      let finOffset = 0;
      const finPageSize = 1000;

      while (true) {
        const { data: finPage, error: finError } = await supabaseClient
          .from("financial_entries")
          .select("*")
          .eq("department_id", departmentId)
          .in("month", finMonthIdentifiers)
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

    // Precompute month data once (including synthesized parent totals from sub-metrics)
    // This matches UI behavior where parent entries can be absent when a statement import only provides sub-line-items.
    const financialDataByMonth = new Map<string, Record<string, number | null>>();
    if (mode === "monthly" || mode === "yearly" || mode === "quarterly-trend") {
      for (const e of financialEntries) {
        const month = e.month as string | undefined;
        const metricName = e.metric_name as string | undefined;
        if (!month || !metricName) continue;

        if (!financialDataByMonth.has(month)) {
          financialDataByMonth.set(month, {});
        }
        financialDataByMonth.get(month)![metricName] = e.value ?? null;
      }

      const synthesizeParentFromSubs = (monthData: Record<string, number | null>, parentKey: string) => {
        if (monthData[parentKey] != null) return;
        const prefix = `sub:${parentKey}:`;
        let sum = 0;
        let hasAny = false;

        for (const [k, v] of Object.entries(monthData)) {
          if (!k.startsWith(prefix)) continue;
          if (v == null) continue;
          hasAny = true;
          sum += v;
        }

        if (hasAny) {
          monthData[parentKey] = sum;
        }
      };

      for (const monthData of financialDataByMonth.values()) {
        // Synthesize parent totals from sub-metrics
        synthesizeParentFromSubs(monthData, "sales_expense");
        synthesizeParentFromSubs(monthData, "gp_net");
        synthesizeParentFromSubs(monthData, "total_sales");
        synthesizeParentFromSubs(monthData, "semi_fixed_expense");
        synthesizeParentFromSubs(monthData, "total_fixed_expense");
        synthesizeParentFromSubs(monthData, "total_direct_expenses");
      }
    }
    
    // For quarterly-trend, precompute quarterly aggregated data from monthly data
    // CRITICAL: Must match UI behavior - show quarterly AVERAGES (sum / month count), not totals
    const financialDataByQuarter = new Map<string, Record<string, number | null>>();
    const financialMonthCountByQuarter = new Map<string, Record<string, number>>(); // Track months with data per metric
    
    if (mode === "quarterly-trend" && quarterlyPeriods) {
      for (const qPeriod of quarterlyPeriods) {
        const quarterSums: Record<string, number> = {};
        const monthCounts: Record<string, number> = {};
        
        // Sum monthly data for this quarter and count months with data
        for (const month of qPeriod.months) {
          const monthData = financialDataByMonth.get(month);
          if (!monthData) continue;
          
          for (const [key, value] of Object.entries(monthData)) {
            if (value == null) continue;
            quarterSums[key] = (quarterSums[key] ?? 0) + value;
            monthCounts[key] = (monthCounts[key] ?? 0) + 1;
          }
        }
        
        // Convert sums to averages for dollar metrics (UI shows monthly averages per quarter)
        // For percentage metrics, we'll recalculate from dollar totals later
        const quarterData: Record<string, number | null> = {};
        for (const [key, sum] of Object.entries(quarterSums)) {
          const count = monthCounts[key] || 1;
          // Store both sum (for percentage calculations) and average (for display)
          // Dollar metrics display as average, percentage metrics recalculate from sums
          quarterData[key] = sum; // Keep as sum - we'll divide later for dollar display
        }
        
        financialDataByQuarter.set(qPeriod.identifier, quarterData);
        financialMonthCountByQuarter.set(qPeriod.identifier, monthCounts);
      }
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

    // Apply roleFilter if provided: fetch user_roles AND profiles.role as fallback, filter owners by role
    if (roleFilter && roleFilter !== "all") {
      const allOwnerIds = Array.from(kpisByOwner.keys()).filter(id => id !== "unassigned");
      if (allOwnerIds.length > 0) {
        const [{ data: userRolesData }, { data: profileRolesData }] = await Promise.all([
          supabaseClient.from("user_roles").select("user_id, role").in("user_id", allOwnerIds),
          supabaseClient.from("profiles").select("id, role").in("id", allOwnerIds),
        ]);

        // Build merged role map: profiles.role as base, user_roles takes precedence
        const ownerRoleMap = new Map<string, string>();
        profileRolesData?.forEach(p => { if (p.role) ownerRoleMap.set(p.id, p.role as string); });
        userRolesData?.forEach(ur => { ownerRoleMap.set(ur.user_id, ur.role as string); });

        const usersWithRole = new Set(
          Array.from(ownerRoleMap.entries())
            .filter(([, role]) => role === roleFilter)
            .map(([userId]) => userId)
        );
        
        for (const ownerId of Array.from(kpisByOwner.keys())) {
          if (ownerId !== "unassigned" && !usersWithRole.has(ownerId)) {
            kpisByOwner.delete(ownerId);
          }
        }
      }
    }

    // Build HTML
    const reportTitle = mode === "yearly" 
      ? `${year} Annual Report`
      : mode === "quarterly-trend"
      ? `Quarterly Trend (${year - 1}-${year})`
      : `Q${quarter} ${year}`;
    const reportType = mode === "weekly" ? "Weekly" : mode === "yearly" ? "Yearly" : mode === "quarterly-trend" ? "Quarterly Trend" : "Monthly";
    
    // Helper function to convert cell class to inline style
    const getCellStyle = (cellClass: string, baseFontSize: string, isWeekly = false): string => {
      const baseStyle = `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize}; font-weight: 600;`;
      if (isWeekly) {
        switch (cellClass) {
          case "green": return `${baseStyle} background-color: #059669; color: #ffffff;`;
          case "yellow": return `${baseStyle} background-color: #d97706; color: #ffffff;`;
          case "red": return `${baseStyle} background-color: #dc2626; color: #ffffff;`;
          default: return `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize}; background-color: #f8fafc; color: #64748b;`;
        }
      }
      switch (cellClass) {
        case "green": return `${baseStyle} background-color: #d1fae5; color: #065f46;`;
        case "yellow": return `${baseStyle} background-color: #fef3c7; color: #92400e;`;
        case "red": return `${baseStyle} background-color: #fee2e2; color: #991b1b;`;
        default: return `border: 1px solid #d1d5db; padding: 3px 4px; text-align: center; font-size: ${baseFontSize};`;
      }
    };
    
    const baseFontSize = mode === "yearly" || mode === "weekly" ? "8px" : "11px";
    const isWeeklyMode = mode === "weekly";
    
    // Navy styles for weekly mode  
    const navyBg = "#1e2d47";
    const navyHeaderStyle = `background-color: ${navyBg}; color: #ffffff; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: left; border: 1px solid #2d3f5e; white-space: nowrap;`;
    const navyTargetStyle = `background-color: ${navyBg}; color: #ffffff; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: center; border: 1px solid #2d3f5e; white-space: nowrap;`;
    const weekHeaderStyle = `background-color: #e2e8f0; color: #1e293b; padding: 3px 4px; font-size: 9px; font-weight: 700; text-align: center; border: 1px solid #cbd5e1; white-space: nowrap;`;
    const kpiNameStyle = `background-color: #f8fafc; padding: 3px 5px; font-size: ${baseFontSize}; font-weight: 600; text-align: left; border: 1px solid #d1d5db; color: #1e293b; white-space: nowrap; max-width: 140px; overflow: hidden;`;
    const qtotalHeaderStyle = `background-color: #334155; color: #ffffff; padding: 3px 4px; font-size: 9px; font-weight: 700; text-align: center; border: 1px solid #475569;`;
    const qtotalCellStyle = `background-color: #f1f5f9; color: #1e293b; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: center; border: 1px solid #cbd5e1;`;
    
    const thStyle = `border: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: ${baseFontSize}; background-color: #f4f4f4; font-weight: bold;`;
    const tdStyle = `border: 1px solid #ddd; padding: 6px 4px; text-align: left; font-size: ${baseFontSize};`;

    // Compute summary stats for weekly mode header
    let weeksWithData = 0;
    let totalCells = 0;
    let greenCells = 0;
    if (isWeeklyMode && kpis && entries) {
      const weekDates = periods.map((p: any) => 'start' in p ? p.start.toISOString().split('T')[0] : null).filter(Boolean);
      const weeksSet = new Set<string>();
      for (const entry of entries) {
        if (entry.week_start_date && entry.actual_value !== null) weeksSet.add(entry.week_start_date);
      }
      weeksWithData = weeksSet.size;

      for (const kpi of (kpis || [])) {
        const targetValue = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
        for (const wDate of weekDates) {
          const entry = entries.find((e: any) => e.kpi_id === kpi.id && e.week_start_date === wDate);
          if (entry?.actual_value !== null && entry?.actual_value !== undefined && targetValue && targetValue !== 0) {
            totalCells++;
            const variance = kpi.metric_type === "percentage"
              ? entry.actual_value - targetValue
              : ((entry.actual_value - targetValue) / Math.abs(targetValue)) * 100;
            if (kpi.target_direction === "above" ? variance >= 0 : variance <= 0) greenCells++;
          }
        }
      }
    }
    const greenRate = totalCells > 0 ? Math.round((greenCells / totalCells) * 100) : 0;

    const storeName = deptData.stores?.name || "Store";
    const deptName = deptData.name;

    let html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; background-color: #f1f5f9;">
<div style="max-width: 1200px; margin: 0 auto;">`;

    if (isWeeklyMode) {
      html += `
  <!-- Navy header banner -->
  <div style="background-color: ${navyBg}; color: #ffffff; padding: 20px 24px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
    <div style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${storeName} — ${deptName} Scorecard</div>
    <table style="border-collapse: collapse; margin-top: 10px; width: 100%;"><tr>
      <td style="padding-right: 12px; white-space: nowrap;"><span style="background-color: #2d4a6b; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #ffffff; display: inline-block;">${reportTitle} · 13 weeks</span></td>
      <td style="padding-right: 12px; white-space: nowrap;"><span style="background-color: #2d4a6b; border-radius: 4px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #ffffff; display: inline-block;">Weeks Entered: ${weeksWithData}/13</span></td>
    </tr></table>
  </div>`;
    } else {
      html += `
  <div style="background-color: ${navyBg}; color: #ffffff; padding: 18px 24px; border-radius: 8px 8px 0 0;">
    <div style="font-size: 18px; font-weight: 800;">${storeName} — ${deptName}</div>
    <div style="margin-top: 6px; font-size: 13px; color: rgba(255,255,255,0.75);">${reportTitle} · ${reportType} View</div>
  </div>`;
    }

    // Director's Notes
    if (directorNotes) {
      html += `
  <div style="background-color: #ffffff; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 16px 0; border-radius: 0 4px 4px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
    <div style="font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Director's Notes</div>
    <div style="font-size: 13px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${directorNotes}</div>
  </div>`;
    }

    // Add KPI tables
    if (isWeeklyMode) {
      // ONE table, ONE header, owner separator rows inside tbody
      const totalCols = 2 + periods.length + 1; // KPI + Target + weeks + Q-Total
      html += `
  <div style="margin-top: 8px; border-radius: 0 0 6px 6px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
  <div style="overflow-x: auto;">
  <table style="border-collapse: collapse; width: 100%; min-width: 900px;">
    <thead><tr>
      <th style="${navyHeaderStyle} min-width: 140px;">KPI</th>
      <th style="${navyTargetStyle} min-width: 60px;">Target</th>`;
      periods.forEach((p: any, i: number) => {
        html += `<th style="${weekHeaderStyle} min-width: 55px;">WK ${i + 1}<br/><span style="font-size: 9px; font-weight: 500; color: #64748b;">${p.label}</span></th>`;
      });
      html += `<th style="${qtotalHeaderStyle} min-width: 65px;">Q-Total</th></tr></thead><tbody>`;

      // Detect Available / Sold / Productivity KPI IDs by name (same as ScorecardGrid)
      const allKpisFlat: any[] = Array.from(kpisByOwner.values()).flat();
      const availKpiIds = new Set(allKpisFlat.filter((k: any) => k.name.toLowerCase().includes('available')).map((k: any) => k.id));
      // Match UI logic: sold KPIs are unit-type KPIs that aren't Available Hours or Productivity
      const soldKpiIds = new Set(allKpisFlat.filter((k: any) => k.metric_type === 'unit' && k.name !== 'Available Hours' && k.name !== 'Productivity').map((k: any) => k.id));
      // Productivity target: find a % KPI whose name includes 'product'
      const productivityKpi = allKpisFlat.find((k: any) => k.metric_type === 'percentage' && k.name.toLowerCase().includes('product'));
      const productivityTarget = productivityKpi
        ? (kpiTargetsMap.has(productivityKpi.id) ? kpiTargetsMap.get(productivityKpi.id)! : productivityKpi.target_value) ?? 115
        : 115;

      // Per-week avail/sold totals (for bottom totals section)
      const weekAvailTotals: (number | null)[] = periods.map(() => null);
      const weekSoldTotals: (number | null)[] = periods.map(() => null);

      Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
        const ownerName = ownerId === "unassigned" ? "Unassigned" : profilesMap.get(ownerId)?.full_name || "Unknown";
        // Owner separator row
        html += `<tr><td colspan="${totalCols}" style="background-color: #2d3f5e; color: #ffffff; padding: 4px 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.2px; border: 1px solid #1e2d47;">${ownerName}</td></tr>`;

        ownerKpis.forEach((kpi: any) => {
          const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
          const displayTarget = formatValue(target, kpi.metric_type, kpi.name);
          html += `<tr><td style="${kpiNameStyle}">${kpi.name}</td><td style="${navyTargetStyle} min-width: 50px;">${displayTarget}</td>`;

          const periodValues: number[] = [];

          periods.forEach((p: any, pIdx: number) => {
            const entry = entries?.find((e: any) =>
              'start' in p
                ? e.kpi_id === kpi.id && e.week_start_date === p.start.toISOString().split('T')[0]
                : false
            );
            let targetValue = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
            let cellClass = "";
            if (entry?.actual_value !== null && entry?.actual_value !== undefined && targetValue !== null && targetValue !== 0) {
              const actualValue = entry.actual_value;
              periodValues.push(actualValue);
              // Accumulate avail/sold per-week totals
              if (availKpiIds.has(kpi.id)) weekAvailTotals[pIdx] = (weekAvailTotals[pIdx] ?? 0) + actualValue;
              if (soldKpiIds.has(kpi.id)) weekSoldTotals[pIdx] = (weekSoldTotals[pIdx] ?? 0) + actualValue;
              const variance = kpi.metric_type === "percentage"
                ? actualValue - targetValue
                : ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
              if (kpi.target_direction === "above") {
                if (variance >= 0) cellClass = "green";
                else if (variance >= -10) cellClass = "yellow";
                else cellClass = "red";
              } else {
                if (variance <= 0) cellClass = "green";
                else if (variance <= 10) cellClass = "yellow";
                else cellClass = "red";
              }
            } else if (entry?.actual_value !== null && entry?.actual_value !== undefined) {
              periodValues.push(entry.actual_value);
              if (availKpiIds.has(kpi.id)) weekAvailTotals[pIdx] = (weekAvailTotals[pIdx] ?? 0) + entry.actual_value;
              if (soldKpiIds.has(kpi.id)) weekSoldTotals[pIdx] = (weekSoldTotals[pIdx] ?? 0) + entry.actual_value;
            }
            html += `<td style="${getCellStyle(cellClass, baseFontSize, true)}">${formatValue(entry?.actual_value, kpi.metric_type, kpi.name)}</td>`;
          });

          // Q-Total for this KPI row — color-coded like weekly cells
          const shouldAvg = kpi.aggregation_type === 'average';
          const qTotal = periodValues.length > 0
            ? shouldAvg ? periodValues.reduce((s, v) => s + v, 0) / periodValues.length : periodValues.reduce((s, v) => s + v, 0)
            : null;
          let qCellClass = "";
          if (qTotal !== null && target !== null && target !== 0) {
            const qVariance = kpi.metric_type === "percentage"
              ? qTotal - target
              : ((qTotal - target) / Math.abs(target)) * 100;
            if (kpi.target_direction === "above") {
              if (qVariance >= 0) qCellClass = "green";
              else if (qVariance >= -10) qCellClass = "yellow";
              else qCellClass = "red";
            } else {
              if (qVariance <= 0) qCellClass = "green";
              else if (qVariance <= 10) qCellClass = "yellow";
              else qCellClass = "red";
            }
          }
          html += `<td style="${getCellStyle(qCellClass, baseFontSize, true)}">${formatValue(qTotal, kpi.metric_type, kpi.name)}</td></tr>`;
        });
      });

      // ── 4-row totals section matching UI ──────────────────────────────────
      const totalsNavy = `background-color: #1e293b; color: #ffffff; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: center; border: 1px solid #0f172a;`;
      const totalsPlain = `background-color: #e2e8f0; color: #1e293b; padding: 3px 4px; font-size: ${baseFontSize}; font-weight: 700; text-align: center; border: 1px solid #cbd5e1;`;

      // Row 1: navy separator
      html += `<tr><td colspan="${totalCols}" style="${totalsNavy} text-align: left;">Σ Totals</td></tr>`;

      // Compute Q-level sums for avail/sold
      const qAvailSum = weekAvailTotals.reduce<number>((s, v) => s + (v ?? 0), 0);
      const qSoldSum = weekSoldTotals.reduce<number>((s, v) => s + (v ?? 0), 0);

      // Row 2: Available Hours
      const availKpiForTarget = allKpisFlat.find((k: any) => availKpiIds.has(k.id));
      const availTarget = availKpiForTarget ? (kpiTargetsMap.has(availKpiForTarget.id) ? kpiTargetsMap.get(availKpiForTarget.id)! : availKpiForTarget.target_value) : null;
      html += `<tr><td style="${kpiNameStyle}">Available Hours</td><td style="${navyTargetStyle} min-width: 50px;">${availTarget !== null ? Number(availTarget).toLocaleString() : '—'}</td>`;
      weekAvailTotals.forEach(v => {
        html += `<td style="${totalsPlain}">${v !== null ? Number(v.toFixed(1)).toLocaleString() : '—'}</td>`;
      });
      html += `<td style="${totalsPlain} font-weight: 700;">${qAvailSum > 0 ? Number(qAvailSum.toFixed(1)).toLocaleString() : '—'}</td></tr>`;

      // Row 3: Sold Hours
      const soldKpiForTarget = allKpisFlat.find((k: any) => soldKpiIds.has(k.id));
      const soldTarget = soldKpiForTarget ? (kpiTargetsMap.has(soldKpiForTarget.id) ? kpiTargetsMap.get(soldKpiForTarget.id)! : soldKpiForTarget.target_value) : null;
      html += `<tr><td style="${kpiNameStyle}">Sold Hours</td><td style="${navyTargetStyle} min-width: 50px;">${soldTarget !== null ? Number(soldTarget).toLocaleString() : '—'}</td>`;
      weekSoldTotals.forEach(v => {
        html += `<td style="${totalsPlain}">${v !== null ? Number(v.toFixed(1)).toLocaleString() : '—'}</td>`;
      });
      html += `<td style="${totalsPlain} font-weight: 700;">${qSoldSum > 0 ? Number(qSoldSum.toFixed(1)).toLocaleString() : '—'}</td></tr>`;

      // Row 4: Productivity (color-coded)
      const prodTargetDisplay = `${productivityTarget}%`;
      const calcProdClass = (sold: number | null, avail: number | null): string => {
        if (sold === null || avail === null || avail === 0) return "";
        const pct = (sold / avail) * 100;
        const variance = pct - productivityTarget;
        if (variance >= 0) return "green";
        if (variance >= -10) return "yellow";
        return "red";
      };
      html += `<tr><td style="${kpiNameStyle}">Productivity</td><td style="${navyTargetStyle} min-width: 50px;">${prodTargetDisplay}</td>`;
      weekAvailTotals.forEach((avail, i) => {
        const sold = weekSoldTotals[i];
        const pct = avail !== null && sold !== null && avail > 0 ? (sold / avail) * 100 : null;
        const cls = calcProdClass(sold, avail);
        html += `<td style="${getCellStyle(cls, baseFontSize, true)}">${pct !== null ? Math.round(pct) + '%' : '—'}</td>`;
      });
      const qProdPct = qAvailSum > 0 ? (qSoldSum / qAvailSum) * 100 : null;
      const qProdClass = qProdPct !== null ? (qProdPct - productivityTarget >= 0 ? "green" : qProdPct - productivityTarget >= -10 ? "yellow" : "red") : "";
      html += `<td style="${getCellStyle(qProdClass, baseFontSize, true)}">${qProdPct !== null ? Math.round(qProdPct) + '%' : '—'}</td></tr>`;

      html += `</tbody></table></div></div>`;

    } else {
      // Non-weekly modes: separate table per owner (unchanged)
      Array.from(kpisByOwner.entries()).forEach(([ownerId, ownerKpis]) => {
        const ownerName = ownerId === "unassigned" ? "Unassigned" : profilesMap.get(ownerId)?.full_name || "Unknown";
        html += `<h2 style="color: #374151; margin-top: 28px; margin-bottom: 4px; font-size: 14px; font-weight: 700;">${ownerName}</h2>`;
        html += `<table style="border-collapse: collapse; width: 100%; margin-top: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); border-radius: 4px; overflow: hidden;"><thead><tr><th style="${thStyle}">KPI</th><th style="${thStyle}">Target</th>`;
        periods.forEach((p: any) => {
          html += `<th style="${thStyle}">${p.label}</th>`;
        });
        if (mode === "yearly" || mode === "monthly" || mode === "quarterly-trend") {
          html += `<th style="${thStyle} background-color: #e8e8e8;">Avg</th>`;
          html += `<th style="${thStyle} background-color: #e0e0e0;">Total</th>`;
        }
        html += `</tr></thead><tbody>`;

        ownerKpis.forEach((kpi: any) => {
          let displayTarget = '';
          if (mode === "yearly") {
            const q1 = kpiTargetsByQuarter.get(kpi.id)?.get(1) || kpi.target_value;
            const q2 = kpiTargetsByQuarter.get(kpi.id)?.get(2) || kpi.target_value;
            const q3 = kpiTargetsByQuarter.get(kpi.id)?.get(3) || kpi.target_value;
            const q4 = kpiTargetsByQuarter.get(kpi.id)?.get(4) || kpi.target_value;
            displayTarget = `${formatValue(q1, kpi.metric_type, kpi.name)}/${formatValue(q2, kpi.metric_type, kpi.name)}/${formatValue(q3, kpi.metric_type, kpi.name)}/${formatValue(q4, kpi.metric_type, kpi.name)}`;
          } else {
            const target = kpiTargetsMap.has(kpi.id) ? kpiTargetsMap.get(kpi.id)! : kpi.target_value;
            displayTarget = formatValue(target, kpi.metric_type, kpi.name);
          }
          html += `<tr><td style="${tdStyle}">${kpi.name}</td><td style="${tdStyle} font-size: 8px; white-space: nowrap;">${displayTarget}</td>`;

          const periodValues: number[] = [];
          periods.forEach((p: any) => {
            if (mode === "quarterly-trend" && 'months' in p) {
              const quarterMonths = p.months as string[];
              let quarterSum = 0;
              let monthCount = 0;
              for (const monthId of quarterMonths) {
                const monthEntry = entries?.find((e: any) => e.kpi_id === kpi.id && e.month === monthId);
                if (monthEntry?.actual_value !== null && monthEntry?.actual_value !== undefined) {
                  quarterSum += monthEntry.actual_value;
                  monthCount++;
                }
              }
              const quarterValue = monthCount > 0
                ? (kpi.aggregation_type === 'average' ? quarterSum / monthCount : quarterSum)
                : null;
              const qPeriod = p as { year: number; quarter: number };
              let targetValue = kpi.target_value;
              if (kpiTargetsByQuarter.has(kpi.id)) {
                targetValue = kpiTargetsByQuarter.get(kpi.id)!.get(qPeriod.quarter) || kpi.target_value;
              }
              let cellClass = "";
              if (quarterValue !== null && targetValue !== null && targetValue !== 0) {
                const variance = kpi.metric_type === "percentage"
                  ? quarterValue - targetValue
                  : ((quarterValue - targetValue) / Math.abs(targetValue)) * 100;
                if (kpi.target_direction === "above") {
                  if (variance >= 0) cellClass = "green";
                  else if (variance >= -10) cellClass = "yellow";
                  else cellClass = "red";
                } else {
                  if (variance <= 0) cellClass = "green";
                  else if (variance <= 10) cellClass = "yellow";
                  else cellClass = "red";
                }
                periodValues.push(quarterValue);
              } else if (quarterValue !== null) {
                periodValues.push(quarterValue);
              }
              html += `<td style="${getCellStyle(cellClass, baseFontSize, false)}">${formatValue(quarterValue, kpi.metric_type, kpi.name)}</td>`;
            } else {
              const entry = entries?.find((e: any) => {
                if ((mode === "monthly" || mode === "yearly") && 'identifier' in p) {
                  return e.kpi_id === kpi.id && e.month === p.identifier;
                }
                return false;
              });
              let targetValue = kpi.target_value;
              if (mode === "yearly" && 'identifier' in p) {
                const monthIndex = parseInt(p.identifier.split('-')[1]) - 1;
                const periodQuarter = Math.ceil((monthIndex + 1) / 3);
                if (kpiTargetsByQuarter.has(kpi.id)) {
                  targetValue = kpiTargetsByQuarter.get(kpi.id)!.get(periodQuarter) || kpi.target_value;
                }
              } else if (kpiTargetsMap.has(kpi.id)) {
                targetValue = kpiTargetsMap.get(kpi.id)!;
              }
              let cellClass = "";
              if (entry?.actual_value !== null && entry?.actual_value !== undefined && targetValue !== null && targetValue !== 0) {
                const actualValue = entry.actual_value;
                periodValues.push(actualValue);
                const variance = kpi.metric_type === "percentage"
                  ? actualValue - targetValue
                  : ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
                if (kpi.target_direction === "above") {
                  if (variance >= 0) cellClass = "green";
                  else if (variance >= -10) cellClass = "yellow";
                  else cellClass = "red";
                } else {
                  if (variance <= 0) cellClass = "green";
                  else if (variance <= 10) cellClass = "yellow";
                  else cellClass = "red";
                }
              } else if (entry?.actual_value !== null && entry?.actual_value !== undefined) {
                periodValues.push(entry.actual_value);
              }
              html += `<td style="${getCellStyle(cellClass, baseFontSize, false)}">${formatValue(entry?.actual_value, kpi.metric_type, kpi.name)}</td>`;
            }
          });

          if (mode === "yearly" || mode === "monthly" || mode === "quarterly-trend") {
            const avg = periodValues.length > 0
              ? periodValues.reduce((sum, v) => sum + v, 0) / periodValues.length
              : null;
            const total = periodValues.length > 0
              ? kpi.aggregation_type === 'average' ? avg : periodValues.reduce((sum, v) => sum + v, 0)
              : null;
            html += `<td style="${tdStyle} font-weight: bold; background-color: #f5f5f5;">${formatValue(avg, kpi.metric_type, kpi.name)}</td>`;
            html += `<td style="${tdStyle} font-weight: bold; background-color: #f0f0f0;">${formatValue(total, kpi.metric_type, kpi.name)}</td>`;
          }
          html += `</tr>`;
        });
        html += `</tbody></table>`;
      });
    }

    // Add financial metrics for monthly, yearly, and quarterly-trend modes
    if (mode === "monthly" || mode === "yearly" || mode === "quarterly-trend") {
      // Fetch financial targets for both years (for quarterly-trend which spans 2 years)
      const targetYears = mode === "quarterly-trend" ? [year - 1, year] : [year];
      const { data: finTargets } = await supabaseClient
        .from("financial_targets")
        .select("*")
        .eq("department_id", departmentId)
        .in("year", targetYears);
      
      const targetsMap = new Map<string, { value: number; direction: string }>();
      finTargets?.forEach(t => {
        const key = `${t.metric_name}_${t.year}_${t.quarter}`;
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
              data.net_selling_gross != null ? data.net_selling_gross :
              (data.gp_net != null && data.sales_expense != null) ? data.gp_net - data.sales_expense : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              data.department_profit != null ? data.department_profit :
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - data.total_fixed_expense : null },
            { display: "Dealer Salary", dbName: "dealer_salary", type: "dollar" as const },
            { display: "Parts Transfer", dbName: "parts_transfer", type: "dollar" as const, calc: (data: any) => {
              if (data.parts_transfer != null) return data.parts_transfer;
              if (data.adjusted_selling_gross == null || data.gp_net == null || data.sales_expense == null) return null;
              const netSellingGross = data.gp_net - data.sales_expense;
              return data.adjusted_selling_gross - netSellingGross;
            }},
            { display: "Net Operating Profit", dbName: "net", type: "dollar" as const, calc: (data: any) => {
              if (data.net != null) return data.net;
              if (data.gp_net == null || data.sales_expense == null || data.total_fixed_expense == null || 
                  data.dealer_salary == null || data.adjusted_selling_gross == null) return null;
              
              const departmentProfit = data.gp_net - data.sales_expense - data.total_fixed_expense;
              const netSellingGross = data.gp_net - data.sales_expense;
              const partsTransfer = data.adjusted_selling_gross - netSellingGross;
              return departmentProfit - data.dealer_salary + partsTransfer;
            }},
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              const deptProfit = data.department_profit ?? (
                (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
                data.gp_net - data.sales_expense - data.total_fixed_expense : null
              );
              if (deptProfit == null || data.gp_net == null || data.gp_net === 0) return null;
              return (deptProfit / data.gp_net) * 100;
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
              data.net_selling_gross != null ? data.net_selling_gross :
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              data.department_profit != null ? data.department_profit :
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              const deptProfit = data.department_profit ?? (
                (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
                data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null
              );
              if (deptProfit == null || data.gp_net == null || data.gp_net === 0) return null;
              return (deptProfit / data.gp_net) * 100;
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
              // Use stored value if available, otherwise calculate
              data.net_selling_gross != null ? data.net_selling_gross :
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              // Use stored value if available (from Excel import), otherwise calculate
              data.department_profit != null ? data.department_profit :
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              // Use stored department_profit if available for calculation
              const deptProfit = data.department_profit ?? (
                (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
                data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null
              );
              if (deptProfit == null || data.gp_net == null || data.gp_net === 0) return null;
              return (deptProfit / data.gp_net) * 100;
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
              data.net_selling_gross != null ? data.net_selling_gross :
              (data.gp_net != null && data.sales_expense != null) ? 
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) : null },
            { display: "Total Fixed Expense", dbName: "total_fixed_expense", type: "dollar" as const },
            { display: "Department Profit", dbName: "department_profit", type: "dollar" as const, calc: (data: any) =>
              data.department_profit != null ? data.department_profit :
              (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
              data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null },
            { display: "Parts Transfer", dbName: "parts_transfer", type: "dollar" as const },
            { display: "Net Operating Profit", dbName: "net", type: "dollar" as const },
            { display: "Return on Gross", dbName: "return_on_gross", type: "percentage" as const, calc: (data: any) => {
              const deptProfit = data.department_profit ?? (
                (data.gp_net != null && data.sales_expense != null && data.total_fixed_expense != null) ?
                data.gp_net - data.sales_expense - (data.semi_fixed_expense ?? 0) - data.total_fixed_expense : null
              );
              if (deptProfit == null || data.gp_net == null || data.gp_net === 0) return null;
              return (deptProfit / data.gp_net) * 100;
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
      
      html += `<h2 style="color: #666; margin-top: 30px;">Financial Metrics</h2><table style="border-collapse: collapse; width: 100%; margin-top: 10px;"><thead><tr><th style="${thStyle}">Metric</th>`;
      
      // Add Q1-Q4 targets column for yearly mode
      if (mode === "yearly") {
        html += `<th style="${thStyle}">Q1/Q2/Q3/Q4 Targets</th>`;
      }
      
      periods.forEach(p => {
        html += `<th style="${thStyle}">${p.label}</th>`;
      });
      
      // Add Avg and Total columns
      html += `<th style="${thStyle} background-color: #e8e8e8;">Avg</th>`;
      html += `<th style="${thStyle} background-color: #e0e0e0;">Total</th>`;
      html += `</tr></thead><tbody>`;
      
      FINANCIAL_METRICS.forEach(metric => {
        html += `<tr><td style="${tdStyle}">${metric.display}</td>`;
        
        // Add Q1-Q4 targets cell for yearly mode
        if (mode === "yearly") {
          const q1Target = targetsMap.get(`${metric.dbName}_${year}_1`);
          const q2Target = targetsMap.get(`${metric.dbName}_${year}_2`);
          const q3Target = targetsMap.get(`${metric.dbName}_${year}_3`);
          const q4Target = targetsMap.get(`${metric.dbName}_${year}_4`);
          
          const q1Value = q1Target?.value ?? 0;
          const q2Value = q2Target?.value ?? 0;
          const q3Value = q3Target?.value ?? 0;
          const q4Value = q4Target?.value ?? 0;
          
          const displayTarget = `${formatValue(q1Value, metric.type)}/${formatValue(q2Value, metric.type)}/${formatValue(q3Value, metric.type)}/${formatValue(q4Value, metric.type)}`;
          html += `<td style="${tdStyle} font-weight: bold; background-color: #f9f9f9;">${displayTarget}</td>`;
        }
        
        // Collect values for Avg/Total calculation
        const periodValues: number[] = [];
        
        periods.forEach(p => {
          // Handle quarterly-trend mode - show quarterly AVERAGES to match UI
          if (mode === "quarterly-trend" && 'months' in p) {
            const qPeriod = p as { year: number; quarter: number; months: string[] };
            
            // Get quarterly aggregated data (sums) and month counts
            const quarterData = financialDataByQuarter.get(p.identifier) ?? {};
            const monthCounts = financialMonthCountByQuarter.get(p.identifier) ?? {};
            
            let value = null;
            
            if (metric.type === "percentage" && metric.calc) {
              // For percentage metrics: use calc function on summed data
              // This correctly calculates percentage from total numerator/denominator
              value = metric.calc(quarterData);
            } else if (metric.calc) {
              // For calculated dollar metrics: calculate from summed components, then average
              const calcValue = metric.calc(quarterData);
              if (calcValue !== null) {
                // Use max month count from base metrics to get proper divisor
                // For calculated metrics, count months that have all required components
                const baseMetricCounts = Object.values(monthCounts).filter(c => c > 0);
                const avgMonthCount = baseMetricCounts.length > 0 
                  ? Math.max(...baseMetricCounts) 
                  : 3;
                value = calcValue / avgMonthCount;
              }
            } else {
              // For direct dollar metrics: divide sum by month count to get average
              const sum = quarterData[metric.dbName] ?? null;
              const count = monthCounts[metric.dbName] || 3;
              if (sum !== null) {
                value = sum / count;
              }
            }
            
            // Collect value for summary
            if (value !== null) {
              periodValues.push(value);
            }
            
            // Get target for this quarter
            const targetKey = `${metric.dbName}_${qPeriod.year}_${qPeriod.quarter}`;
            const target = targetsMap.get(targetKey);
            
            // Calculate status
            let cellClass = "";
            if (value !== null && target && target.value !== null && target.value !== 0) {
              const targetValue = target.value;
              const direction = target.direction;
              
              const variance = metric.type === "percentage"
                ? value - targetValue
                : ((value - targetValue) / Math.abs(targetValue)) * 100;
              
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
              html += `<td style="${getCellStyle(cellClass, baseFontSize)}">${value.toFixed(1)}%</td>`;
            } else {
              html += `<td style="${getCellStyle(cellClass, baseFontSize)}">${formatValue(value, metric.type)}</td>`;
            }
          } else if ('identifier' in p) {
            // Original logic for monthly/yearly modes
            // Gather all financial data for this month to calculate percentages
            const monthData: any = financialDataByMonth.get(p.identifier) ?? {};
            
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
              // Prefer precomputed month data (includes synthesized parent totals from sub-metrics)
              value = monthData[metric.dbName] ?? null;
            }
            
            // Collect value for summary
            if (value !== null) {
              periodValues.push(value);
            }
            
            // Determine quarter from month identifier
            const monthIndex = parseInt(p.identifier.split('-')[1]) - 1;
            const periodQuarter = Math.ceil((monthIndex + 1) / 3);
            const periodYear = parseInt(p.identifier.split('-')[0]);
            
            // Get target for this metric and quarter
            const targetKey = `${metric.dbName}_${periodYear}_${periodQuarter}`;
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
                : ((value - targetValue) / Math.abs(targetValue)) * 100;
              
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
              // UI shows one decimal place for percentages
              html += `<td style="${getCellStyle(cellClass, baseFontSize)}">${value.toFixed(1)}%</td>`;
            } else {
              html += `<td style="${getCellStyle(cellClass, baseFontSize)}">${formatValue(value, metric.type)}</td>`;
            }
          }
        });
        
        // Add Avg and Total columns
        // MUST match UI logic in FinancialSummary.tsx exactly:
        // For percentage metrics: recalculate from sum of underlying dollar amounts
        // For dollar metrics: show average and sum
        
        let avg: number | null = null;
        let total: number | null = null;
        
        if (metric.type === "percentage") {
          // UI recalculates percentage averages from underlying dollar totals
          // Define numerator/denominator relationships for each percentage metric
          const percentageCalcs: Record<string, { numerator: string; denominator: string }> = {
            gp_percent: { numerator: "gp_net", denominator: "total_sales" },
            sales_expense_percent: { numerator: "sales_expense", denominator: "gp_net" },
            semi_fixed_expense_percent: { numerator: "semi_fixed_expense", denominator: "gp_net" },
            return_on_gross: { numerator: "department_profit", denominator: "gp_net" },
          };
          
          const calcDef = percentageCalcs[metric.dbName];
          if (calcDef) {
            // Sum numerator and denominator across all periods
            let totalNumerator = 0;
            let totalDenominator = 0;
            
            if (mode === "quarterly-trend" && quarterlyPeriods) {
              // For quarterly-trend, use quarterly aggregated data
              for (const qPeriod of quarterlyPeriods) {
                const quarterData = financialDataByQuarter.get(qPeriod.identifier) ?? {};
                
                let numeratorVal: number | null = null;
                if (calcDef.numerator === "department_profit") {
                  numeratorVal = quarterData.department_profit ?? (
                    (quarterData.gp_net != null && quarterData.sales_expense != null && quarterData.total_fixed_expense != null) ?
                    quarterData.gp_net - quarterData.sales_expense - (quarterData.semi_fixed_expense ?? 0) - quarterData.total_fixed_expense : null
                  );
                } else {
                  numeratorVal = quarterData[calcDef.numerator] ?? null;
                }
                
                const denominatorVal = quarterData[calcDef.denominator] ?? null;
                
                if (numeratorVal != null) totalNumerator += numeratorVal;
                if (denominatorVal != null) totalDenominator += denominatorVal;
              }
            } else {
              // Original logic for monthly/yearly modes
              periods.forEach(p => {
                if ('identifier' in p) {
                  const monthData: any = financialDataByMonth.get(p.identifier) ?? {};
                  
                  // For department_profit, use stored value or calculate it
                  let numeratorVal: number | null = null;
                  if (calcDef.numerator === "department_profit") {
                    numeratorVal = monthData.department_profit ?? (
                      (monthData.gp_net != null && monthData.sales_expense != null && monthData.total_fixed_expense != null) ?
                      monthData.gp_net - monthData.sales_expense - (monthData.semi_fixed_expense ?? 0) - monthData.total_fixed_expense : null
                    );
                  } else {
                    numeratorVal = monthData[calcDef.numerator] ?? null;
                  }
                  
                  const denominatorVal = monthData[calcDef.denominator] ?? null;
                  
                  if (numeratorVal != null) totalNumerator += numeratorVal;
                  if (denominatorVal != null) totalDenominator += denominatorVal;
                }
              });
            }
            
            // Calculate average percentage from summed components
            if (totalDenominator !== 0) {
              avg = (totalNumerator / totalDenominator) * 100;
            }
          } else {
            // Fallback: simple average for unknown percentage metrics
            avg = periodValues.length > 0 
              ? periodValues.reduce((sum, v) => sum + v, 0) / periodValues.length 
              : null;
          }
          // Total for percentage always shows "-"
          total = null;
        } else {
          // Dollar metrics: simple average and sum
          avg = periodValues.length > 0 
            ? periodValues.reduce((sum, v) => sum + v, 0) / periodValues.length 
            : null;
          total = periodValues.length > 0
            ? periodValues.reduce((sum, v) => sum + v, 0)
            : null;
        }
        
        if (metric.type === "percentage") {
          // Percentages: use one decimal place to match UI (-54.6% not -55%)
          html += `<td style="${tdStyle} font-weight: bold; background-color: #f5f5f5;">${avg !== null ? avg.toFixed(1) + '%' : '-'}</td>`;
          html += `<td style="${tdStyle} font-weight: bold; background-color: #f0f0f0;">-</td>`;
        } else {
          html += `<td style="${tdStyle} font-weight: bold; background-color: #f5f5f5;">${formatValue(avg !== null ? Math.round(avg) : null, metric.type)}</td>`;
          html += `<td style="${tdStyle} font-weight: bold; background-color: #f0f0f0;">${formatValue(total !== null ? Math.round(total) : null, metric.type)}</td>`;
        }
        
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }

    // Legend footer for weekly mode
    if (isWeeklyMode) {
      html += `
  <table style="border-collapse: collapse; margin-top: 24px; padding: 0; background-color: #ffffff; border-radius: 6px; width: auto;"><tr>
    <td style="padding: 10px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">Legend:</td>
    <td style="padding: 10px 12px; font-size: 12px; color: #065f46; white-space: nowrap;"><span style="display: inline-block; width: 12px; height: 12px; background-color: #059669; border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span>At or Above Target</td>
    <td style="padding: 10px 12px; font-size: 12px; color: #92400e; white-space: nowrap;"><span style="display: inline-block; width: 12px; height: 12px; background-color: #d97706; border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span>Within 10% of Target</td>
    <td style="padding: 10px 12px; font-size: 12px; color: #991b1b; white-space: nowrap;"><span style="display: inline-block; width: 12px; height: 12px; background-color: #dc2626; border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span>Below Target (&gt;10%)</td>
  </tr></table>`;
    }

    html += `</div></body></html>`;

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
          : mode === "quarterly-trend"
          ? `${department.name} Scorecard - Quarterly Trend (${year - 1}-${year})`
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
