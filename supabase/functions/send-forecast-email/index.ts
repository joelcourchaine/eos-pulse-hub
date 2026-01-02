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

    // Fetch sub-metric baseline data for prior year
    const { data: subMetricBaselineData } = await supabaseClient
      .from("financial_entries")
      .select("month, metric_name, value")
      .eq("department_id", departmentId)
      .gte("month", `${priorYear}-01`)
      .lte("month", `${priorYear}-12`)
      .like("metric_name", "sub:%");

    // Fetch sub-metric overrides for this forecast
    const { data: subMetricOverrides } = await supabaseClient
      .from("forecast_submetric_overrides")
      .select("parent_metric_key, sub_metric_key, overridden_annual_value")
      .eq("forecast_id", forecast.id);

    console.log(
      "Sub-metric data loaded - baseline entries:",
      subMetricBaselineData?.length || 0,
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

    const sumForecast = (metric: string): number => {
      let total = 0;
      for (let m = 1; m <= 12; m++) {
        const month = `${forecastYear}-${String(m).padStart(2, '0')}`;
        const entry = entriesByMonthMetric.get(`${month}:${metric}`);
        if (entry && entry.forecast !== null && entry.forecast !== undefined) {
          total += entry.forecast;
        }
      }
      return total;
    };

    const baselineTotalSales = annualBaseline['total_sales'] || 0;
    const baselineGpNet = annualBaseline['gp_net'] || 0;
    const baselineSalesExp = annualBaseline['sales_expense'] || 0;
    const baselineFixedExp = annualBaseline['total_fixed_expense'] || 0;
    const baselinePartsTransfer = annualBaseline['parts_transfer'] || 0;

    const annualTotalSales = sumForecast('total_sales');
    const annualGpNet = sumForecast('gp_net');
    const annualSalesExp = sumForecast('sales_expense');
    const annualFixedExp = sumForecast('total_fixed_expense');
    const annualPartsTransfer = sumForecast('parts_transfer');

    // Derived (match UI annual calculation style)
    const gpPercent = annualTotalSales > 0 ? (annualGpNet / annualTotalSales) * 100 : 0;
    const annualSalesExpPercent = annualGpNet > 0 ? (annualSalesExp / annualGpNet) * 100 : 0;
    const annualNetSellingGross = annualGpNet - annualSalesExp;
    const annualDeptProfit = annualGpNet - annualSalesExp - annualFixedExp;
    const annualNetOperatingProfit = annualDeptProfit + annualPartsTransfer;
    const annualReturnOnGross = annualGpNet > 0 ? (annualDeptProfit / annualGpNet) * 100 : 0;

    console.log("Annual totals from forecast_entries:", {
      annualTotalSales,
      annualGpNet,
      annualSalesExp,
      annualFixedExp,
      annualDeptProfit,
    });

    // Annual forecast values
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

    // Update salesExpense variable for use in monthly calculations
    const salesExpense = annualSalesExp;

    // Re-introduce variables expected by the existing monthly-calculation block below.
    // The email's annual totals now come from saved forecast_entries, so we don't apply growth drivers here.
    const growth = 0;
    const growthFactor = 1;
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

        const lockedTotalSales = entriesMap.get(`${month}:total_sales`);
        const lockedGpNet = entriesMap.get(`${month}:gp_net`);
        const lockedGpPercent = entriesMap.get(`${month}:gp_percent`);
        const lockedSalesExpense = entriesMap.get(`${month}:sales_expense`);

        const targetGpPercent = (lockedGpPercent?.is_locked ? lockedGpPercent.forecast_value : null) ?? baselineMonthlyValues.gp_percent;

        const hasAnyLockedDrivers = !!(
          (lockedGpPercent?.is_locked) ||
          (lockedTotalSales?.is_locked) ||
          (lockedGpNet?.is_locked)
        );

        // Don't use baseline directly if there are GP% sub-metric overrides
        const useBaselineDirectly =
          growth === 0 &&
          Math.abs(salesExpense - baseSalesExpense) < 1 &&
          !hasAnyLockedDrivers &&
          !hasGpPercentOverrides;

        const getBaselineGpPctForScaling = () => {
          const monthPct = baselineMonthlyValues.gp_percent;
          return monthPct > 0 ? monthPct : baselineGpPercent;
        };

        const getCalculatedTotalSales = () => {
          if (lockedTotalSales?.is_locked) return lockedTotalSales.forecast_value;

          // For stores with GP% sub-metric overrides, calculate from sub-metrics
          if (hasGpPercentOverrides) {
            const salesSubs = subMetricBaselines.filter((s) => s.parentKey === "total_sales");
            if (salesSubs.length > 0) {
              let monthTotal = 0;
              salesSubs.forEach((sub) => {
                const subMonthValue = sub.monthlyValues.get(priorYearMonth) ?? 0;
                monthTotal += subMonthValue * growthFactor;
              });
              return monthTotal;
            }
          }

          // KTRV-like behavior (no sub-metrics): if GP% is locked higher, scale sales up proportionally
          if (lockedGpPercent?.is_locked) {
            const basePct = getBaselineGpPctForScaling();
            if (basePct > 0 && targetGpPercent > basePct) {
              const ratio = targetGpPercent / basePct;
              return baselineMonthlyValues.total_sales * growthFactor * ratio;
            }
          }

          return baselineMonthlyValues.total_sales * growthFactor;
        };

        const getCalculatedGpNet = () => {
          if (lockedGpNet?.is_locked) return lockedGpNet.forecast_value;
          
          // For stores with GP% sub-metric overrides, calculate GP Net from sub-metrics
          if (hasGpPercentOverrides) {
            const salesSubs = subMetricBaselines.filter((s) => s.parentKey === "total_sales");
            const gpPercentSubs = subMetricBaselines.filter((s) => s.parentKey === "gp_percent");
            
            if (salesSubs.length > 0 && gpPercentSubs.length > 0) {
              let monthGpNet = 0;
              
              salesSubs.forEach((salesSub) => {
                const salesSubMonthValue = salesSub.monthlyValues.get(priorYearMonth) ?? 0;
                const forecastSales = salesSubMonthValue * growthFactor;
                
                // Find matching GP% sub-metric by name
                const matchingGpPercentSub = gpPercentSubs.find((gp) => gp.name === salesSub.name);
                
                if (matchingGpPercentSub) {
                  // Check for override on this GP% sub-metric.
                  // Overrides are stored using the exact key format: sub:gp_percent:006:Repair Shop
                  const subMetricKey = `sub:gp_percent:${String(matchingGpPercentSub.orderIndex).padStart(3, '0')}:${matchingGpPercentSub.name}`;
                  const overriddenGpPercent = overrideMap.get(`gp_percent:${subMetricKey}`);

                  // Get baseline GP% for this month (it's a percentage, so use directly)
                  const baselineGpPercentForMonth = matchingGpPercentSub.monthlyValues.get(priorYearMonth) ?? 0;
                  
                  // Use override or baseline GP%
                  const effectiveGpPercent = overriddenGpPercent ?? baselineGpPercentForMonth;
                  
                  // Calculate GP Net for this sub-metric: Sales × GP% / 100
                  const subGpNet = forecastSales * (effectiveGpPercent / 100);
                  monthGpNet += subGpNet;
                } else {
                  // No matching GP% sub, use baseline GP% for this month
                  const subGpNet = forecastSales * (baselineMonthlyValues.gp_percent / 100);
                  monthGpNet += subGpNet;
                }
              });
              
              return monthGpNet;
            }
          }
          
          if (lockedGpPercent?.is_locked) {
            const totalSales = getCalculatedTotalSales();
            return totalSales * (targetGpPercent / 100);
          }
          return baselineMonthlyValues.gp_net * growthFactor;
        };

        const getCalculatedSalesExpense = () => {
          if (lockedSalesExpense?.is_locked) return lockedSalesExpense.forecast_value;
          const basePct = baselineMonthlyValues.sales_expense_percent;
          const gpNet = getCalculatedGpNet();
          return gpNet > 0 ? gpNet * (basePct / 100) : 0;
        };

        // Check for locked entry for this specific metric
        const lockedEntry = entriesMap.get(`${month}:${def.key}`);

        const baselineValue =
          baselineMonthData?.get(def.key) ??
          baselineMonthlyValues[def.key] ??
          0;

        let value: number;

        if (lockedEntry?.is_locked) {
          value = lockedEntry.forecast_value;
        } else if (useBaselineDirectly) {
          value = baselineValue;
        } else if (def.key === 'gp_percent') {
          // For stores with GP% sub-metric overrides, derive GP% from calculated values
          if (hasGpPercentOverrides) {
            const totalSales = getCalculatedTotalSales();
            const gpNet = getCalculatedGpNet();
            value = totalSales > 0 ? (gpNet / totalSales) * 100 : baselineMonthlyValues.gp_percent;
          } else {
            value = targetGpPercent;
          }
        } else if (def.key === 'total_sales') {
          value = getCalculatedTotalSales();
        } else if (def.key === 'gp_net') {
          value = getCalculatedGpNet();
        } else if (def.key === 'sales_expense_percent') {
          value = baselineMonthlyValues.sales_expense_percent;
        } else if (def.key === 'sales_expense') {
          value = getCalculatedSalesExpense();
        } else if (def.key === 'net_selling_gross') {
          value = getCalculatedGpNet() - getCalculatedSalesExpense();
        } else if (def.key === 'department_profit') {
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          value = getCalculatedGpNet() - getCalculatedSalesExpense() - fixedExp;
        } else if (def.key === 'parts_transfer') {
          value = baselineMonthlyValues.parts_transfer;
        } else if (def.key === 'net_operating_profit') {
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          const deptProfit = getCalculatedGpNet() - getCalculatedSalesExpense() - fixedExp;
          value = deptProfit + baselineMonthlyValues.parts_transfer;
        } else if (def.key === 'return_on_gross') {
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          const deptProfit = getCalculatedGpNet() - getCalculatedSalesExpense() - fixedExp;
          const gpNet = getCalculatedGpNet();
          value = gpNet > 0 ? (deptProfit / gpNet) * 100 : 0;
        } else {
          value = baselineValue * growthFactor;
        }

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

    // Fix ALL percentage metrics at quarterly/annual levels - must be recalculated from aggregated currency values
    // This matches the UI logic in useForecastCalculations.ts
    const totalSalesData = metricsData.find(m => m.key === 'total_sales');
    const gpNetData = metricsData.find(m => m.key === 'gp_net');
    const salesExpenseData = metricsData.find(m => m.key === 'sales_expense');
    const deptProfitData = metricsData.find(m => m.key === 'department_profit');
    const gpPercentData = metricsData.find(m => m.key === 'gp_percent');
    const salesExpPercentData = metricsData.find(m => m.key === 'sales_expense_percent');
    const rogData = metricsData.find(m => m.key === 'return_on_gross');
    
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
    
    // Fix Return on Gross quarterly/annual
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

    // Get recap values - same as UI
    const profitData = metricsData.find((m) => m.key === "department_profit");
    const nsgData = metricsData.find((m) => m.key === "net_selling_gross");
    
    const profitVariance = profitData?.annual.variance || 0;
    const profitVariancePercent = profitData?.annual.variancePercent || 0;
    
    // Check if crossing zero for percentage display
    const forecastProfit = profitData?.annual.value || 0;
    const baselineProfit = profitData?.annual.baseline || 0;
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
                            <span style="font-size: 18px; font-weight: bold; color: #1a1a1a; margin-left: 8px;">${formatCurrency(profitData?.annual.value || 0)}</span>
                            <span style="color: #666666; margin-left: 8px;">vs ${formatCurrency(profitData?.annual.baseline || 0)} prior</span>
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
        const grouped = new Map<
          string,
          { parentKey: string; name: string; subMetricKey: string; total: number }
        >();
        subMetricEntries.forEach((entry) => {
          const parts = entry.metric_name.split(":");
          if (parts.length >= 4) {
            const parentKey = parts[1];
            const orderIndex = parts[2]; // already zero-padded in storage
            const name = parts.slice(3).join(":");
            const subMetricKey = `sub:${parentKey}:${orderIndex}:${name}`;
            const key = `${parentKey}:${subMetricKey}`;

            if (!grouped.has(key)) {
              grouped.set(key, { parentKey, name, subMetricKey, total: 0 });
            }
            grouped.get(key)!.total += entry.value || 0;
          }
        });

        // Build sub-metric data with forecast values from overrides
        const subMetricData = Array.from(grouped.values()).map((g) => {
          const override = subMetricOverrides?.find(
            (o) => o.parent_metric_key === g.parentKey && o.sub_metric_key === g.subMetricKey
          );

          const baselineValue = g.total;
          const forecastValue = override ? override.overridden_annual_value : baselineValue * growthFactor;
          const variance = forecastValue - baselineValue;

          return {
            parentKey: g.parentKey,
            name: g.name,
            forecastValue,
            baselineValue,
            variance,
          };
        });


        if (subMetricData.length > 0) {
          // Group by parent key
          const groupedByParent = new Map<string, typeof subMetricData>();
          subMetricData.forEach((sm) => {
            if (!groupedByParent.has(sm.parentKey)) {
              groupedByParent.set(sm.parentKey, []);
            }
            groupedByParent.get(sm.parentKey)!.push(sm);
          });

          html += `<h2 style="color: #1a1a1a; font-size: 18px; margin: 24px 0 12px 0;">Sub-Metric Details</h2>`;
          
          groupedByParent.forEach((items, parentKey) => {
            const parentLabel = METRIC_DEFINITIONS.find((m) => m.key === parentKey)?.label || parentKey;
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
                  <td style="${styles.td} ${styles.annualCol}">${formatCurrency(item.forecastValue)}</td>
                  <td style="${styles.td} ${styles.varianceCol} ${varianceColor}">${formatVariance(item.variance, "currency")}</td>
                  <td style="${styles.td} ${styles.baselineCol}">${formatCurrency(item.baselineValue)}</td>
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
