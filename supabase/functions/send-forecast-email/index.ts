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

    // Fetch forecast entries (for locked values)
    const { data: forecastEntries } = await supabaseClient
      .from("forecast_entries")
      .select("*")
      .eq("forecast_id", forecast.id);

    console.log("Forecast data loaded - weights:", forecastWeights?.length || 0, "entries:", forecastEntries?.length || 0);

    // Fetch prior year financial data for baseline
    const { data: priorYearData } = await supabaseClient
      .from("financial_entries")
      .select("month, metric_name, value")
      .eq("department_id", departmentId)
      .gte("month", `${priorYear}-01`)
      .lte("month", `${priorYear}-12`)
      .not("metric_name", "like", "sub:%");

    console.log("Prior year data loaded:", priorYearData?.length || 0);

    // Build baseline data map
    const baselineByMonth = new Map<string, Map<string, number>>();
    priorYearData?.forEach((entry) => {
      if (!baselineByMonth.has(entry.month)) {
        baselineByMonth.set(entry.month, new Map());
      }
      const monthMap = baselineByMonth.get(entry.month)!;
      monthMap.set(entry.metric_name, (monthMap.get(entry.metric_name) || 0) + (entry.value || 0));
    });

    // Calculate annual baseline totals
    const annualBaseline: Record<string, number> = {};
    baselineByMonth.forEach((metrics) => {
      metrics.forEach((value, metricName) => {
        annualBaseline[metricName] = (annualBaseline[metricName] || 0) + value;
      });
    });

    // Build weights map
    const weightsMap = new Map<number, number>();
    forecastWeights?.forEach((w) => {
      weightsMap.set(w.month_number, w.adjusted_weight);
    });

    // Build entries map for locked values
    const entriesMap = new Map<string, { forecast_value: number; is_locked: boolean }>();
    forecastEntries?.forEach((e) => {
      entriesMap.set(`${e.month}:${e.metric_name}`, { 
        forecast_value: e.forecast_value || 0, 
        is_locked: e.is_locked 
      });
    });

    // Get driver values (or defaults from baseline)
    const growth = driverSettings?.growth_percent ?? 0;
    const savedSalesExpense = driverSettings?.sales_expense;
    const savedFixedExpense = driverSettings?.fixed_expense;
    
    const baseSalesExpense = annualBaseline['sales_expense'] || 0;
    const baseFixedExpense = annualBaseline['total_fixed_expense'] || 0;
    
    // Use saved values if available, otherwise scale baseline by growth
    const growthFactor = 1 + (growth / 100);
    const salesExpense = savedSalesExpense ?? (baseSalesExpense * growthFactor);
    const fixedExpense = savedFixedExpense ?? baseFixedExpense;

    console.log("Drivers:", { growth, salesExpense, fixedExpense, growthFactor });

    // Calculate annual forecast values using the same logic as the UI
    const baselineTotalSales = annualBaseline['total_sales'] || 0;
    const baselineGpNet = annualBaseline['gp_net'] || 0;
    const baselineGpPercent = baselineTotalSales > 0 ? (baselineGpNet / baselineTotalSales) * 100 : 0;
    const baselineSalesExpPercent = baselineGpNet > 0 ? (baseSalesExpense / baselineGpNet) * 100 : 0;
    const baselinePartsTransfer = annualBaseline['parts_transfer'] || 0;

    // Apply growth factor
    const annualTotalSales = baselineTotalSales * growthFactor;
    const annualGpNet = baselineGpNet * growthFactor;
    const gpPercent = baselineGpPercent;
    const annualSalesExp = salesExpense; // Use driver value directly, not scaled
    const annualSalesExpPercent = annualGpNet > 0 ? (annualSalesExp / annualGpNet) * 100 : 0;
    const annualNetSellingGross = annualGpNet - annualSalesExp;
    const annualDeptProfit = annualGpNet - annualSalesExp - fixedExpense;
    const annualPartsTransfer = baselinePartsTransfer;
    const annualNetOperatingProfit = annualDeptProfit + annualPartsTransfer;
    const annualReturnOnGross = annualGpNet > 0 ? (annualDeptProfit / annualGpNet) * 100 : 0;

    // Annual forecast values
    const annualForecastValues: Record<string, number> = {
      total_sales: annualTotalSales,
      gp_net: annualGpNet,
      gp_percent: gpPercent,
      sales_expense: annualSalesExp,
      sales_expense_percent: annualSalesExpPercent,
      net_selling_gross: annualNetSellingGross,
      total_fixed_expense: fixedExpense,
      department_profit: annualDeptProfit,
      parts_transfer: annualPartsTransfer,
      net_operating_profit: annualNetOperatingProfit,
      return_on_gross: annualReturnOnGross,
    };

    // Annual baseline values for comparison
    const baselineNetSellingGross = baselineGpNet - baseSalesExpense;
    const baselineDeptProfit = baselineGpNet - baseSalesExpense - baseFixedExpense;
    const baselineNetOperatingProfit = baselineDeptProfit + baselinePartsTransfer;
    const baselineReturnOnGross = baselineGpNet > 0 ? (baselineDeptProfit / baselineGpNet) * 100 : 0;

    const annualBaselineValues: Record<string, number> = {
      total_sales: baselineTotalSales,
      gp_net: baselineGpNet,
      gp_percent: baselineGpPercent,
      sales_expense: baseSalesExpense,
      sales_expense_percent: baselineSalesExpPercent,
      net_selling_gross: baselineNetSellingGross,
      total_fixed_expense: baseFixedExpense,
      department_profit: baselineDeptProfit,
      parts_transfer: baselinePartsTransfer,
      net_operating_profit: baselineNetOperatingProfit,
      return_on_gross: baselineReturnOnGross,
    };

    console.log("Calculated annual values:", {
      forecast: { deptProfit: annualDeptProfit, nsg: annualNetSellingGross },
      baseline: { deptProfit: baselineDeptProfit, nsg: baselineNetSellingGross }
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

        const useBaselineDirectly =
          growth === 0 &&
          Math.abs(salesExpense - baseSalesExpense) < 1 &&
          !hasAnyLockedDrivers;

        const getBaselineGpPctForScaling = () => {
          const monthPct = baselineMonthlyValues.gp_percent;
          return monthPct > 0 ? monthPct : baselineGpPercent;
        };

        const getCalculatedTotalSales = () => {
          if (lockedTotalSales?.is_locked) return lockedTotalSales.forecast_value;

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
          value = targetGpPercent;
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

    // Build HTML email
    const viewLabel = view === "monthly" ? "Monthly View" : view === "quarter" ? "Quarterly View" : "Annual View";

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
          .summary-title { font-size: 14px; color: #666; margin-bottom: 12px; }
          .summary-row { margin-bottom: 12px; }
          .summary-label { color: #666; font-size: 14px; }
          .summary-value { font-size: 18px; font-weight: bold; color: #1a1a1a; }
          .summary-variance { font-size: 14px; margin-top: 2px; }
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
          .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${deptData.stores.name} - ${deptData.name} Forecast</h1>
          <p class="subtitle"><strong>${forecastYear} Forecast</strong> • ${viewLabel} • vs ${priorYear} Baseline</p>
          
          <div class="summary-box">
            <div class="summary-title">Year Over Year Comparison</div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
              <!-- Net Selling Gross - Left -->
              <div>
                <div class="summary-row">
                  <span class="summary-label">Net Selling Gross:</span>
                  <span class="summary-value" style="margin-left: 8px;">${formatCurrency(nsgData?.annual.value || 0)}</span>
                  <span class="summary-label" style="margin-left: 8px;">vs ${formatCurrency(nsgData?.annual.baseline || 0)} prior</span>
                  <div class="summary-variance ${(nsgData?.annual.variance || 0) >= 0 ? "positive" : "negative"}">
                    ${formatVariance(nsgData?.annual.variance || 0, "currency")}${
                      nsgData && (nsgData.annual.value >= 0) === (nsgData.annual.baseline >= 0) && nsgData.annual.baseline !== 0 
                        ? ` (${nsgData.annual.variancePercent >= 0 ? "+" : ""}${nsgData.annual.variancePercent.toFixed(1)}%)` 
                        : ""
                    }
                  </div>
                  <div style="font-size: 12px; color: #666;">
                    ${(nsgData?.annual.variance || 0) >= 0 ? "+" : ""}${formatCurrency((nsgData?.annual.variance || 0) / 12)} per month variance
                  </div>
                </div>
              </div>
              
              <!-- Department Profit - Right -->
              <div>
                <div class="summary-row">
                  <span class="summary-label">Dept Profit:</span>
                  <span class="summary-value" style="margin-left: 8px;">${formatCurrency(profitData?.annual.value || 0)}</span>
                  <span class="summary-label" style="margin-left: 8px;">vs ${formatCurrency(profitData?.annual.baseline || 0)} prior</span>
                  <div class="summary-variance ${profitVariance >= 0 ? "positive" : "negative"}">
                    ${formatVariance(profitVariance, "currency")}${showProfitPercent ? ` (${profitVariancePercent >= 0 ? "+" : ""}${profitVariancePercent.toFixed(1)}%)` : ""}
                  </div>
                  <div style="font-size: 12px; color: #666;">
                    ${profitVariance >= 0 ? "+" : ""}${formatCurrency(profitVariance / 12)} per month variance
                  </div>
                </div>
              </div>
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
        const subMetricData = Array.from(grouped.values()).map((g) => {
          const override = subMetricOverrides?.find(
            (o) => o.sub_metric_key === g.name && o.parent_metric_key === g.parentKey
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
              const note = subMetricNotes?.find((n) => n.sub_metric_key === item.name);
              html += `
                <tr>
                  <td>${item.name}${note ? '<span style="display: inline-block; width: 8px; height: 8px; background-color: #f59e0b; border-radius: 2px; margin-left: 4px;"></span>' : ''}</td>
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
        if (subMetricNotes && subMetricNotes.length > 0) {
          html += `
            <div style="margin-top: 24px; padding: 16px; background-color: #fffbeb; border-radius: 8px; border: 1px solid #fcd34d;">
              <div style="font-weight: 600; color: #92400e; margin-bottom: 12px;">📋 Forecast Notes</div>
          `;
          
          subMetricNotes.forEach((note) => {
            html += `
              <div style="margin-bottom: 8px; font-size: 13px;">
                <span style="font-weight: 500; color: #92400e;">${note.sub_metric_key}:</span> ${note.note || ""}
              </div>
            `;
          });
          
          html += `</div>`;
        }
      }
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
