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

interface MetricDefinition {
  key: string;
  label: string;
  type: "currency" | "percent";
}

// Full metric definitions - will be filtered based on brand
const ALL_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'total_sales', label: 'Total Sales', type: 'currency' },
  { key: 'gp_net', label: 'GP Net', type: 'currency' },
  { key: 'gp_percent', label: 'GP %', type: 'percent' },
  { key: 'sales_expense', label: 'Sales Expense', type: 'currency' },
  { key: 'sales_expense_percent', label: 'Sales Exp %', type: 'percent' },
  { key: 'net_selling_gross', label: 'Net Selling Gross', type: 'currency' },
  { key: 'total_fixed_expense', label: 'Fixed Expense', type: 'currency' },
  { key: 'department_profit', label: 'Dept Profit', type: 'currency' },
  { key: 'parts_transfer', label: 'Parts Transfer', type: 'currency' },
  { key: 'net_operating_profit', label: 'Net Operating', type: 'currency' },
  { key: 'return_on_gross', label: 'Return on Gross', type: 'percent' },
];

// Get metrics for brand - filter out parts_transfer and net_operating_profit for certain brands
function getMetricsForBrand(brand: string | null): MetricDefinition[] {
  const brandLower = brand?.toLowerCase() || '';
  
  // Brands that exclude parts_transfer and net_operating_profit
  const excludePartsTransfer = ['ktrv', 'other', 'nissan', 'mazda', 'honda', 'hyundai'].some(b => brandLower.includes(b) || brandLower === b);
  
  if (excludePartsTransfer) {
    return ALL_METRIC_DEFINITIONS.filter(m => 
      m.key !== 'parts_transfer' && m.key !== 'net_operating_profit'
    );
  }
  
  return ALL_METRIC_DEFINITIONS;
}

interface MetricData {
  key: string;
  label: string;
  type: "currency" | "percent";
  months: Record<string, { value: number; baseline: number }>;
  quarters: Record<string, { value: number; baseline: number }>;
  annual: { value: number; baseline: number; variance: number; variancePercent: number };
}

const MONTH_ABBREV = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Expense metrics where an increase is bad (should show red) and decrease is good (should show green)
function isExpenseMetric(key: string): boolean {
  return key === 'sales_expense' || key === 'sales_expense_percent';
}

// Get variance color based on metric type - for expense metrics, invert the logic
function getVarianceColor(variance: number, metricKey: string, positiveStyle: string, negativeStyle: string): string {
  const isExpense = isExpenseMetric(metricKey);
  // For expense metrics: decrease (negative variance) is good, increase (positive variance) is bad
  const isPositiveChange = isExpense ? variance <= 0 : variance >= 0;
  return isPositiveChange ? positiveStyle : negativeStyle;
}

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

    // Fetch department info with store brand
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

    console.log("Department loaded:", { name: deptData.name, store: deptData.stores?.name, brand: deptData.stores?.brand });

    // Get metrics for this brand
    const METRIC_DEFINITIONS = getMetricsForBrand(deptData.stores?.brand);
    console.log("Using metrics for brand:", deptData.stores?.brand, "Count:", METRIC_DEFINITIONS.length);

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

    // Fetch driver settings for this forecast
    const { data: driverSettings } = await supabaseClient
      .from("forecast_driver_settings")
      .select("*")
      .eq("forecast_id", forecast.id)
      .single();

    // Fetch forecast weights
    const { data: forecastWeights } = await supabaseClient
      .from("forecast_weights")
      .select("*")
      .eq("forecast_id", forecast.id);

    // Fetch forecast entries (use ALL saved values; lock is only a UI edit marker)
    const { data: forecastEntries } = await supabaseClient
      .from("forecast_entries")
      .select("month, metric_name, forecast_value, baseline_value, is_locked")
      .eq("forecast_id", forecast.id);

    console.log(
      "Forecast data loaded - weights:",
      forecastWeights?.length || 0,
      "entries:",
      forecastEntries?.length || 0
    );

    // Fetch prior year financial data for baseline (excluding sub-metrics)
    const { data: priorYearData } = await supabaseClient
      .from("financial_entries")
      .select("month, metric_name, value")
      .eq("department_id", departmentId)
      .gte("month", `${priorYear}-01`)
      .lte("month", `${priorYear}-12`)
      .not("metric_name", "like", "sub:%");

    console.log("Prior year data loaded:", priorYearData?.length || 0);

    // Fetch sub-metric baseline data for prior year WITH PAGINATION to handle >1000 rows
    const subMetricBaselineData: { month: string; metric_name: string; value: number | null }[] = [];
    const pageSize = 1000;
    let subMetricOffset = 0;
    
    while (true) {
      const { data: pageData, error: pageError } = await supabaseClient
        .from("financial_entries")
        .select("month, metric_name, value")
        .eq("department_id", departmentId)
        .gte("month", `${priorYear}-01`)
        .lte("month", `${priorYear}-12`)
        .like("metric_name", "sub:%")
        .order("month", { ascending: true })
        .order("metric_name", { ascending: true })
        .range(subMetricOffset, subMetricOffset + pageSize - 1);

      if (pageError) {
        console.error("Error fetching sub-metric baseline data:", pageError);
        break;
      }

      if (!pageData || pageData.length === 0) break;
      subMetricBaselineData.push(...pageData);

      if (pageData.length < pageSize) break;
      subMetricOffset += pageSize;
    }

    // Fetch sub-metric overrides for this forecast
    const { data: subMetricOverrides } = await supabaseClient
      .from("forecast_submetric_overrides")
      .select("parent_metric_key, sub_metric_key, overridden_annual_value")
      .eq("forecast_id", forecast.id);

    console.log(
      "Sub-metric data loaded - baseline entries:",
      subMetricBaselineData.length,
      "overrides:",
      subMetricOverrides?.length || 0
    );

    // Build baseline data map
    const baselineByMonth = new Map<string, Map<string, number>>();
    priorYearData?.forEach((entry) => {
      if (!baselineByMonth.has(entry.month)) {
        baselineByMonth.set(entry.month, new Map());
      }
      const monthMap = baselineByMonth.get(entry.month)!;
      monthMap.set(entry.metric_name, (monthMap.get(entry.metric_name) || 0) + (entry.value || 0));
    });

    // Backfill parent totals from sub-metrics for stores that only import sub-metric data
    // (e.g., Murray Merritt imports only sub:total_sales:*, sub:gp_net:*, etc.)
    const parentKeysToBackfill = ['total_sales', 'gp_net', 'sales_expense', 'total_fixed_expense'];
    const subMetricSumsByMonthParent = new Map<string, Map<string, number>>();
    
    subMetricBaselineData.forEach((entry) => {
      const parts = entry.metric_name.split(":");
      if (parts.length >= 3) {
        const parentKey = parts[1];
        if (parentKeysToBackfill.includes(parentKey)) {
          const monthParentKey = `${entry.month}:${parentKey}`;
          if (!subMetricSumsByMonthParent.has(monthParentKey)) {
            subMetricSumsByMonthParent.set(monthParentKey, new Map());
          }
          const current = subMetricSumsByMonthParent.get(monthParentKey)!.get(parentKey) || 0;
          subMetricSumsByMonthParent.get(monthParentKey)!.set(parentKey, current + (entry.value || 0));
        }
      }
    });

    // If parent-level entry is missing but sub-metrics exist, use sub-metric sum as parent total
    subMetricSumsByMonthParent.forEach((metrics, monthParentKey) => {
      const [month, parentKey] = monthParentKey.split(":");
      if (!baselineByMonth.has(month)) {
        baselineByMonth.set(month, new Map());
      }
      const monthMap = baselineByMonth.get(month)!;
      // Only backfill if parent value is missing or zero
      if (!monthMap.has(parentKey) || monthMap.get(parentKey) === 0) {
        const subMetricSum = metrics.get(parentKey) || 0;
        if (subMetricSum !== 0) {
          monthMap.set(parentKey, subMetricSum);
          console.log(`Backfilled ${parentKey} for ${month}: ${subMetricSum}`);
        }
      }
    });

    // Build sub-metric baseline map: parentKey -> subMetricName -> monthlyValues
    interface SubMetricBaseline {
      parentKey: string;
      name: string;
      orderIndex: number;
      monthlyValues: Map<string, number>;
      annualTotal: number;
    }

    const subMetricBaselines: SubMetricBaseline[] = [];
    const subMetricsByKey = new Map<string, SubMetricBaseline>();

    subMetricBaselineData?.forEach((entry) => {
      const parts = entry.metric_name.split(":");
      if (parts.length >= 4) {
        const parentKey = parts[1];
        const orderIndex = parseInt(parts[2], 10);
        const name = parts.slice(3).join(":");
        const key = `${parentKey}:${orderIndex}:${name}`;

        if (!subMetricsByKey.has(key)) {
          const baseline: SubMetricBaseline = {
            parentKey,
            name,
            orderIndex,
            monthlyValues: new Map(),
            annualTotal: 0,
          };
          subMetricsByKey.set(key, baseline);
          subMetricBaselines.push(baseline);
        }

        const baseline = subMetricsByKey.get(key)!;
        const currentMonthValue = baseline.monthlyValues.get(entry.month) || 0;
        baseline.monthlyValues.set(entry.month, currentMonthValue + (entry.value || 0));
        baseline.annualTotal += entry.value || 0;
      }
    });

    // Build override map: "parentKey:subMetricKey" -> overriddenValue
    const overrideMap = new Map<string, number>();
    subMetricOverrides?.forEach((o) => {
      overrideMap.set(`${o.parent_metric_key}:${o.sub_metric_key}`, o.overridden_annual_value);
    });

    // Check if this store has GP% sub-metric overrides
    const gpPercentOverrides = subMetricOverrides?.filter((o) => o.parent_metric_key === "gp_percent") || [];
    const hasGpPercentOverrides = gpPercentOverrides.length > 0;
    console.log("GP% overrides:", gpPercentOverrides.length, "hasGpPercentOverrides:", hasGpPercentOverrides);

    // Calculate annual baseline totals
    const annualBaseline: Record<string, number> = {};
    baselineByMonth.forEach((metrics) => {
      metrics.forEach((value, metricName) => {
        annualBaseline[metricName] = (annualBaseline[metricName] || 0) + value;
      });
    });

    // === IMPORTANT ===
    // Email should reflect what the Forecast UI is showing.
    // The UI persists its computed month-by-month values into forecast_entries.forecast_value
    // (even when not locked). So the source of truth for the email is forecast_entries.

     const entriesByMonthMetric = new Map<string, { forecast: number | null; baseline: number | null; locked: boolean }>();
    (forecastEntries ?? []).forEach((e) => {
      entriesByMonthMetric.set(`${e.month}:${e.metric_name}`, {
        forecast: e.forecast_value,
        baseline: e.baseline_value,
        locked: !!e.is_locked,
      });
    });

     // Build weights map (matches Forecast UI weight distribution)
     const weightsMap = new Map<number, number>();
     (forecastWeights ?? []).forEach((w) => {
       if (w?.month_number) {
         weightsMap.set(w.month_number, w.adjusted_weight ?? w.original_weight ?? (100 / 12));
       }
     });
     const getWeightFactor = (monthNumber: number) => {
       const w = weightsMap.get(monthNumber) ?? (100 / 12);
       return (w as number) / 100;
     };

    // If a percent metric has ALL 12 months locked to (roughly) the same value, the UI shows that
    // locked value for the annual row instead of recalculating from totals.
    const getLockedAnnualPercent = (metric: string): number | null => {
      const lockedValues: number[] = [];

      for (let m = 1; m <= 12; m++) {
        const month = `${forecastYear}-${String(m).padStart(2, '0')}`;
        const entry = entriesByMonthMetric.get(`${month}:${metric}`);
        if (!entry || !entry.locked || entry.forecast === null || entry.forecast === undefined) {
          return null;
        }
        lockedValues.push(entry.forecast);
      }

      const first = lockedValues[0];
      const allSame = lockedValues.every((v) => Math.abs(v - first) < 0.01);
      return allSame ? first : null;
    };

     const baselineTotalSales = annualBaseline['total_sales'] || 0;
     const baselineGpNet = annualBaseline['gp_net'] || 0;
     const baselineSalesExp = annualBaseline['sales_expense'] || 0;
     const baselineFixedExp = annualBaseline['total_fixed_expense'] || 0;
     const baselinePartsTransfer = annualBaseline['parts_transfer'] || 0;

     // CRITICAL: The email must match the Forecast UI.
     // The UI may show computed values even when some months haven't been explicitly persisted.
     // So we treat forecast_entries as overrides when present, but fill missing months using
     // the same driver+weight distribution logic.

     const growthPercent = driverSettings?.growth_percent ?? 0;
     const growthFactor = 1 + (growthPercent / 100);

     const driverAnnualTotals = {
       total_sales: baselineTotalSales * growthFactor,
       gp_net: baselineGpNet * growthFactor,
       sales_expense: driverSettings?.sales_expense ?? (baselineSalesExp * growthFactor),
       total_fixed_expense: driverSettings?.fixed_expense ?? baselineFixedExp,
       parts_transfer: baselinePartsTransfer,
     };

     const getMonthlyForecastValue = (metric: keyof typeof driverAnnualTotals, monthNumber: number): number => {
       const month = `${forecastYear}-${String(monthNumber).padStart(2, '0')}`;
       const entry = entriesByMonthMetric.get(`${month}:${metric}`);
       if (entry && entry.forecast !== null && entry.forecast !== undefined) return entry.forecast;
       return (driverAnnualTotals[metric] ?? 0) * getWeightFactor(monthNumber);
     };

     const sumHybridAnnual = (metric: keyof typeof driverAnnualTotals): number => {
       let total = 0;
       let storedCount = 0;
       for (let m = 1; m <= 12; m++) {
         const month = `${forecastYear}-${String(m).padStart(2, '0')}`;
         const entry = entriesByMonthMetric.get(`${month}:${metric}`);
         if (entry && entry.forecast !== null && entry.forecast !== undefined) storedCount++;
         total += getMonthlyForecastValue(metric, m);
       }
       console.log(`[annualTotals] ${metric}: stored months=${storedCount}/12, total=${total}`);
       return total;
     };

     const annualTotalSales = sumHybridAnnual('total_sales');
     const annualGpNet = sumHybridAnnual('gp_net');
     const annualSalesExp = sumHybridAnnual('sales_expense');
     const annualFixedExp = sumHybridAnnual('total_fixed_expense');
     const annualPartsTransfer = sumHybridAnnual('parts_transfer');

      // IMPORTANT: Mirror the Forecast UI's YoY card.
      // That card's annual "Net Selling Gross" and "Dept Profit" totals are derived from the
      // annual driver totals (GP Net, Sales Expense, Fixed Expense), not from any stored derived rows.
      // (Stored derived rows can reflect intermediate calc paths and may not match the card.)
      const annualNetSellingGross = annualGpNet - annualSalesExp;
      const annualDeptProfit = annualNetSellingGross - annualFixedExp;

     // Derived percentages and other metrics
     const gpPercent = annualTotalSales > 0 ? (annualGpNet / annualTotalSales) * 100 : 0;
     const lockedSalesExpPercent = getLockedAnnualPercent('sales_expense_percent');
     const annualSalesExpPercent = lockedSalesExpPercent !== null
       ? lockedSalesExpPercent
       : (annualGpNet > 0 ? (annualSalesExp / annualGpNet) * 100 : 0);
     const annualNetOperatingProfit = annualDeptProfit + annualPartsTransfer;
     const annualReturnOnGross = annualGpNet > 0 ? (annualDeptProfit / annualGpNet) * 100 : 0;

     console.log("Annual totals from stored forecast_entries:", {
       annualTotalSales,
       annualGpNet,
       annualSalesExp,
       annualFixedExp,
       annualNetSellingGross,
       annualDeptProfit,
     });

     // Used for scaling sub-metrics
     const annualForecastValues: Record<string, number> = {
       total_sales: annualTotalSales,
       gp_net: annualGpNet,
       gp_percent: gpPercent,
       sales_expense: annualSalesExp,
       sales_expense_percent: annualSalesExpPercent,
       net_selling_gross: annualNetSellingGross,
       total_fixed_expense: annualFixedExp,
       department_profit: annualDeptProfit,
       parts_transfer: annualPartsTransfer,
       net_operating_profit: annualNetOperatingProfit,
       return_on_gross: annualReturnOnGross,
     };

    // Annual baseline values for comparison
    const baselineGpPercent = baselineTotalSales > 0 ? (baselineGpNet / baselineTotalSales) * 100 : 0;
    const baselineSalesExpPercent = baselineGpNet > 0 ? (baselineSalesExp / baselineGpNet) * 100 : 0;
    const baselineNetSellingGross = baselineGpNet - baselineSalesExp;
    const baselineDeptProfit = baselineGpNet - baselineSalesExp - baselineFixedExp;
    const baselineNetOperatingProfit = baselineDeptProfit + baselinePartsTransfer;
    const baselineReturnOnGross = baselineGpNet > 0 ? (baselineDeptProfit / baselineGpNet) * 100 : 0;

    const annualBaselineValues: Record<string, number> = {
      total_sales: baselineTotalSales,
      gp_net: baselineGpNet,
      gp_percent: baselineGpPercent,
      sales_expense: baselineSalesExp,
      sales_expense_percent: baselineSalesExpPercent,
      net_selling_gross: baselineNetSellingGross,
      total_fixed_expense: baselineFixedExp,
      department_profit: baselineDeptProfit,
      parts_transfer: baselinePartsTransfer,
      net_operating_profit: baselineNetOperatingProfit,
      return_on_gross: baselineReturnOnGross,
    };

     // Variables used by the monthly-calculation block below
     const salesExpense = annualSalesExp;
     const baseSalesExpense = baselineSalesExp;
     const baseFixedExpense = baselineFixedExp;

    // Map of saved forecast values (used when a cell is locked)
    const entriesMap = new Map<string, { forecast_value: number; is_locked: boolean }>();
    (forecastEntries ?? []).forEach((e) => {
      entriesMap.set(`${e.month}:${e.metric_name}`, {
        forecast_value: e.forecast_value ?? 0,
        is_locked: !!e.is_locked,
      });
    });

    console.log("Calculated annual values:", {
      forecast: { deptProfit: annualDeptProfit, nsg: annualNetSellingGross, gpNet: annualGpNet, totalSales: annualTotalSales },
      baseline: { deptProfit: baselineDeptProfit, nsg: baselineNetSellingGross, gpNet: baselineGpNet, totalSales: baselineTotalSales }
    });

    // Calculate monthly values using the same logic as the UI (baseline month pattern + growth + locked cells)
    const months = Array.from({ length: 12 }, (_, i) => `${forecastYear}-${String(i + 1).padStart(2, "0")}`);

    const metricsData: MetricData[] = METRIC_DEFINITIONS.map((def) => {
      const monthData: Record<string, { value: number; baseline: number }> = {};

      months.forEach((month, index) => {
        const monthNumber = index + 1;
        const priorYearMonth = `${priorYear}-${String(monthNumber).padStart(2, "0")}`;
        const baselineMonthData = baselineByMonth.get(priorYearMonth);

         const baselineInputs = {
           total_sales: baselineMonthData?.get('total_sales') ?? 0,
           gp_net: baselineMonthData?.get('gp_net') ?? 0,
           sales_expense: baselineMonthData?.get('sales_expense') ?? 0,
           total_fixed_expense: baselineMonthData?.get('total_fixed_expense') ?? 0,
           adjusted_selling_gross: baselineMonthData?.get('adjusted_selling_gross') ?? 0,
           parts_transfer: baselineMonthData?.get('parts_transfer') ?? 0,
         };

        const baselineNetSellingGross = baselineInputs.gp_net - baselineInputs.sales_expense;
        const hasStoredPartsTransfer = baselineMonthData?.has('parts_transfer') ?? false;
        const derivedPartsTransfer = hasStoredPartsTransfer
          ? baselineInputs.parts_transfer
          : baselineInputs.adjusted_selling_gross
            ? baselineInputs.adjusted_selling_gross - baselineNetSellingGross
            : 0;

        const baselineMonthlyValues: Record<string, number> = {
          total_sales: baselineInputs.total_sales,
          gp_net: baselineInputs.gp_net,
          gp_percent: baselineInputs.total_sales > 0 ? (baselineInputs.gp_net / baselineInputs.total_sales) * 100 : 0,
          sales_expense: baselineInputs.sales_expense,
          sales_expense_percent: baselineInputs.gp_net > 0 ? (baselineInputs.sales_expense / baselineInputs.gp_net) * 100 : 0,
          net_selling_gross: baselineNetSellingGross,
          total_fixed_expense: baselineInputs.total_fixed_expense,
          department_profit: baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.total_fixed_expense,
          parts_transfer: derivedPartsTransfer,
          net_operating_profit: (baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.total_fixed_expense) + derivedPartsTransfer,
          return_on_gross: baselineInputs.gp_net > 0 ? ((baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.total_fixed_expense) / baselineInputs.gp_net) * 100 : 0,
        };

         // Compute the forecast month value using drivers + weights (UI behavior),
         // then allow saved forecast_entries (manual edits) to override.
         const weightFactor = getWeightFactor(monthNumber);
         const computedDrivers: Record<string, number> = {
           total_sales: annualTotalSales * weightFactor,
           gp_net: annualGpNet * weightFactor,
           sales_expense: annualSalesExp * weightFactor,
           total_fixed_expense: annualFixedExp * weightFactor,
           parts_transfer: annualPartsTransfer * weightFactor,
         };
         const computedDerived: Record<string, number> = {
           gp_percent: computedDrivers.total_sales > 0 ? (computedDrivers.gp_net / computedDrivers.total_sales) * 100 : 0,
           sales_expense_percent: computedDrivers.gp_net > 0 ? (computedDrivers.sales_expense / computedDrivers.gp_net) * 100 : 0,
           net_selling_gross: computedDrivers.gp_net - computedDrivers.sales_expense,
           department_profit: computedDrivers.gp_net - computedDrivers.sales_expense - computedDrivers.total_fixed_expense,
           net_operating_profit: (computedDrivers.gp_net - computedDrivers.sales_expense - computedDrivers.total_fixed_expense) + computedDrivers.parts_transfer,
           return_on_gross: computedDrivers.gp_net > 0
             ? ((computedDrivers.gp_net - computedDrivers.sales_expense - computedDrivers.total_fixed_expense) / computedDrivers.gp_net) * 100
             : 0,
         };
         const computedValue =
           computedDrivers[def.key] !== undefined
             ? computedDrivers[def.key]
             : (computedDerived[def.key] ?? 0);

         const savedEntry = entriesMap.get(`${month}:${def.key}`);

        const baselineValue =
          baselineMonthData?.get(def.key) ??
          baselineMonthlyValues[def.key] ??
          0;

         // Prefer any saved forecast value (manual edits), otherwise use computed forecast value.
         const value = (savedEntry && savedEntry.forecast_value !== undefined && savedEntry.forecast_value !== null)
           ? savedEntry.forecast_value
           : computedValue;

        monthData[month] = { value, baseline: baselineValue };
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
          baseline: def.type === "percent" ? qBaseline / 3 : qBaseline,
        };
      }

      // Annual values (sum currency, average percent)
      const annualValueRaw = months.reduce((sum, m) => sum + (monthData[m]?.value || 0), 0);
      const annualBaselineRaw = months.reduce((sum, m) => sum + (monthData[m]?.baseline || 0), 0);
      const annualValue = def.type === 'percent' ? annualValueRaw / 12 : annualValueRaw;
      const annualBaselineValue = def.type === 'percent' ? annualBaselineRaw / 12 : annualBaselineRaw;

      const variance = annualValue - annualBaselineValue;
      const variancePercent = annualBaselineValue !== 0 ? (variance / Math.abs(annualBaselineValue)) * 100 : 0;

      return {
        key: def.key,
        label: def.label,
        type: def.type,
        months: monthData,
        quarters: quarterData,
        annual: { value: annualValue, baseline: annualBaselineValue, variance, variancePercent },
      };
    });

    // Fix ALL percentage and derived metrics at quarterly/annual levels - must be recalculated from aggregated currency values
    // This matches the UI logic in useForecastCalculations.ts
    const totalSalesData = metricsData.find(m => m.key === 'total_sales');
    const gpNetData = metricsData.find(m => m.key === 'gp_net');
    const salesExpenseData = metricsData.find(m => m.key === 'sales_expense');
    const fixedExpenseData = metricsData.find(m => m.key === 'total_fixed_expense');
    const nsgData = metricsData.find(m => m.key === 'net_selling_gross');
    const deptProfitData = metricsData.find(m => m.key === 'department_profit');
    const partsTransferData = metricsData.find(m => m.key === 'parts_transfer');
    const netOpData = metricsData.find(m => m.key === 'net_operating_profit');
    const gpPercentData = metricsData.find(m => m.key === 'gp_percent');
    const salesExpPercentData = metricsData.find(m => m.key === 'sales_expense_percent');
    const rogData = metricsData.find(m => m.key === 'return_on_gross');

    // Fix Net Selling Gross (derived: gp_net - sales_expense) at quarterly/annual levels
    if (nsgData && gpNetData && salesExpenseData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qGpNet = gpNetData.quarters[qKey]?.value ?? 0;
        const qSalesExp = salesExpenseData.quarters[qKey]?.value ?? 0;
        const qBaselineGpNet = gpNetData.quarters[qKey]?.baseline ?? 0;
        const qBaselineSalesExp = salesExpenseData.quarters[qKey]?.baseline ?? 0;
        
        nsgData.quarters[qKey] = {
          value: qGpNet - qSalesExp,
          baseline: qBaselineGpNet - qBaselineSalesExp,
        };
      }
      
      const nsgValue = gpNetData.annual.value - salesExpenseData.annual.value;
      const nsgBaseline = gpNetData.annual.baseline - salesExpenseData.annual.baseline;
      nsgData.annual = {
        value: nsgValue,
        baseline: nsgBaseline,
        variance: nsgValue - nsgBaseline,
        variancePercent: nsgBaseline !== 0 ? ((nsgValue - nsgBaseline) / Math.abs(nsgBaseline)) * 100 : 0,
      };
    }

    // Fix Department Profit (derived: gp_net - sales_expense - fixed_expense) at quarterly/annual levels
    if (deptProfitData && gpNetData && salesExpenseData && fixedExpenseData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qGpNet = gpNetData.quarters[qKey]?.value ?? 0;
        const qSalesExp = salesExpenseData.quarters[qKey]?.value ?? 0;
        const qFixedExp = fixedExpenseData.quarters[qKey]?.value ?? 0;
        const qBaselineGpNet = gpNetData.quarters[qKey]?.baseline ?? 0;
        const qBaselineSalesExp = salesExpenseData.quarters[qKey]?.baseline ?? 0;
        const qBaselineFixedExp = fixedExpenseData.quarters[qKey]?.baseline ?? 0;
        
        deptProfitData.quarters[qKey] = {
          value: qGpNet - qSalesExp - qFixedExp,
          baseline: qBaselineGpNet - qBaselineSalesExp - qBaselineFixedExp,
        };
      }
      
      const profitValue = gpNetData.annual.value - salesExpenseData.annual.value - fixedExpenseData.annual.value;
      const profitBaseline = gpNetData.annual.baseline - salesExpenseData.annual.baseline - fixedExpenseData.annual.baseline;
      deptProfitData.annual = {
        value: profitValue,
        baseline: profitBaseline,
        variance: profitValue - profitBaseline,
        variancePercent: profitBaseline !== 0 ? ((profitValue - profitBaseline) / Math.abs(profitBaseline)) * 100 : 0,
      };
    }

    // Fix Net Operating Profit (derived: dept_profit + parts_transfer) at quarterly/annual levels
    if (netOpData && deptProfitData && partsTransferData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qDeptProfit = deptProfitData.quarters[qKey]?.value ?? 0;
        const qPartsTransfer = partsTransferData.quarters[qKey]?.value ?? 0;
        const qBaselineDeptProfit = deptProfitData.quarters[qKey]?.baseline ?? 0;
        const qBaselinePartsTransfer = partsTransferData.quarters[qKey]?.baseline ?? 0;
        
        netOpData.quarters[qKey] = {
          value: qDeptProfit + qPartsTransfer,
          baseline: qBaselineDeptProfit + qBaselinePartsTransfer,
        };
      }
      
      const netOpValue = deptProfitData.annual.value + partsTransferData.annual.value;
      const netOpBaseline = deptProfitData.annual.baseline + partsTransferData.annual.baseline;
      netOpData.annual = {
        value: netOpValue,
        baseline: netOpBaseline,
        variance: netOpValue - netOpBaseline,
        variancePercent: netOpBaseline !== 0 ? ((netOpValue - netOpBaseline) / Math.abs(netOpBaseline)) * 100 : 0,
      };
    }
    
    // Fix GP % quarterly/annual
    if (gpPercentData && gpNetData && totalSalesData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qGpNet = gpNetData.quarters[qKey]?.value ?? 0;
        const qSales = totalSalesData.quarters[qKey]?.value ?? 0;
        const qBaselineGpNet = gpNetData.quarters[qKey]?.baseline ?? 0;
        const qBaselineSales = totalSalesData.quarters[qKey]?.baseline ?? 0;
        
        gpPercentData.quarters[qKey] = {
          value: qSales > 0 ? (qGpNet / qSales) * 100 : 0,
          baseline: qBaselineSales > 0 ? (qBaselineGpNet / qBaselineSales) * 100 : 0,
        };
      }
      
      const gpPercentValue = totalSalesData.annual.value > 0 ? (gpNetData.annual.value / totalSalesData.annual.value) * 100 : 0;
      const gpPercentBaseline = totalSalesData.annual.baseline > 0 ? (gpNetData.annual.baseline / totalSalesData.annual.baseline) * 100 : 0;
      gpPercentData.annual = {
        value: gpPercentValue,
        baseline: gpPercentBaseline,
        variance: gpPercentValue - gpPercentBaseline,
        variancePercent: gpPercentBaseline !== 0 ? ((gpPercentValue - gpPercentBaseline) / Math.abs(gpPercentBaseline)) * 100 : 0,
      };
    }
    
    // Fix Sales Expense % quarterly/annual
    if (salesExpPercentData && salesExpenseData && gpNetData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qSalesExp = salesExpenseData.quarters[qKey]?.value ?? 0;
        const qGpNet = gpNetData.quarters[qKey]?.value ?? 0;
        const qBaselineSalesExp = salesExpenseData.quarters[qKey]?.baseline ?? 0;
        const qBaselineGpNet = gpNetData.quarters[qKey]?.baseline ?? 0;
        
        salesExpPercentData.quarters[qKey] = {
          value: qGpNet > 0 ? (qSalesExp / qGpNet) * 100 : 0,
          baseline: qBaselineGpNet > 0 ? (qBaselineSalesExp / qBaselineGpNet) * 100 : 0,
        };
      }
      
      const salesExpPercentValue = gpNetData.annual.value > 0 ? (salesExpenseData.annual.value / gpNetData.annual.value) * 100 : 0;
      const salesExpPercentBaseline = gpNetData.annual.baseline > 0 ? (salesExpenseData.annual.baseline / gpNetData.annual.baseline) * 100 : 0;
      salesExpPercentData.annual = {
        value: salesExpPercentValue,
        baseline: salesExpPercentBaseline,
        variance: salesExpPercentValue - salesExpPercentBaseline,
        variancePercent: salesExpPercentBaseline !== 0 ? ((salesExpPercentValue - salesExpPercentBaseline) / Math.abs(salesExpPercentBaseline)) * 100 : 0,
      };
    }
    
    // Fix Return on Gross quarterly/annual (must come AFTER dept profit fix)
    if (rogData && deptProfitData && gpNetData) {
      for (let q = 1; q <= 4; q++) {
        const qKey = `Q${q}`;
        const qDeptProfit = deptProfitData.quarters[qKey]?.value ?? 0;
        const qGpNet = gpNetData.quarters[qKey]?.value ?? 0;
        const qBaselineDeptProfit = deptProfitData.quarters[qKey]?.baseline ?? 0;
        const qBaselineGpNet = gpNetData.quarters[qKey]?.baseline ?? 0;
        
        rogData.quarters[qKey] = {
          value: qGpNet > 0 ? (qDeptProfit / qGpNet) * 100 : 0,
          baseline: qBaselineGpNet > 0 ? (qBaselineDeptProfit / qBaselineGpNet) * 100 : 0,
        };
      }
      
      const rogValue = gpNetData.annual.value > 0 ? (deptProfitData.annual.value / gpNetData.annual.value) * 100 : 0;
      const rogBaseline = gpNetData.annual.baseline > 0 ? (deptProfitData.annual.baseline / gpNetData.annual.baseline) * 100 : 0;
      rogData.annual = {
        value: rogValue,
        baseline: rogBaseline,
        variance: rogValue - rogBaseline,
        variancePercent: rogBaseline !== 0 ? ((rogValue - rogBaseline) / Math.abs(rogBaseline)) * 100 : 0,
      };
    }

    // Use customRecipients directly
    const recipients = customRecipients.filter(email => email && email.includes('@'));
    
    if (recipients.length === 0) {
      throw new Error("No valid recipients provided");
    }

    console.log("Recipients:", recipients);

    // Get recap values - nsgData and deptProfitData are already defined above
    const profitVariance = deptProfitData?.annual.variance || 0;
    const profitVariancePercent = deptProfitData?.annual.variancePercent || 0;
    
    // Check if crossing zero for percentage display
    const forecastProfit = deptProfitData?.annual.value || 0;
    const baselineProfit = deptProfitData?.annual.baseline || 0;
    const profitCrossesZero = (forecastProfit >= 0) !== (baselineProfit >= 0);
    const showProfitPercent = !profitCrossesZero && baselineProfit !== 0;

    // Build HTML email - FULLY INLINE STYLES (no <style> blocks or classes for forward-proof emails)
    const viewLabel = view === "monthly" ? "Monthly View" : view === "quarter" ? "Quarterly View" : "Annual View";
    
    // Style constants for inline use
    const styles = {
      positive: "color: #16a34a;",
      negative: "color: #dc2626;",
      annualCol: "background-color: #f0f9ff;",
      varianceCol: "background-color: #ecfdf5;",
      baselineCol: "background-color: #f9fafb;",
      highlightRow: "background-color: #eff6ff; font-weight: 600;",
      th: "border: 1px solid #e5e7eb; padding: 8px 12px; text-align: center; font-size: 12px; background-color: #f3f4f6; font-weight: 600;",
      td: "border: 1px solid #e5e7eb; padding: 8px 12px; text-align: right; font-size: 12px;",
      tdFirst: "border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; font-size: 12px; font-weight: 500;",
    };

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #ffffff; color: #333333;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 900px; margin: 0 auto;">
          <tr>
            <td>
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0 0 8px 0; font-weight: bold;">${deptData.stores.name} - ${deptData.name} Forecast</h1>
              <p style="color: #666666; font-size: 14px; margin: 0 0 20px 0;"><strong>${forecastYear} Forecast</strong> &bull; ${viewLabel} &bull; vs ${priorYear} Baseline</p>
              
              <!-- Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="font-size: 14px; color: #666666; margin: 0 0 12px 0;">Year Over Year Comparison</p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="50%" valign="top" style="padding-right: 16px;">
                          <!-- Net Selling Gross -->
                          <p style="margin: 0; font-size: 14px;">
                            <span style="color: #666666;">Net Selling Gross:</span>
                            <span style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin-left: 8px;">${formatCurrency(nsgData?.annual.value || 0)}</span>
                            <span style="color: #666666; margin-left: 8px;">vs ${formatCurrency(nsgData?.annual.baseline || 0)} prior</span>
                          </p>
                          <p style="margin: 2px 0 0 0; font-size: 14px; ${(nsgData?.annual.variance || 0) >= 0 ? styles.positive : styles.negative}">
                            ${formatVariance(nsgData?.annual.variance || 0, "currency")}${
                              nsgData && (nsgData.annual.value >= 0) === (nsgData.annual.baseline >= 0) && nsgData.annual.baseline !== 0 
                                ? ` (${nsgData.annual.variancePercent >= 0 ? "+" : ""}${nsgData.annual.variancePercent.toFixed(1)}%)` 
                                : ""
                            }
                          </p>
                          <p style="margin: 0; font-size: 12px; color: #666666;">
                            ${(nsgData?.annual.variance || 0) >= 0 ? "+" : ""}${formatCurrency((nsgData?.annual.variance || 0) / 12)} per month variance
                          </p>
                        </td>
                        <td width="50%" valign="top" style="padding-left: 16px;">
                          <!-- Department Profit -->
                          <p style="margin: 0; font-size: 14px;">
                            <span style="color: #666666;">Dept Profit:</span>
                            <span style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin-left: 8px;">${formatCurrency(deptProfitData?.annual.value || 0)}</span>
                            <span style="color: #666666; margin-left: 8px;">vs ${formatCurrency(deptProfitData?.annual.baseline || 0)} prior</span>
                          </p>
                          <p style="margin: 2px 0 0 0; font-size: 14px; ${profitVariance >= 0 ? styles.positive : styles.negative}">
                            ${formatVariance(profitVariance, "currency")}${showProfitPercent ? ` (${profitVariancePercent >= 0 ? "+" : ""}${profitVariancePercent.toFixed(1)}%)` : ""}
                          </p>
                          <p style="margin: 0; font-size: 12px; color: #666666;">
                            ${profitVariance >= 0 ? "+" : ""}${formatCurrency(profitVariance / 12)} per month variance
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
    `;

    // Build the table based on view - ALL INLINE STYLES
    if (view === "annual") {
      html += `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr>
                    <th style="${styles.th} text-align: left;">Metric</th>
                    <th style="${styles.th} ${styles.annualCol}">${forecastYear}</th>
                    <th style="${styles.th} ${styles.varianceCol}">Variance</th>
                    <th style="${styles.th} ${styles.baselineCol}">${priorYear}</th>
                  </tr>
                </thead>
                <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowStyle = isProfit ? styles.highlightRow : "";
        const varianceColor = getVarianceColor(metric.annual.variance, metric.key, styles.positive, styles.negative);
        
        html += `
          <tr style="${rowStyle}">
            <td style="${styles.tdFirst} ${rowStyle}">${metric.label}</td>
            <td style="${styles.td} ${styles.annualCol}">${formatValue(metric.annual.value, metric.type)}</td>
            <td style="${styles.td} ${styles.varianceCol} ${varianceColor}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td style="${styles.td} ${styles.baselineCol}">${formatValue(metric.annual.baseline, metric.type)}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    } else if (view === "quarter") {
      html += `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr>
                    <th style="${styles.th} text-align: left;">Metric</th>
                    <th style="${styles.th}">Q1</th>
                    <th style="${styles.th}">Q2</th>
                    <th style="${styles.th}">Q3</th>
                    <th style="${styles.th}">Q4</th>
                    <th style="${styles.th} ${styles.annualCol}">${forecastYear}</th>
                    <th style="${styles.th} ${styles.varianceCol}">Var</th>
                    <th style="${styles.th} ${styles.baselineCol}">${priorYear}</th>
                  </tr>
                </thead>
                <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowStyle = isProfit ? styles.highlightRow : "";
        const varianceColor = getVarianceColor(metric.annual.variance, metric.key, styles.positive, styles.negative);
        
        html += `<tr style="${rowStyle}"><td style="${styles.tdFirst} ${rowStyle}">${metric.label}</td>`;
        
        for (let q = 1; q <= 4; q++) {
          const qKey = `Q${q}`;
          html += `<td style="${styles.td}">${formatValue(metric.quarters[qKey]?.value, metric.type)}</td>`;
        }
        
        html += `
            <td style="${styles.td} ${styles.annualCol}">${formatValue(metric.annual.value, metric.type)}</td>
            <td style="${styles.td} ${styles.varianceCol} ${varianceColor}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td style="${styles.td} ${styles.baselineCol}">${formatValue(metric.annual.baseline, metric.type)}</td>
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
              <h2 style="color: #1a1a1a; font-size: 18px; margin: 24px 0 12px 0;">${half === 0 ? "January - June" : "July - December"}</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr>
                    <th style="${styles.th} text-align: left;">Metric</th>
        `;
        
        monthsSlice.forEach((m) => {
          const monthIndex = parseInt(m.split("-")[1]) - 1;
          html += `<th style="${styles.th}">${MONTH_ABBREV[monthIndex]}</th>`;
        });
        
        html += `
                  </tr>
                </thead>
                <tbody>
        `;

        metricsData.forEach((metric) => {
          const isProfit = metric.key === "department_profit";
          const rowStyle = isProfit ? styles.highlightRow : "";
          
          html += `<tr style="${rowStyle}"><td style="${styles.tdFirst} ${rowStyle}">${metric.label}</td>`;
          
          monthsSlice.forEach((m) => {
            html += `<td style="${styles.td}">${formatValue(metric.months[m]?.value, metric.type)}</td>`;
          });
          
          html += `</tr>`;
        });

        html += `</tbody></table>`;
      }

      // Add annual summary table
      html += `
              <h2 style="color: #1a1a1a; font-size: 18px; margin: 24px 0 12px 0;">Annual Summary</h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr>
                    <th style="${styles.th} text-align: left;">Metric</th>
                    <th style="${styles.th} ${styles.annualCol}">${forecastYear}</th>
                    <th style="${styles.th} ${styles.varianceCol}">Variance</th>
                    <th style="${styles.th} ${styles.baselineCol}">${priorYear}</th>
                  </tr>
                </thead>
                <tbody>
      `;

      metricsData.forEach((metric) => {
        const isProfit = metric.key === "department_profit";
        const rowStyle = isProfit ? styles.highlightRow : "";
        const varianceColor = getVarianceColor(metric.annual.variance, metric.key, styles.positive, styles.negative);
        
        html += `
          <tr style="${rowStyle}">
            <td style="${styles.tdFirst} ${rowStyle}">${metric.label}</td>
            <td style="${styles.td} ${styles.annualCol}">${formatValue(metric.annual.value, metric.type)}</td>
            <td style="${styles.td} ${styles.varianceCol} ${varianceColor}">${formatVariance(metric.annual.variance, metric.type)}</td>
            <td style="${styles.td} ${styles.baselineCol}">${formatValue(metric.annual.baseline, metric.type)}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    }

    // Add sub-metrics section if included
    if (includeSubMetrics) {
      // Fetch sub-metric data and overrides
      const { data: subMetricOverrides } = await supabaseClient
        .from("forecast_submetric_overrides")
        .select("*")
        .eq("forecast_id", forecast.id);

      const { data: subMetricEntries } = await supabaseClient
        .from("financial_entries")
        .select("month, metric_name, value")
        .eq("department_id", departmentId)
        .gte("month", `${priorYear}-01`)
        .lte("month", `${priorYear}-12`)
        .like("metric_name", "sub:%");

      const { data: subMetricNotes } = await supabaseClient
        .from("forecast_submetric_notes")
        .select("*")
        .eq("department_id", departmentId)
        .eq("forecast_year", forecastYear)
        .eq("is_resolved", false);

      if (subMetricEntries && subMetricEntries.length > 0) {
        // Group sub-metrics and calculate annual totals (preserve exact sub_metric_key format)
        // Also capture orderIndex to maintain the same sequence as the forecast UI
        const grouped = new Map<
          string,
          { parentKey: string; name: string; subMetricKey: string; orderIndex: number; total: number }
        >();
        subMetricEntries.forEach((entry) => {
          // New format: sub:{parent_key}:{order_index}:{name}
          // Legacy format: sub:{parent_key}:{name}
          const parts = entry.metric_name.split(":");
          if (parts.length < 3) return;

          const parentKey = parts[1];

          // Match the Forecast UI key format: orderIndex is numeric, and key uses 3-digit zero padding.
          const hasOrder = parts.length >= 4;
          const orderIndex = hasOrder ? (parseInt(parts[2], 10) || 0) : 999;
          const orderIndexStr = String(orderIndex).padStart(3, "0");
          const name = hasOrder ? parts.slice(3).join(":") : parts.slice(2).join(":");

          const subMetricKey = `sub:${parentKey}:${orderIndexStr}:${name}`;
          const key = `${parentKey}:${subMetricKey}`;

          if (!grouped.has(key)) {
            grouped.set(key, { parentKey, name, subMetricKey, orderIndex, total: 0 });
          }
          grouped.get(key)!.total += entry.value || 0;
        });

        // Build sub-metric data with forecast values from overrides.
        // IMPORTANT: The UI derives % sub-metrics (GP %) from their underlying $ sub-metrics.
        // So for gp_percent we compute: gp_net_sub / total_sales_sub.
        // For $ parents, we scale prior-year (baseline) by parent forecast-vs-baseline ratio unless overridden.

        const findOverride = (parentKey: string, subMetricKey: string) =>
          subMetricOverrides?.find(
            (o) => o.parent_metric_key === parentKey && o.sub_metric_key === subMetricKey
          );

        // First compute forecast/baseline for currency parents so % parents can derive from them.
        const currencyParents = new Set<string>(["total_sales", "gp_net", "sales_expense", "net_selling_gross", "total_fixed_expense", "department_profit", "parts_transfer", "net_operating_profit"]);

        type SubRow = {
          parentKey: string;
          name: string;
          orderIndex: number;
          subMetricKey: string;
          forecastValue: number;
          baselineValue: number;
          variance: number;
        };

        const subRows: SubRow[] = [];

        // Maps used for deriving gp_percent rows
        const baselineByParentName = new Map<string, number>();
        const forecastByParentName = new Map<string, number>();

        const putMaps = (parentKey: string, name: string, orderIndex: number, baseline: number, forecast: number) => {
          const k = `${parentKey}::${orderIndex}::${name}`;
          baselineByParentName.set(k, baseline);
          forecastByParentName.set(k, forecast);
        };

        const computeScaledCurrencyForecast = (parentKey: string, baselineValue: number, subMetricKey: string): number => {
          const override = findOverride(parentKey, subMetricKey);
          if (override) return override.overridden_annual_value;

          const parentBaselineTotal = (annualBaselineValues as any)?.[parentKey] ?? 0;
          const parentForecastTotal = (annualForecastValues as any)?.[parentKey] ?? parentBaselineTotal;
          const parentScale = parentBaselineTotal !== 0 ? parentForecastTotal / parentBaselineTotal : 1;
          return baselineValue * parentScale;
        };

        // Pass 1: currency parents
        Array.from(grouped.values())
          .filter((g) => currencyParents.has(g.parentKey))
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .forEach((g) => {
            const baselineValue = g.total;
            const forecastValue = computeScaledCurrencyForecast(g.parentKey, baselineValue, g.subMetricKey);
            const variance = forecastValue - baselineValue;

            putMaps(g.parentKey, g.name, g.orderIndex, baselineValue, forecastValue);

            subRows.push({
              parentKey: g.parentKey,
              name: g.name,
              orderIndex: g.orderIndex,
              subMetricKey: g.subMetricKey,
              forecastValue,
              baselineValue,
              variance,
            });
          });

        // Pass 2: GP % (derived) — matches Forecast UI behavior
        Array.from(grouped.values())
          .filter((g) => g.parentKey === "gp_percent")
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .forEach((g) => {
            const override = findOverride("gp_percent", g.subMetricKey);

            // Baseline %: gp_net_baseline / total_sales_baseline
            const baseSales = baselineByParentName.get(`total_sales::${g.orderIndex}::${g.name}`) ?? 0;
            const baseGpNet = baselineByParentName.get(`gp_net::${g.orderIndex}::${g.name}`) ?? 0;
            const baselineValue = baseSales !== 0 ? (baseGpNet / baseSales) * 100 : 0;

            // Forecast %: gp_net_forecast / total_sales_forecast
            const fSales = forecastByParentName.get(`total_sales::${g.orderIndex}::${g.name}`) ?? 0;
            const fGpNet = forecastByParentName.get(`gp_net::${g.orderIndex}::${g.name}`) ?? 0;
            const derivedForecast = fSales !== 0 ? (fGpNet / fSales) * 100 : 0;

            const forecastValue = override ? override.overridden_annual_value : derivedForecast;
            const variance = forecastValue - baselineValue;

            subRows.push({
              parentKey: "gp_percent",
              name: g.name,
              orderIndex: g.orderIndex,
              subMetricKey: g.subMetricKey,
              forecastValue,
              baselineValue,
              variance,
            });
          });

        // Final array, ordered by statement order within each parent
        const subMetricData = subRows.sort((a, b) => a.orderIndex - b.orderIndex);


        if (subMetricData.length > 0) {
          // Group by parent key
          const groupedByParent = new Map<string, typeof subMetricData>();
          subMetricData.forEach((sm) => {
            if (!groupedByParent.has(sm.parentKey)) {
              groupedByParent.set(sm.parentKey, []);
            }
            groupedByParent.get(sm.parentKey)!.push(sm);
          });

          // Ensure sub-metrics within each parent are sorted by orderIndex (match UI sequence)
          groupedByParent.forEach((items, key) => {
            items.sort((a, b) => a.orderIndex - b.orderIndex);
          });

          // Ensure parent sections render in the same sequence as the Forecast UI
          const parentOrder = new Map<string, number>(
            METRIC_DEFINITIONS.map((m, idx) => [m.key, idx])
          );
          const orderedParents = Array.from(groupedByParent.entries()).sort((a, b) => {
            const aIdx = parentOrder.get(a[0]) ?? 999;
            const bIdx = parentOrder.get(b[0]) ?? 999;
            return aIdx - bIdx;
          });

          html += `<h2 style="color: #1a1a1a; font-size: 18px; margin: 24px 0 12px 0;">Sub-Metric Details</h2>`;

          orderedParents.forEach(([parentKey, items]) => {
            const parentMetric = METRIC_DEFINITIONS.find((m) => m.key === parentKey);
            const parentLabel = parentMetric?.label || parentKey;
            const parentType = parentMetric?.type || "currency";
            html += `
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 16px;">
                <thead>
                  <tr>
                    <th colspan="4" style="${styles.th} ${styles.annualCol} text-align: left;">${parentLabel}</th>
                  </tr>
                  <tr>
                    <th style="${styles.th} text-align: left;">Sub-Metric</th>
                    <th style="${styles.th} ${styles.annualCol}">${forecastYear}</th>
                    <th style="${styles.th} ${styles.varianceCol}">Variance</th>
                    <th style="${styles.th} ${styles.baselineCol}">${priorYear}</th>
                  </tr>
                </thead>
                <tbody>
            `;

            items.forEach((item) => {
              const note = subMetricNotes?.find((n) => n.sub_metric_key === item.name);
              // For sub-metrics under expense parents, invert the variance color logic
              const varianceColor = getVarianceColor(item.variance, item.parentKey, styles.positive, styles.negative);
              html += `
                <tr>
                  <td style="${styles.tdFirst}">${item.name}${note ? '<span style="display: inline-block; width: 8px; height: 8px; background-color: #f59e0b; border-radius: 2px; margin-left: 4px;"></span>' : ''}</td>
                  <td style="${styles.td} ${styles.annualCol}">${formatValue(item.forecastValue, parentType)}</td>
                  <td style="${styles.td} ${styles.varianceCol} ${varianceColor}">${formatVariance(item.variance, parentType)}</td>
                  <td style="${styles.td} ${styles.baselineCol}">${formatValue(item.baselineValue, parentType)}</td>
                </tr>
              `;
            });
            
            html += `</tbody></table>`;
          });
        }

        // Add notes section if there are any
        if (subMetricNotes && subMetricNotes.length > 0) {
          html += `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
              <tr>
                <td style="padding: 16px; background-color: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
                  <p style="font-weight: 600; color: #92400e; margin: 0 0 12px 0;">📋 Forecast Notes</p>
          `;
          
          subMetricNotes.forEach((note) => {
            html += `
                  <p style="margin: 0 0 8px 0; font-size: 13px;">
                    <span style="font-weight: 500; color: #92400e;">${note.sub_metric_key}:</span> ${note.note || ""}
                  </p>
            `;
          });
          
          html += `
                </td>
              </tr>
            </table>
          `;
        }
      }
    }

    html += `
              <!-- Footer -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 32px; border-top: 1px solid #e5e7eb;">
                <tr>
                  <td style="padding-top: 16px;">
                    <p style="font-size: 12px; color: #9ca3af; margin: 0 0 4px 0;">This forecast report was generated by the Growth Scorecard application.</p>
                    <p style="font-size: 12px; color: #9ca3af; margin: 0;">Generated on ${new Date().toLocaleString()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
