import { useMemo, useCallback } from 'react';
import type { ForecastEntry, ForecastWeight } from './useForecast';
import { getMetricsForBrand, type FinancialMetric } from '@/config/financialMetrics';

interface CalculationResult {
  month: string;
  metric_name: string;
  value: number;
  baseline_value: number;
  is_locked: boolean;
}

interface MetricDefinition {
  key: string;
  label: string;
  type: 'currency' | 'percent' | 'number';
  isDriver: boolean;
  isDerived: boolean;
  hasSubMetrics?: boolean;
  calculate?: (inputs: Record<string, number>) => number;
  reverseCalculate?: (value: number, inputs: Record<string, number>) => Partial<Record<string, number>>;
}

// Convert FinancialMetric to forecast MetricDefinition with proper calculations
function buildMetricDefinitions(brand: string | null): MetricDefinition[] {
  const financialMetrics = getMetricsForBrand(brand);
  
  // Build calculation functions based on the metric's calculation property
  const buildCalculateFn = (metric: FinancialMetric): ((inputs: Record<string, number>) => number) | undefined => {
    if (!metric.calculation) return undefined;
    
    const calc = metric.calculation;
    
    if ('numerator' in calc && 'denominator' in calc) {
      // Percentage calculation: numerator / denominator * 100
      return (i) => {
        const denominator = i[calc.denominator] || 0;
        return denominator > 0 ? (i[calc.numerator] / denominator) * 100 : 0;
      };
    }
    
    if ('type' in calc && calc.type === 'subtract') {
      // Subtraction: base - sum(deductions)
      return (i) => {
        const base = i[calc.base] || 0;
        const deductions = calc.deductions.reduce((sum, key) => sum + (i[key] || 0), 0);
        return base - deductions;
      };
    }
    
    if ('type' in calc && calc.type === 'complex') {
      // Complex: base - deductions + additions
      return (i) => {
        const base = i[calc.base] || 0;
        const deductions = calc.deductions.reduce((sum, key) => sum + (i[key] || 0), 0);
        const additions = calc.additions.reduce((sum, key) => sum + (i[key] || 0), 0);
        return base - deductions + additions;
      };
    }
    
    return undefined;
  };
  
  // Determine if metric is a driver (directly editable) vs derived (calculated)
  const isDriverMetric = (metric: FinancialMetric): boolean => {
    // Metrics with calculations are derived, not drivers
    if (metric.calculation) return false;
    // These are always drivers
    const driverKeys = ['total_sales', 'gp_percent', 'sales_expense', 'total_fixed_expense', 'total_direct_expenses'];
    return driverKeys.includes(metric.key);
  };
  
  return financialMetrics.map(metric => ({
    key: metric.key,
    label: metric.name,
    type: metric.type === 'percentage' ? 'percent' : 'currency',
    isDriver: isDriverMetric(metric),
    isDerived: !!metric.calculation,
    hasSubMetrics: metric.hasSubMetrics,
    calculate: buildCalculateFn(metric),
  }));
}

// Default metrics for backward compatibility (Ford-like structure)
const DEFAULT_METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'total_sales', label: 'Total Sales', type: 'currency', isDriver: true, isDerived: false },
  { key: 'gp_net', label: 'GP Net', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.total_sales * (i.gp_percent / 100),
  },
  { key: 'gp_percent', label: 'GP %', type: 'percent', isDriver: true, isDerived: false },
  { key: 'sales_expense', label: 'Sales Expense', type: 'currency', isDriver: true, isDerived: false },
  { key: 'sales_expense_percent', label: 'Sales Exp %', type: 'percent', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net > 0 ? (i.sales_expense / i.gp_net) * 100 : 0
  },
  { key: 'semi_fixed_expense', label: 'Semi Fixed Expense', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => (i.total_direct_expenses || 0) - (i.sales_expense || 0)
  },
  { key: 'semi_fixed_expense_percent', label: 'Semi Fixed Exp %', type: 'percent', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net > 0 ? ((i.semi_fixed_expense || 0) / i.gp_net) * 100 : 0
  },
  { key: 'net_selling_gross', label: 'Net Selling Gross', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense - (i.semi_fixed_expense || 0)
  },
  { key: 'total_fixed_expense', label: 'Fixed Expense', type: 'currency', isDriver: true, isDerived: false },
  { key: 'department_profit', label: 'Dept Profit', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense - (i.semi_fixed_expense || 0) - i.total_fixed_expense
  },
  { key: 'parts_transfer', label: 'Parts Transfer', type: 'currency', isDriver: false, isDerived: false },
  { key: 'net_operating_profit', label: 'Net Operating', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => (i.department_profit || 0) + (i.parts_transfer || 0)
  },
  { key: 'return_on_gross', label: 'Return on Gross', type: 'percent', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net > 0 ? (i.department_profit / i.gp_net) * 100 : 0
  },
];

interface SubMetricBaseline {
  parentKey: string;
  name: string;
  orderIndex: number; // Preserves statement order / disambiguates duplicates
  monthlyValues: Map<string, number>; // month -> value
}

interface SubMetricForecast {
  key: string;
  label: string;
  parentKey: string;
  monthlyValues: Map<string, number>; // forecast month -> calculated value
  quarterlyValues: Map<string, number>; // Q1, Q2, Q3, Q4 -> aggregated value
  annualValue: number;
  baselineAnnualValue: number; // prior year total
  isOverridden?: boolean; // true if user has manually edited this sub-metric
}

// Sub-metric override: stores user-defined annual value for a sub-metric
interface SubMetricOverride {
  subMetricKey: string;
  parentKey: string;
  overriddenAnnualValue: number;
}

interface UseForecastCalculationsProps {
  entries: ForecastEntry[];
  weights: ForecastWeight[];
  baselineData: Map<string, Map<string, number>>; // month -> metric -> value
  subMetricBaselines?: SubMetricBaseline[]; // sub-metric baseline data
  subMetricOverrides?: SubMetricOverride[]; // user overrides for sub-metrics
  forecastYear: number;
  growth: number; // Single growth % that scales both Total Sales and GP Net proportionally
  salesExpense: number; // Annual sales expense in dollars (fixed)
  fixedExpense: number;
  brand?: string | null; // Brand to determine metrics structure
}

export function useForecastCalculations({
  entries,
  weights,
  baselineData,
  subMetricBaselines,
  subMetricOverrides,
  forecastYear,
  growth,
  salesExpense,
  fixedExpense,
  brand,
}: UseForecastCalculationsProps) {
  
  // Build metric definitions based on brand
  const METRIC_DEFINITIONS = useMemo(() => {
    if (brand) {
      const brandMetrics = buildMetricDefinitions(brand);
      // If brand metrics are valid, use them; otherwise fall back to default
      if (brandMetrics.length > 0) {
        return brandMetrics;
      }
    }
    return DEFAULT_METRIC_DEFINITIONS;
  }, [brand]);
  
  // Get all months for the forecast year
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return `${forecastYear}-${String(month).padStart(2, '0')}`;
    });
  }, [forecastYear]);

  // Create entries map for quick lookup
  const entriesMap = useMemo(() => {
    console.log('[useForecastCalculations] Building entriesMap with', entries.length, 'entries');
    console.log('[useForecastCalculations] entries array identity:', entries);
    const map = new Map<string, ForecastEntry>();
    entries.forEach(e => {
      map.set(`${e.month}:${e.metric_name}`, e);
      if (e.metric_name === 'sales_expense_percent' && e.month === '2026-01') {
        console.log('[useForecastCalculations] entriesMap has 2026-01 sales_expense_percent:', e.forecast_value, 'locked:', e.is_locked);
      }
    });
    return map;
  }, [entries]);

  // Create weights map
  const weightsMap = useMemo(() => {
    const map = new Map<number, number>();
    weights.forEach(w => {
      map.set(w.month_number, w.adjusted_weight);
    });
    return map;
  }, [weights]);

  // Calculate annual baseline from prior year data, filling in missing main metrics from sub-metrics
  const annualBaseline = useMemo(() => {
    const totals: Record<string, number> = {};
    let sawPartsTransfer = false;

    // First, sum up main metrics from baselineData
    baselineData.forEach((metrics) => {
      metrics.forEach((value, metricName) => {
        if (metricName === 'parts_transfer') sawPartsTransfer = true;
        totals[metricName] = (totals[metricName] || 0) + value;
      });
    });

    // If main metrics are missing but sub-metrics exist, derive totals from sub-metrics.
    // This handles cases where only sub-metrics were imported (no parent totals stored).
    if (subMetricBaselines && subMetricBaselines.length > 0) {
      const subMetricTotalsByParent: Record<string, number> = {};
      
      for (const subMetric of subMetricBaselines) {
        // Sum all monthly values for this sub-metric
        let subMetricAnnualTotal = 0;
        subMetric.monthlyValues.forEach((value) => {
          subMetricAnnualTotal += value;
        });
        
        // Accumulate into parent metric total
        subMetricTotalsByParent[subMetric.parentKey] = 
          (subMetricTotalsByParent[subMetric.parentKey] || 0) + subMetricAnnualTotal;
      }
      
      // Fill in missing main metrics from sub-metric sums
      // Only override if the main metric is missing or zero
      for (const [parentKey, subTotal] of Object.entries(subMetricTotalsByParent)) {
        if (!totals[parentKey] || totals[parentKey] === 0) {
          totals[parentKey] = subTotal;
        }
      }
    }

    // Some brands don't store parts_transfer directly; derive it from adjusted_selling_gross when present.
    // Only do this when parts_transfer is truly missing (not when it's legitimately zero).
    if (!sawPartsTransfer && totals.adjusted_selling_gross !== undefined) {
      const derivedNetSellingGross =
        totals.net_selling_gross ??
        (totals.gp_net || 0) - (totals.sales_expense || 0) - (totals.semi_fixed_expense || 0);
      totals.parts_transfer = totals.adjusted_selling_gross - derivedNetSellingGross;
    }

    return totals;
  }, [baselineData, subMetricBaselines]);

  // Calculate forecasted values for each month and metric
  const calculateMonthlyValues = useCallback((): Map<string, Map<string, CalculationResult>> => {
    const results = new Map<string, Map<string, CalculationResult>>();
    
    // Calculate annual targets from drivers
    const baselineTotalSales = annualBaseline['total_sales'] || 0;
    const baselineGpNet = annualBaseline['gp_net'] || 0;
    const baselineSalesExpenseAnnual = annualBaseline['sales_expense'] || 0;
    const baselineGpPercent = baselineTotalSales > 0 ? (baselineGpNet / baselineTotalSales) * 100 : 0;
    const baselineSalesExpPercent = baselineGpNet > 0 ? (baselineSalesExpenseAnnual / baselineGpNet) * 100 : 0;
    
    // Growth factor scales Total Sales, GP Net, and Sales Expense proportionally
    // This keeps GP% and Sales Exp% constant
    const growthFactor = 1 + (growth / 100);
    
    // Annual forecasts - scale by growth factor to keep ratios constant
    const annualTotalSales = baselineTotalSales * growthFactor;
    const annualGpNet = baselineGpNet * growthFactor;
    const gpPercent = baselineGpPercent; // GP% stays constant
    
    const annualSalesExp = baselineSalesExpenseAnnual * growthFactor; // Scale baseline to keep Sales Exp % constant
    const annualSalesExpPercent = baselineSalesExpPercent; // Sales Exp % stays constant
    const annualPartsTransfer = annualBaseline['parts_transfer'] || 0;
    
    const annualValues: Record<string, number> = {
      total_sales: annualTotalSales,
      gp_net: annualGpNet,
      gp_percent: gpPercent,
      sales_expense: annualSalesExp,
      sales_expense_percent: annualSalesExpPercent,
      net_selling_gross: annualGpNet - annualSalesExp,
      total_fixed_expense: fixedExpense,
      department_profit: annualGpNet - annualSalesExp - fixedExpense,
      parts_transfer: annualPartsTransfer,
      net_operating_profit: (annualGpNet - annualSalesExp - fixedExpense) + annualPartsTransfer,
      // Also store as 'net' for GMC brand compatibility
      net: (annualGpNet - annualSalesExp - fixedExpense) + annualPartsTransfer,
      return_on_gross: annualGpNet > 0 ? ((annualGpNet - annualSalesExp - fixedExpense) / annualGpNet) * 100 : 0,
    };


    // Distribute to months using weights
    months.forEach((month, index) => {
      const monthNumber = index + 1;
      const weight = weightsMap.get(monthNumber) || (100 / 12);
      const weightFactor = weight / 100;
      
      const monthResults = new Map<string, CalculationResult>();
      
      // Map to prior year month for baseline lookup (e.g., 2026-01 -> 2025-01)
      const priorYearMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
      
      const baselineMonthData = baselineData.get(priorYearMonth);
      const hasStoredPartsTransfer = baselineMonthData?.has('parts_transfer') ?? false;

      // Calculate sub-metric sums for this month to fill in missing main metrics
      const subMetricSumsForMonth: Record<string, number> = {};
      if (subMetricBaselines && subMetricBaselines.length > 0) {
        for (const subMetric of subMetricBaselines) {
          const monthValue = subMetric.monthlyValues.get(priorYearMonth) ?? 0;
          subMetricSumsForMonth[subMetric.parentKey] = 
            (subMetricSumsForMonth[subMetric.parentKey] || 0) + monthValue;
        }
      }

      // Helper to get baseline value: prefer stored main metric, fall back to sub-metric sum
      const getBaselineValue = (metricKey: string): number => {
        const storedValue = baselineMonthData?.get(metricKey);
        if (storedValue !== undefined && storedValue !== null && storedValue !== 0) {
          return storedValue;
        }
        // Fall back to sub-metric sum if available
        return subMetricSumsForMonth[metricKey] ?? 0;
      };

      const baselineInputs = {
        total_sales: getBaselineValue('total_sales'),
        gp_net: getBaselineValue('gp_net'),
        sales_expense: getBaselineValue('sales_expense'),
        total_fixed_expense: getBaselineValue('total_fixed_expense'),
        adjusted_selling_gross: baselineMonthData?.get('adjusted_selling_gross') ?? 0,
        parts_transfer: baselineMonthData?.get('parts_transfer') ?? 0,
        total_direct_expenses: baselineMonthData?.get('total_direct_expenses') ?? 0,
        semi_fixed_expense: getBaselineValue('semi_fixed_expense'),
        dealer_salary: baselineMonthData?.get('dealer_salary') ?? 0,
      };

      // For Nissan: semi_fixed_expense = total_direct_expenses - sales_expense
      // For other brands: semi_fixed_expense is stored directly
      // Use !== 0 to handle negative semi_fixed_expense (e.g., when rebates exceed expenses)
      const baselineSemiFixed = baselineInputs.semi_fixed_expense !== 0 
        ? baselineInputs.semi_fixed_expense 
        : (baselineInputs.total_direct_expenses > 0 
            ? baselineInputs.total_direct_expenses - baselineInputs.sales_expense 
            : 0);

      // For Nissan: net_selling_gross = gp_net - total_direct_expenses
      // For other brands: net_selling_gross = gp_net - sales_expense - semi_fixed_expense
      const baselineNetSellingGross = baselineInputs.total_direct_expenses > 0
        ? baselineInputs.gp_net - baselineInputs.total_direct_expenses
        : baselineInputs.gp_net - baselineInputs.sales_expense - baselineSemiFixed;

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
        total_direct_expenses: baselineInputs.total_direct_expenses,
        semi_fixed_expense: baselineSemiFixed,
        semi_fixed_expense_percent: baselineInputs.gp_net > 0 ? (baselineSemiFixed / baselineInputs.gp_net) * 100 : 0,
        net_selling_gross: baselineNetSellingGross,
        total_fixed_expense: baselineInputs.total_fixed_expense,
        total_fixed_expense_percent: baselineInputs.gp_net > 0 ? (baselineInputs.total_fixed_expense / baselineInputs.gp_net) * 100 : 0,
        department_profit: baselineNetSellingGross - baselineInputs.total_fixed_expense,
        parts_transfer: derivedPartsTransfer,
        dealer_salary: baselineInputs.dealer_salary,
        net_operating_profit:
          (baselineNetSellingGross - baselineInputs.total_fixed_expense) + derivedPartsTransfer - baselineInputs.dealer_salary,
        // Also store as 'net' for GMC brand compatibility (GMC uses 'net' as the key)
        net:
          (baselineNetSellingGross - baselineInputs.total_fixed_expense) + derivedPartsTransfer - baselineInputs.dealer_salary,
        return_on_gross:
          baselineInputs.gp_net > 0
            ? ((baselineNetSellingGross - baselineInputs.total_fixed_expense) / baselineInputs.gp_net) * 100
            : 0,
      };

      // Pre-fetch locked values for this month so derived metrics can use them
      const lockedValues: Record<string, number | null> = {};
      METRIC_DEFINITIONS.forEach(metric => {
        const entryKey = `${month}:${metric.key}`;
        const existingEntry = entriesMap.get(entryKey);
        if (existingEntry?.is_locked && existingEntry?.forecast_value !== null) {
          lockedValues[metric.key] = existingEntry.forecast_value;
        }
      });

      // Also check for STORED values (not necessarily locked) for key metrics
      // This allows annual edits without auto-lock to still be respected
      const hasStoredSalesExpensePercent = (() => {
        const entry = entriesMap.get(`${month}:sales_expense_percent`);
        return entry?.forecast_value !== null && entry?.forecast_value !== undefined;
      })();

      // Calculate baseline comparison values for useBaselineDirectly check
      const baselineSalesExpenseCalc = annualBaseline['sales_expense'] || 0;
      
      // Use baseline directly when no changes to avoid rounding differences
      // But NOT if any driver metrics are locked OR if sales_expense_percent has stored values
      const hasAnyLockedDrivers = lockedValues['gp_percent'] !== undefined || 
        lockedValues['total_sales'] !== undefined || 
        lockedValues['gp_net'] !== undefined ||
        lockedValues['sales_expense'] !== undefined ||
        lockedValues['sales_expense_percent'] !== undefined;
      const hasStoredDriverValues = hasStoredSalesExpensePercent;
      const useBaselineDirectly = growth === 0 
        && Math.abs(salesExpense - baselineSalesExpenseCalc) < 1 // Within $1
        && !hasAnyLockedDrivers
        && !hasStoredDriverValues;

      // For stores without sub-metrics: when GP% is locked (user changed it),
      // we need to scale BOTH Total Sales and GP Net together.
      // The new GP% implies a different margin, so we calculate what GP Net would be
      // if we kept Total Sales at the growth-scaled value AND applied the new GP%.
      
      // Check if we have sub-metrics for this department
      const hasSubMetrics = (subMetricBaselines?.length ?? 0) > 0;
      
      // Calculate the "target" GP% - either locked or baseline
      const lockedGpPercent = lockedValues['gp_percent'];
      const targetGpPercent = lockedGpPercent ?? baselineMonthlyValues.gp_percent;
      
      // For stores WITHOUT sub-metrics and with locked GP%:
      // When GP% is changed, we want to increase BOTH Total Sales and GP Net proportionally.
      // This means the user is effectively saying "I want higher margin", which implies more profit.
      // We achieve this by keeping the growth-driven Total Sales and scaling GP Net to match the new GP%.
      
      // Helper functions for stores without sub-metrics when GP% is manually edited (locked)
      // We want BOTH Total Sales and GP Net to move together so the GP% change implies
      // a consistent new volume+profit level.
      //
      // Strategy:
      // - If Total Sales / GP Net are explicitly locked, respect those.
      // - Otherwise, if GP% is locked and there are NO sub-metrics:
      //   1) Scale GP Net by the ratio (new GP%) / (baseline GP%)
      //   2) Back-calculate Total Sales from GP Net and the new GP%
      //
      // This ensures changing GP% affects both Total Sales and GP Net (KTRV behavior).

      const getBaselineGpPctForScaling = (): number => {
        // Prefer the month-specific baseline margin; fall back to annual baseline margin.
        // (Some stores/months can have missing/0 values)
        const monthPct = baselineMonthlyValues.gp_percent;
        return monthPct > 0 ? monthPct : baselineGpPercent;
      };

      // For stores without sub-metrics: when GP% is locked we interpret it as an ELR/pricing change.
      // - If GP% is increased vs baseline: Total Sales increases proportionally (same hours, higher rate).
      // - GP Net is then derived from Total Sales * locked GP% (so both move up).
      // - If GP% is decreased: we do NOT force sales down; only margin (GP Net) changes.
      // Total Sales is distributed using weights - this is the core driver
      const getCalculatedTotalSales = (): number => {
        const lockedTotalSales = lockedValues['total_sales'];
        if (lockedTotalSales !== undefined && lockedTotalSales !== null) {
          return lockedTotalSales;
        }

        if (!hasSubMetrics && lockedGpPercent !== undefined && lockedGpPercent !== null) {
          const basePct = getBaselineGpPctForScaling();
          // Only scale sales UP when GP% increases (ELR lift assumption).
          if (basePct > 0 && lockedGpPercent > basePct) {
            const ratio = lockedGpPercent / basePct;
            // Apply weight distribution AND GP% scaling
            return annualValues['total_sales'] * weightFactor * ratio;
          }
        }

        // Apply weight distribution to annual total
        return annualValues['total_sales'] * weightFactor;
      };

      // GP Net is derived from weight-distributed Total Sales × GP%
      const getCalculatedGpNet = (): number => {
        const lockedGpNet = lockedValues['gp_net'];
        if (lockedGpNet !== undefined && lockedGpNet !== null) {
          return lockedGpNet;
        }

        // GP Net = Total Sales × GP% (user-controlled via targetGpPercent)
        const totalSales = getCalculatedTotalSales();
        return totalSales * (targetGpPercent / 100);
      };

      // Sales expense should stay at the same % of GP Net unless explicitly locked or stored.
      // This ensures Net Selling Gross responds correctly when GP% / GP Net changes.
      const getCalculatedSalesExpense = (): number => {
        const lockedSalesExp = lockedValues['sales_expense'];
        if (lockedSalesExp !== undefined && lockedSalesExp !== null) {
          return lockedSalesExp;
        }

        // Check for stored (non-locked) sales_expense value - this handles the case where
        // user edited annual sales_expense_percent and we calculated monthly dollar amounts
        const salesExpEntry = entriesMap.get(`${month}:sales_expense`);
        if (salesExpEntry?.forecast_value !== null && salesExpEntry?.forecast_value !== undefined && !useBaselineDirectly) {
          return salesExpEntry.forecast_value;
        }

        const basePct = baselineMonthlyValues.sales_expense_percent;
        const gpNet = getCalculatedGpNet();
        return gpNet > 0 ? gpNet * (basePct / 100) : 0;
      };

      // Sales expense percent - check for stored value from annual edit
      const getCalculatedSalesExpensePercent = (): number => {
        const salesExpPctEntry = entriesMap.get(`${month}:sales_expense_percent`);
        console.log('[getCalculatedSalesExpensePercent]', month, 'entry:', salesExpPctEntry ? {
          value: salesExpPctEntry.forecast_value,
          locked: salesExpPctEntry.is_locked
        } : 'NOT FOUND');
        console.log('[getCalculatedSalesExpensePercent]', month, 'useBaselineDirectly:', useBaselineDirectly);
        const hasStoredValue = salesExpPctEntry?.forecast_value !== null && salesExpPctEntry?.forecast_value !== undefined;
        
        // CRITICAL: Stored values from annual edits should ALWAYS take precedence
        if (hasStoredValue) {
          return salesExpPctEntry.forecast_value;
        }
        console.log('[getCalculatedSalesExpensePercent]', month, 'using baseline:', baselineMonthlyValues.sales_expense_percent);
        return baselineMonthlyValues.sales_expense_percent;
      };

      // First pass: calculate all driver/base metrics
      const calculatedValues: Record<string, number> = {};
      
      // Always calculate these base values first
      calculatedValues['total_sales'] = getCalculatedTotalSales();
      calculatedValues['gp_net'] = getCalculatedGpNet();
      calculatedValues['gp_percent'] = targetGpPercent;
      calculatedValues['sales_expense'] = getCalculatedSalesExpense();
      calculatedValues['sales_expense_percent'] = getCalculatedSalesExpensePercent();
      calculatedValues['total_fixed_expense'] = baselineMonthData?.get('total_fixed_expense') ?? baselineMonthlyValues.total_fixed_expense ?? 0;
      calculatedValues['parts_transfer'] = baselineMonthData?.get('parts_transfer') ?? baselineMonthlyValues.parts_transfer ?? 0;
      calculatedValues['adjusted_selling_gross'] = baselineMonthData?.get('adjusted_selling_gross') ?? 0;
      calculatedValues['dealer_salary'] = baselineMonthData?.get('dealer_salary') ?? 0;
      // For Nissan: total_direct_expenses is a driver, scale it by growth
      calculatedValues['total_direct_expenses'] = (baselineMonthlyValues.total_direct_expenses ?? 0) * growthFactor;
      // Pre-calculate semi_fixed_expense for Nissan (total_direct_expenses - sales_expense)
      // For other brands, this will be recalculated or use baseline
      // Use !== 0 to handle negative semi_fixed_expense (e.g., when rebates exceed expenses)
      calculatedValues['semi_fixed_expense'] = baselineMonthlyValues.semi_fixed_expense !== 0 
        ? baselineMonthlyValues.semi_fixed_expense * growthFactor
        : calculatedValues['total_direct_expenses'] - calculatedValues['sales_expense'];
      
      METRIC_DEFINITIONS.forEach(metric => {
        const entryKey = `${month}:${metric.key}`;
        const existingEntry = entriesMap.get(entryKey);
        
        // Check if this entry is locked
        const isLocked = existingEntry?.is_locked ?? false;

        // Prefer exact stored baseline metric when it exists (e.g., total_fixed_expense), otherwise use computed baseline
        const baselineValue =
          baselineMonthData?.get(metric.key) ??
          baselineMonthlyValues[metric.key] ??
          0;

        let value: number;

        // Priority: locked entries > stored forecast values > baseline/calculated
        // This ensures user-entered values persist even if not locked
        const hasStoredForecastValue = existingEntry?.forecast_value !== null && existingEntry?.forecast_value !== undefined;

        // Debug log for sales_expense_percent to trace the value assignment
        if (metric.key === 'sales_expense_percent' && month === '2026-01') {
          console.log('[useForecastCalculations] METRIC LOOP sales_expense_percent 2026-01:', {
            entryKey,
            existingEntry: existingEntry ? { forecast_value: existingEntry.forecast_value, is_locked: existingEntry.is_locked } : 'NOT FOUND',
            isLocked,
            hasStoredForecastValue,
            useBaselineDirectly,
          });
        }

        if (isLocked && hasStoredForecastValue) {
          // Use locked value - highest priority
          if (metric.key === 'sales_expense_percent' && month === '2026-01') {
            console.log('[useForecastCalculations] sales_expense_percent 2026-01 USING LOCKED VALUE:', existingEntry.forecast_value);
          }
          value = existingEntry.forecast_value;
        } else if (hasStoredForecastValue) {
          // Use stored forecast value even if not locked (highest priority after locked values)
          // This is critical for metrics like sales_expense_percent that were edited via annual cell
          if (metric.key === 'sales_expense_percent' && month === '2026-01') {
            console.log('[useForecastCalculations] sales_expense_percent 2026-01 USING STORED VALUE:', existingEntry.forecast_value);
          }
          value = existingEntry.forecast_value;
        } else if (useBaselineDirectly) {
          // At baseline settings - use baseline value for ALL metrics to avoid rounding differences
          value = baselineValue;
        } else if (calculatedValues[metric.key] !== undefined && !metric.isDerived) {
          // Use pre-calculated driver value
          value = calculatedValues[metric.key];
        } else if (metric.calculate) {
          // Use brand-specific calculation from metric definition
          // BUT only if there's no stored value (checked above)
          if (metric.key === 'sales_expense_percent' && month === '2026-01') {
            console.log('[useForecastCalculations] sales_expense_percent 2026-01 RECALCULATING (should not happen if locked!):', metric.calculate(calculatedValues));
          }
          value = metric.calculate(calculatedValues);
        } else if (calculatedValues[metric.key] !== undefined) {
          // Fallback to pre-calculated value if available
          value = calculatedValues[metric.key];
        } else {
          // Default: scale by growth factor
          value = baselineValue * growthFactor;
        }
        
        // Store calculated value for dependent metrics
        calculatedValues[metric.key] = value;
        
        monthResults.set(metric.key, {
          month,
          metric_name: metric.key,
          value,
          baseline_value: baselineValue,
          is_locked: isLocked,
        });
      });
      
      results.set(month, monthResults);
    });
    
    return results;
  }, [months, weightsMap, entriesMap, baselineData, annualBaseline, growth, salesExpense, fixedExpense, subMetricBaselines, forecastYear, METRIC_DEFINITIONS]);

  // Get quarterly totals
  const calculateQuarterlyValues = useCallback((monthlyValues: Map<string, Map<string, CalculationResult>>) => {
    const quarters: Record<string, Map<string, CalculationResult>> = {
      Q1: new Map(),
      Q2: new Map(),
      Q3: new Map(),
      Q4: new Map(),
    };
    
    const quarterMonths = {
      Q1: [0, 1, 2],
      Q2: [3, 4, 5],
      Q3: [6, 7, 8],
      Q4: [9, 10, 11],
    };
    
    Object.entries(quarterMonths).forEach(([quarter, monthIndices]) => {
      METRIC_DEFINITIONS.forEach(metric => {
        let totalValue = 0;
        let totalBaseline = 0;
        let anyLocked = false;
        
        monthIndices.forEach(i => {
          const month = months[i];
          const monthData = monthlyValues.get(month);
          const metricData = monthData?.get(metric.key);
          
          if (metricData) {
            if (metric.type === 'percent') {
              // Average percentages
              totalValue += metricData.value;
              totalBaseline += metricData.baseline_value;
            } else {
              // Sum currency/number values
              totalValue += metricData.value;
              totalBaseline += metricData.baseline_value;
            }
            if (metricData.is_locked) anyLocked = true;
          }
        });
        
        // For percentages, average instead of sum
        if (metric.type === 'percent') {
          totalValue = totalValue / 3;
          totalBaseline = totalBaseline / 3;
        }
        
        quarters[quarter].set(metric.key, {
          month: quarter,
          metric_name: metric.key,
          value: totalValue,
          baseline_value: totalBaseline,
          is_locked: anyLocked,
        });
      });
    });
    
    return quarters;
  }, [months, METRIC_DEFINITIONS]);

  // Get annual totals
  const calculateAnnualValues = useCallback((monthlyValues: Map<string, Map<string, CalculationResult>>) => {
    const annualResults = new Map<string, CalculationResult>();
    
    // First, sum all currency values to calculate derived percentages correctly
    // Also track ALL stored values (not just locked) to detect uniform percentages
    const totals: Record<string, { value: number; baseline: number; locked: boolean; allLocked: boolean; lockedValues: number[]; storedValues: number[] }> = {};
    
    METRIC_DEFINITIONS.forEach(metric => {
      totals[metric.key] = { value: 0, baseline: 0, locked: false, allLocked: true, lockedValues: [], storedValues: [] };
    });
    
    months.forEach(month => {
      const monthData = monthlyValues.get(month);
      METRIC_DEFINITIONS.forEach(metric => {
        const metricData = monthData?.get(metric.key);
        if (metricData) {
          totals[metric.key].value += metricData.value;
          totals[metric.key].baseline += metricData.baseline_value;
          
          // For storedValues: use the user-entered forecast value if it exists, not the calculated one
          // This ensures that if a user enters 65% for all months, we detect it as uniform
          const storedEntry = entriesMap.get(`${month}:${metric.key}`);
          const storedForecastValue = storedEntry?.forecast_value;
          totals[metric.key].storedValues.push(storedForecastValue != null ? storedForecastValue : metricData.value);
          
          if (metricData.is_locked) {
            totals[metric.key].locked = true;
            totals[metric.key].lockedValues.push(storedForecastValue != null ? storedForecastValue : metricData.value);
          } else {
            totals[metric.key].allLocked = false;
          }
        }
      });
    });
    
    // Now calculate proper values - percentages should be calculated from totals, not averaged
    // Exception: if a percentage metric has ALL months set to the same value (locked OR stored), use that value for the forecast
    METRIC_DEFINITIONS.forEach(metric => {
      let finalValue = totals[metric.key].value;
      let finalBaseline = totals[metric.key].baseline;
      
      // For percentage metrics, check if all months are set to the same value (locked OR stored)
      const isPercentMetric = metric.type === 'percent';
      const allMonthsLocked = totals[metric.key].allLocked && totals[metric.key].lockedValues.length === 12;
      const allLockedSameValue = allMonthsLocked && 
        totals[metric.key].lockedValues.every((v, _, arr) => Math.abs(v - arr[0]) < 0.01);
      
      // Also check if all stored values (locked or not) are the same for percentage metrics
      const storedValues = totals[metric.key].storedValues;
      const allStoredSameValue = isPercentMetric && storedValues.length === 12 &&
        storedValues.every((v, _, arr) => Math.abs(v - arr[0]) < 0.01);
      
      // Use stored value if all months have the same percentage value (either locked or just stored)
      const allSameValue = allLockedSameValue || allStoredSameValue;
      const uniformValue = allLockedSameValue 
        ? totals[metric.key].lockedValues[0] 
        : (allStoredSameValue ? storedValues[0] : null);
      
      // Always recalculate percentage baselines from currency totals
      if (metric.key === 'gp_percent') {
        // GP% = GP Net / Total Sales * 100
        const gpNet = totals['gp_net']?.value ?? 0;
        const totalSales = totals['total_sales']?.value ?? 0;
        
        // For forecast value: use uniform stored value if all months same, otherwise calculate
        if (isPercentMetric && allSameValue && uniformValue !== null) {
          finalValue = uniformValue;
        } else {
          finalValue = totalSales > 0 ? (gpNet / totalSales) * 100 : 0;
        }
        
        // Baseline is always calculated from actual prior year data
        const baselineGpNet = totals['gp_net']?.baseline ?? 0;
        const baselineSales = totals['total_sales']?.baseline ?? 0;
        finalBaseline = baselineSales > 0 ? (baselineGpNet / baselineSales) * 100 : 0;
      } else if (metric.key === 'sales_expense_percent') {
        // Sales Exp % = Sales Expense / GP Net * 100
        const salesExp = totals['sales_expense']?.value ?? 0;
        const gpNet = totals['gp_net']?.value ?? 0;
        
        if (isPercentMetric && allSameValue && uniformValue !== null) {
          finalValue = uniformValue;
        } else {
          finalValue = gpNet > 0 ? (salesExp / gpNet) * 100 : 0;
        }
        
        const baselineSalesExp = totals['sales_expense']?.baseline ?? 0;
        const baselineGpNet = totals['gp_net']?.baseline ?? 0;
        finalBaseline = baselineGpNet > 0 ? (baselineSalesExp / baselineGpNet) * 100 : 0;
      } else if (metric.key === 'semi_fixed_expense_percent') {
        // Semi Fixed Exp % = Semi Fixed Expense / GP Net * 100
        const semiFixed = totals['semi_fixed_expense']?.value ?? 0;
        const gpNet = totals['gp_net']?.value ?? 0;
        
        if (isPercentMetric && allSameValue && uniformValue !== null) {
          finalValue = uniformValue;
        } else {
          finalValue = gpNet > 0 ? (semiFixed / gpNet) * 100 : 0;
        }
        
        const baselineSemiFixed = totals['semi_fixed_expense']?.baseline ?? 0;
        const baselineGpNet = totals['gp_net']?.baseline ?? 0;
        finalBaseline = baselineGpNet > 0 ? (baselineSemiFixed / baselineGpNet) * 100 : 0;
      } else if (metric.key === 'return_on_gross') {
        // Return on Gross = Dept Profit / GP Net * 100
        const deptProfit = totals['department_profit']?.value ?? 0;
        const gpNet = totals['gp_net']?.value ?? 0;
        
        if (isPercentMetric && allSameValue && uniformValue !== null) {
          finalValue = uniformValue;
        } else {
          finalValue = gpNet > 0 ? (deptProfit / gpNet) * 100 : 0;
        }
        
        const baselineDeptProfit = totals['department_profit']?.baseline ?? 0;
        const baselineGpNet = totals['gp_net']?.baseline ?? 0;
        finalBaseline = baselineGpNet > 0 ? (baselineDeptProfit / baselineGpNet) * 100 : 0;
      }
      
      annualResults.set(metric.key, {
        month: 'annual',
        metric_name: metric.key,
        value: finalValue,
        baseline_value: finalBaseline,
        is_locked: totals[metric.key].locked,
      });
    });
    
    return annualResults;
  }, [months, METRIC_DEFINITIONS, entriesMap]);

  // Distribute quarter edit to months using weights
  const distributeQuarterToMonths = useCallback((
    quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4',
    metricName: string,
    newValue: number
  ): { month: string; value: number }[] => {
    const quarterMonthIndices = {
      Q1: [0, 1, 2],
      Q2: [3, 4, 5],
      Q3: [6, 7, 8],
      Q4: [9, 10, 11],
    };
    
    const monthIndices = quarterMonthIndices[quarter];
    const quarterMonths = monthIndices.map(i => months[i]);
    
    // Get weights for these months
    const monthWeights = quarterMonths.map((month, i) => {
      const monthNumber = monthIndices[i] + 1;
      return weightsMap.get(monthNumber) || (100 / 12);
    });
    
    // Normalize weights within the quarter
    const totalWeight = monthWeights.reduce((a, b) => a + b, 0);
    
    return quarterMonths.map((month, i) => ({
      month,
      value: (monthWeights[i] / totalWeight) * newValue,
    }));
  }, [months, weightsMap]);

  // Calculate sub-metric forecasts by scaling based on parent metric changes
  // With linked calculations: GP Net = Sales × GP%
  const calculateSubMetricForecasts = useCallback((
    monthlyVals: Map<string, Map<string, CalculationResult>>
  ): Map<string, SubMetricForecast[]> => {
    const result = new Map<string, SubMetricForecast[]>();
    
    // Debug logging removed to reduce console noise
    
    if (!subMetricBaselines || subMetricBaselines.length === 0) {
      return result;
    }
    
    // Build override lookup map
    const overrideMap = new Map<string, number>();
    subMetricOverrides?.forEach(o => {
      overrideMap.set(o.subMetricKey, o.overriddenAnnualValue);
    });
    
    
    // Identify which parent metrics are percentages
    const percentageParents = new Set(
      METRIC_DEFINITIONS.filter(m => m.type === 'percent').map(m => m.key)
    );
    
    // Group sub-metrics by parent
    const byParent = new Map<string, SubMetricBaseline[]>();
    subMetricBaselines.forEach(sub => {
      if (!byParent.has(sub.parentKey)) {
        byParent.set(sub.parentKey, []);
      }
      byParent.get(sub.parentKey)!.push(sub);
    });

    // Synthesize sales_expense_percent sub-metrics if missing but sales_expense exists
    // This handles GMC/Nissan stores that only import dollar sub-metrics
    const hasSalesExpenseSubs = byParent.has('sales_expense') && (byParent.get('sales_expense')?.length ?? 0) > 0;
    const hasSalesExpensePercentSubs = byParent.has('sales_expense_percent') && (byParent.get('sales_expense_percent')?.length ?? 0) > 0;

    if (hasSalesExpenseSubs && !hasSalesExpensePercentSubs) {
      const salesExpenseSubs = byParent.get('sales_expense')!;
      const synthesizedPercentSubs: SubMetricBaseline[] = [];
      
      // Build monthly GP Net from sub-metrics if baselineData doesn't have it directly
      // This handles stores that only import sub-metric data (no parent totals)
      const gpNetMonthlyFromSubs = new Map<string, number>();
      const gpNetSubs = byParent.get('gp_net') || [];
      for (const gpSub of gpNetSubs) {
        gpSub.monthlyValues.forEach((value, month) => {
          gpNetMonthlyFromSubs.set(month, (gpNetMonthlyFromSubs.get(month) ?? 0) + value);
        });
      }
      
      for (const salesExpSub of salesExpenseSubs) {
        // Create a matching percentage sub-metric
        const percentSub: SubMetricBaseline = {
          parentKey: 'sales_expense_percent',
          name: salesExpSub.name,
          orderIndex: salesExpSub.orderIndex,
          monthlyValues: new Map(),
        };
        
        // Calculate percentage for each month: (Sales Exp $ / GP Net) × 100
        // First try baselineData, fallback to calculated from sub-metrics
        salesExpSub.monthlyValues.forEach((salesExpValue, month) => {
          const gpNetForMonth = baselineData.get(month)?.get('gp_net') ?? gpNetMonthlyFromSubs.get(month) ?? 0;
          const percentValue = gpNetForMonth > 0 
            ? (salesExpValue / gpNetForMonth) * 100 
            : 0;
          percentSub.monthlyValues.set(month, percentValue);
        });
        
        synthesizedPercentSubs.push(percentSub);
      }
      
      byParent.set('sales_expense_percent', synthesizedPercentSubs);
      console.log('[calculateSubMetricForecasts] Synthesized', synthesizedPercentSubs.length, 'sales_expense_percent sub-metrics from sales_expense');
    }

    // Synthesize semi_fixed_expense_percent sub-metrics if missing but semi_fixed_expense exists
    // This handles GMC/Nissan stores that only import dollar sub-metrics
    const hasSemiFixedExpenseSubs = byParent.has('semi_fixed_expense') && (byParent.get('semi_fixed_expense')?.length ?? 0) > 0;
    const hasSemiFixedExpensePercentSubs = byParent.has('semi_fixed_expense_percent') && (byParent.get('semi_fixed_expense_percent')?.length ?? 0) > 0;

    if (hasSemiFixedExpenseSubs && !hasSemiFixedExpensePercentSubs) {
      const semiFixedExpenseSubs = byParent.get('semi_fixed_expense')!;
      const synthesizedSemiFixedPercentSubs: SubMetricBaseline[] = [];
      
      // Build monthly GP Net from sub-metrics if baselineData doesn't have it directly
      // This handles stores that only import sub-metric data (no parent totals)
      const gpNetMonthlyFromSubs = new Map<string, number>();
      const gpNetSubs = byParent.get('gp_net') || [];
      for (const gpSub of gpNetSubs) {
        gpSub.monthlyValues.forEach((value, month) => {
          gpNetMonthlyFromSubs.set(month, (gpNetMonthlyFromSubs.get(month) ?? 0) + value);
        });
      }
      
      for (const semiFixedExpSub of semiFixedExpenseSubs) {
        // Create a matching percentage sub-metric
        const percentSub: SubMetricBaseline = {
          parentKey: 'semi_fixed_expense_percent',
          name: semiFixedExpSub.name,
          orderIndex: semiFixedExpSub.orderIndex,
          monthlyValues: new Map(),
        };
        
        // Calculate percentage for each month: (Semi Fixed Exp $ / GP Net) × 100
        // First try baselineData, fallback to calculated from sub-metrics
        semiFixedExpSub.monthlyValues.forEach((semiFixedExpValue, month) => {
          const gpNetForMonth = baselineData.get(month)?.get('gp_net') ?? gpNetMonthlyFromSubs.get(month) ?? 0;
          const percentValue = gpNetForMonth > 0 
            ? (semiFixedExpValue / gpNetForMonth) * 100 
            : 0;
          percentSub.monthlyValues.set(month, percentValue);
        });
        
        synthesizedSemiFixedPercentSubs.push(percentSub);
      }
      
      byParent.set('semi_fixed_expense_percent', synthesizedSemiFixedPercentSubs);
      console.log('[calculateSubMetricForecasts] Synthesized', synthesizedSemiFixedPercentSubs.length, 'semi_fixed_expense_percent sub-metrics from semi_fixed_expense');
    }

    // Normalize names for reliable cross-parent matching (handles casing/whitespace differences)
    const normalizeName = (name: string) => name.trim().toLowerCase();

    // Helper to calculate a single sub-metric forecast
    const calculateSingleSubMetric = (
      sub: SubMetricBaseline,
      parentKey: string,
      index: number,
      isPercentageParent: boolean,
      overrideValue?: number
    ): SubMetricForecast => {
      const orderIndex = sub.orderIndex ?? index;
      const subMetricKey = `sub:${parentKey}:${String(orderIndex).padStart(3, '0')}:${sub.name}`;
      const isOverridden = overrideValue !== undefined || overrideMap.has(subMetricKey);
      const overriddenAnnual = overrideValue ?? overrideMap.get(subMetricKey);

      
      const forecastMonthlyValues = new Map<string, number>();
      let annualValue = 0;
      let baselineAnnualValue = 0;
      
      // First pass: calculate baseline annual value from prior year data
      let baselineMonthCount = 0;
      months.forEach((forecastMonth, monthIndex) => {
        const monthNumber = monthIndex + 1;
        const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
        const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
        
        // For percentage sub-metrics: recalculate from underlying values instead of using stored values
        // This ensures we always use actual financial data, not previously forecasted percentage values
        if (isPercentageParent) {
          if (parentKey === 'gp_percent') {
            // GP% = GP Net / Sales * 100
            const salesSub = subMetricBaselines.find(
              (s) => s.parentKey === 'total_sales' && normalizeName(s.name) === normalizeName(sub.name)
            );
            const gpNetSub = subMetricBaselines.find(
              (s) => s.parentKey === 'gp_net' && normalizeName(s.name) === normalizeName(sub.name)
            );
            
            if (salesSub && gpNetSub) {
              const salesValue = salesSub.monthlyValues.get(priorMonth) ?? 0;
              const gpNetValue = gpNetSub.monthlyValues.get(priorMonth) ?? 0;
              const calculatedGpPercent = salesValue > 0 ? (gpNetValue / salesValue) * 100 : 0;
              baselineAnnualValue += calculatedGpPercent;
            } else {
              baselineAnnualValue += subBaseline;
            }
          } else if (parentKey === 'sales_expense_percent') {
            // Sales Exp% = Sales Expense / GP Net * 100
            const salesExpSub = subMetricBaselines.find(
              (s) => s.parentKey === 'sales_expense' && normalizeName(s.name) === normalizeName(sub.name)
            );
            const gpNetSub = subMetricBaselines.find(
              (s) => s.parentKey === 'gp_net' && normalizeName(s.name) === normalizeName(sub.name)
            );
            
            if (salesExpSub && gpNetSub) {
              const salesExpValue = salesExpSub.monthlyValues.get(priorMonth) ?? 0;
              const gpNetValue = gpNetSub.monthlyValues.get(priorMonth) ?? 0;
              const calculatedSalesExpPercent = gpNetValue > 0 ? (salesExpValue / gpNetValue) * 100 : 0;
              baselineAnnualValue += calculatedSalesExpPercent;
            } else {
              baselineAnnualValue += subBaseline;
            }
          } else {
            // Other percentage parents - use stored value
            baselineAnnualValue += subBaseline;
          }
        } else {
          baselineAnnualValue += subBaseline;
        }
        
        if (sub.monthlyValues.has(priorMonth)) {
          baselineMonthCount++;
        }
      });
      
      // If overridden, distribute override annual value across months
      if (isOverridden && overriddenAnnual !== undefined) {
        if (isPercentageParent) {
          // For percentage sub-metrics, each month gets the same percentage value
          months.forEach((forecastMonth) => {
            forecastMonthlyValues.set(forecastMonth, overriddenAnnual);
            annualValue += overriddenAnnual;
          });
        } else {
          // For currency sub-metrics, distribute proportionally based on baseline pattern
          let totalBaselineWeight = 0;
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            totalBaselineWeight += sub.monthlyValues.get(priorMonth) ?? 0;
          });
          
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            
            let forecastValue: number;
            if (totalBaselineWeight > 0) {
              forecastValue = (subBaseline / totalBaselineWeight) * overriddenAnnual;
            } else {
              forecastValue = overriddenAnnual / 12;
            }
            
            forecastMonthlyValues.set(forecastMonth, forecastValue);
            annualValue += forecastValue;
          });
        }
      } else {
        // Standard calculation (no override)
        months.forEach((forecastMonth, monthIndex) => {
          const monthNumber = monthIndex + 1;
          const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
          const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
          
          let forecastValue: number;
          
          if (isPercentageParent) {
            // For percentage parents, scale sub-metrics proportionally when parent changes
            // This ensures that editing parent Sales Expense % scales all sub-metrics
            const parentMonthly = monthlyVals.get(forecastMonth)?.get(parentKey);
            const parentBaselineData = baselineData.get(priorMonth);
            const parentBaseline = parentMonthly?.baseline_value ?? parentBaselineData?.get(parentKey) ?? 0;
            const parentForecast = parentMonthly?.value ?? 0;
            
            const parentUnchanged = Math.abs(parentForecast - parentBaseline) < 0.01;
            
            if (parentUnchanged || parentBaseline === 0) {
              // No change to parent, use baseline directly
              forecastValue = subBaseline;
            } else {
              // Parent has changed - scale sub-metric proportionally
              // For percentages: if parent went from 60% to 65%, that's a 65/60 = 1.0833x multiplier
              const scaleFactor = parentForecast / parentBaseline;
              forecastValue = subBaseline * scaleFactor;
            }
            
            // Debug logging for percentage parent scaling
            if (import.meta.env.DEV && parentKey === 'sales_expense_percent' && monthIndex === 0) {
              console.debug('[forecast] sales_expense_percent sub-metric calc', {
                subName: sub.name,
                forecastMonth,
                subBaseline,
                parentForecast,
                parentBaseline,
                parentUnchanged: Math.abs(parentForecast - parentBaseline) < 0.01,
                forecastValue,
              });
            }
          } else {
            // For currency parents, scale sub-metrics proportionally
            // IMPORTANT: use the *same* baseline value used by the parent metric row to avoid false variances
            const parentMonthly = monthlyVals.get(forecastMonth)?.get(parentKey);
            const parentBaselineData = baselineData.get(priorMonth);
            const parentBaseline = parentMonthly?.baseline_value ?? parentBaselineData?.get(parentKey) ?? 0;

            // Get forecast value for parent
            const parentForecast = parentMonthly?.value ?? 0;

            // If parent forecast equals baseline (within tolerance), use sub-metric baseline directly
            // This prevents rounding / mapping differences from creating false variances
            const parentUnchanged = Math.abs(parentForecast - parentBaseline) < 0.01;

            if (parentUnchanged) {
              forecastValue = subBaseline;
            } else {
              // Calculate ratio: what fraction of parent was this sub-metric?
              const ratio = parentBaseline > 0 ? subBaseline / parentBaseline : 0;

              // Apply same ratio to forecast parent value
              forecastValue = parentForecast * ratio;
            }

            // Debug the most common "why didn't my sub-metric move?" scenario.
            if (import.meta.env.DEV && parentKey === 'sales_expense' && monthIndex === 0) {
              console.debug('[forecast] sales_expense sub-metric calc', {
                subName: sub.name,
                forecastMonth,
                subBaseline,
                parentForecast,
                parentBaseline,
                parentUnchanged,
                forecastValue,
              });
            }
          }
          
          forecastMonthlyValues.set(forecastMonth, forecastValue);
          annualValue += forecastValue;
        });
      }
      
      // Calculate quarterly values from monthly values
      const quarterlyValues = new Map<string, number>();
      const quarterMonthIndices = {
        Q1: [0, 1, 2],
        Q2: [3, 4, 5],
        Q3: [6, 7, 8],
        Q4: [9, 10, 11],
      };
      
      Object.entries(quarterMonthIndices).forEach(([quarter, monthIndices]) => {
        let quarterTotal = 0;
        monthIndices.forEach(i => {
          const forecastMonth = months[i];
          quarterTotal += forecastMonthlyValues.get(forecastMonth) ?? 0;
        });
        // For percentage parents, average instead of sum
        if (isPercentageParent) {
          quarterTotal = quarterTotal / 3;
        }
        quarterlyValues.set(quarter, quarterTotal);
      });
      
      // For percentage parents, annual value should be averaged not summed
      if (isPercentageParent) {
        annualValue = annualValue / 12;
        // Use actual month count for baseline average (handles partial year data)
        baselineAnnualValue = baselineMonthCount > 0 ? baselineAnnualValue / baselineMonthCount : 0;
      }
      
      
      return {
        key: subMetricKey,
        label: sub.name,
        parentKey,
        monthlyValues: forecastMonthlyValues,
        quarterlyValues,
        annualValue,
        baselineAnnualValue,
        isOverridden,
      };
    };

    // MODE: solve-for-gp-net (default)
    // Sales and GP% are inputs → GP Net is derived (GP Net = Sales × GP%)
    
    // MODE: solve-for-sales
    // GP Net and GP% are inputs → Sales is derived (Sales = GP Net / GP%)
    
    // MODE: solve-for-gp-percent (NEW)
    // GP Net and Sales are inputs → GP% is derived (GP% = GP Net / Sales × 100)
    
    const salesSubs = byParent.get('total_sales') ?? [];
    const gpPercentSubs = byParent.get('gp_percent') ?? [];
    const gpNetSubs = byParent.get('gp_net') ?? [];
    
    // Detect overrides by NAME (not orderIndex), because orderIndex can differ across parents
    // (e.g., Total Sales "Counter Retail" might be 043 while GP Net "Counter Retail" is 002).
    const gpNetOverrideKeys = new Set<string>();
    const gpPercentOverrideKeys = new Set<string>();

    overrideMap.forEach((_, key) => {
      // Key format: sub:{parent}:{NNN}:{Name (may contain :)}
      const parts = key.split(':');
      if (parts.length < 4 || parts[0] !== 'sub') return;
      const parent = parts[1];
      const name = parts.slice(3).join(':');

      if (parent === 'gp_net') gpNetOverrideKeys.add(normalizeName(name));
      if (parent === 'gp_percent') gpPercentOverrideKeys.add(normalizeName(name));
    });
    
    // Calculate GP% sub-metrics first (these may later be replaced by derived values)
    if (gpPercentSubs.length > 0) {
      const forecasts: SubMetricForecast[] = gpPercentSubs.map((sub, index) =>
        calculateSingleSubMetric(sub, 'gp_percent', index, true)
      );
      result.set('gp_percent', forecasts);
    }

    if (overrideMap.size > 0) {
      console.log('[forecast] gpNetOverrideKeys (by name):', Array.from(gpNetOverrideKeys));
      console.log('[forecast] gpPercentOverrideKeys (by name):', Array.from(gpPercentOverrideKeys));
    }
    
    // SIMPLIFIED MODE: Growth % scales both Total Sales and GP Net proportionally
    // GP% stays constant from baseline, so sub-metric GP% values don't change
    // unless user manually overrides them

    // Calculate Total Sales sub-metrics.
    // IMPORTANT: use calculateSingleSubMetric so:
    // - orderIndex is preserved (matches UI ordering + saved override keys)
    // - manual overrides are applied
    // - baseline (no-change) path uses baseline directly to avoid rounding mismatches
    if (salesSubs.length > 0) {
      const forecasts: SubMetricForecast[] = salesSubs.map((sub, index) =>
        calculateSingleSubMetric(sub, 'total_sales', index, false)
      );
      result.set('total_sales', forecasts);
    }

    // Calculate GP Net sub-metrics: GP Net = Sales × GP%
    if (gpNetSubs.length > 0) {
      const salesForecasts = result.get('total_sales') ?? [];
      const gpPercentForecasts = result.get('gp_percent') ?? [];
      
       const salesByName = new Map<string, SubMetricForecast>();
       salesForecasts.forEach(sf => salesByName.set(normalizeName(sf.label), sf));
       
       const gpPercentByName = new Map<string, SubMetricForecast>();
       gpPercentForecasts.forEach(gpf => gpPercentByName.set(normalizeName(gpf.label), gpf));
      
       const forecasts: SubMetricForecast[] = gpNetSubs.map((sub, index) => {
         const subName = normalizeName(sub.name);
         const matchingSales = salesByName.get(subName);
         const matchingGpPercent = gpPercentByName.get(subName);

        const orderIndex = sub.orderIndex ?? index;
        const subMetricKey = `sub:gp_net:${String(orderIndex).padStart(3, '0')}:${sub.name}`;
        const overriddenAnnual = overrideMap.get(subMetricKey);
        const isGpNetOverridden = overriddenAnnual !== undefined;

        // If we have matching Sales + GP% sub-metrics, GP Net is normally derived.
        // BUT: if the user explicitly overrides THIS GP Net sub-metric, that override must win.
        if (matchingSales && matchingGpPercent) {
          const forecastMonthlyValues = new Map<string, number>();
          let annualValue = 0;
          let baselineAnnualValue = 0;

          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            baselineAnnualValue += subBaseline;
          });

          if (isGpNetOverridden) {
            // OVERRIDE CASE:
            // Distribute overridden annual GP Net across months using the *Sales* monthly pattern.
            // Why: if we distribute using the old GP Net baseline pattern, then GP% = GP Net / Sales
            // will vary month-to-month (sometimes wildly) even when the user intention is a consistent
            // margin. Using the Sales pattern keeps the ratio stable.
            let annualSales = 0;
            months.forEach((forecastMonth) => {
              annualSales += matchingSales.monthlyValues.get(forecastMonth) ?? 0;
            });

            months.forEach((forecastMonth) => {
              const salesValue = matchingSales.monthlyValues.get(forecastMonth) ?? 0;

              const gpNetValue = annualSales > 0
                ? (salesValue / annualSales) * (overriddenAnnual as number)
                : (overriddenAnnual as number) / 12;

              forecastMonthlyValues.set(forecastMonth, gpNetValue);
              annualValue += gpNetValue;
            });
          } else {
            // DERIVED CASE: GP Net = Sales × GP%
            months.forEach((forecastMonth, monthIndex) => {
              const monthNumber = monthIndex + 1;
              const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
              const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;

              const salesValue = matchingSales.monthlyValues.get(forecastMonth) ?? 0;
              const gpPercentValue = matchingGpPercent.monthlyValues.get(forecastMonth) ?? 0;

              // If baseline settings (growth = 0 and no overrides), use baseline directly
              if (growth === 0 && !matchingGpPercent.isOverridden && !matchingSales.isOverridden) {
                forecastMonthlyValues.set(forecastMonth, subBaseline);
                annualValue += subBaseline;
                return;
              }

              const gpNetValue = salesValue * (gpPercentValue / 100);
              forecastMonthlyValues.set(forecastMonth, gpNetValue);
              annualValue += gpNetValue;
            });
          }

          const quarterlyValues = new Map<string, number>();
          const quarterMonthIndices = {
            Q1: [0, 1, 2],
            Q2: [3, 4, 5],
            Q3: [6, 7, 8],
            Q4: [9, 10, 11],
          };

          Object.entries(quarterMonthIndices).forEach(([quarter, monthIndices]) => {
            let quarterTotal = 0;
            monthIndices.forEach(i => {
              const forecastMonth = months[i];
              quarterTotal += forecastMonthlyValues.get(forecastMonth) ?? 0;
            });
            quarterlyValues.set(quarter, quarterTotal);
          });

          return {
            key: subMetricKey,
            label: sub.name,
            parentKey: 'gp_net',
            monthlyValues: forecastMonthlyValues,
            quarterlyValues,
            annualValue,
            baselineAnnualValue,
            isOverridden: isGpNetOverridden || matchingSales.isOverridden || matchingGpPercent.isOverridden,
          };
        }

        // Fallback: no matching Sales + GP% pair → treat as standard currency sub-metric (supports overrides).
        return calculateSingleSubMetric(sub, 'gp_net', index, false);
      });
      
      result.set('gp_net', forecasts);
      
      // NOW: Recalculate GP% sub-metrics for items where GP Net was overridden (but GP% was NOT)
      // This ensures GP% = GP Net / Sales × 100 when user edits GP Net directly
      const currentGpPercentForecasts = result.get('gp_percent') ?? [];
      const salesForecastsForGpCalc = result.get('total_sales') ?? [];
      
       const salesByNameForGpCalc = new Map<string, SubMetricForecast>();
       salesForecastsForGpCalc.forEach(sf => salesByNameForGpCalc.set(normalizeName(sf.label), sf));
       
       const gpNetByName = new Map<string, SubMetricForecast>();
       forecasts.forEach(gnf => gpNetByName.set(normalizeName(gnf.label), gnf));
      
        const updatedGpPercentForecasts = currentGpPercentForecasts.map((gpPctForecast) => {
          const subName = normalizeName(gpPctForecast.label);
         
         // Check if this GP% sub-metric should be derived from GP Net override
         // When GP Net is overridden, ALWAYS derive GP% from GP Net / Sales (takes precedence over direct GP% override)
         const hasGpNetOverride = gpNetOverrideKeys.has(subName);
         
         if (hasGpNetOverride) {
          // Derive GP% from GP Net / Sales
          const matchingGpNet = gpNetByName.get(subName);
          const matchingSalesForGp = salesByNameForGpCalc.get(subName);
          
          console.log('[forecast] GP% derivation check for:', subName, {
            hasMatchingGpNet: !!matchingGpNet,
            hasMatchingSales: !!matchingSalesForGp,
            gpNetAnnual: matchingGpNet?.annualValue,
            salesAnnual: matchingSalesForGp?.annualValue,
          });
          
          if (matchingGpNet && matchingSalesForGp) {
            console.log('[forecast] Deriving GP% from GP Net override for:', subName);
            
            const newMonthlyValues = new Map<string, number>();

            // IMPORTANT: For display we keep monthly GP% values, but for annual/quarter
            // rollups we must compute GP% from totals (sum(GP Net) / sum(Sales)),
            // NOT by averaging monthly percentages.
            let annualGpNet = 0;
            let annualSales = 0;

            months.forEach((forecastMonth) => {
              const gpNetVal = matchingGpNet.monthlyValues.get(forecastMonth) ?? 0;
              const salesVal = matchingSalesForGp.monthlyValues.get(forecastMonth) ?? 0;

              annualGpNet += gpNetVal;
              annualSales += salesVal;

              const derivedGpPercent = salesVal > 0 ? (gpNetVal / salesVal) * 100 : 0;
              newMonthlyValues.set(forecastMonth, derivedGpPercent);
            });

            const derivedAnnualGpPercent = annualSales > 0 ? (annualGpNet / annualSales) * 100 : 0;
            console.log('[forecast] Derived GP% for', subName, ':', derivedAnnualGpPercent.toFixed(2), '%');

            // Calculate quarterly values as ratio-of-sums per quarter
            const newQuarterlyValues = new Map<string, number>();
            const quarterMonthIndices = {
              Q1: [0, 1, 2],
              Q2: [3, 4, 5],
              Q3: [6, 7, 8],
              Q4: [9, 10, 11],
            };

            Object.entries(quarterMonthIndices).forEach(([quarter, monthIndices]) => {
              let qGpNet = 0;
              let qSales = 0;
              monthIndices.forEach((i) => {
                const forecastMonth = months[i];
                qGpNet += matchingGpNet.monthlyValues.get(forecastMonth) ?? 0;
                qSales += matchingSalesForGp.monthlyValues.get(forecastMonth) ?? 0;
              });
              newQuarterlyValues.set(quarter, qSales > 0 ? (qGpNet / qSales) * 100 : 0);
            });

            return {
              ...gpPctForecast,
              monthlyValues: newMonthlyValues,
              quarterlyValues: newQuarterlyValues,
              annualValue: derivedAnnualGpPercent,
              isOverridden: true, // Mark as overridden since it's derived from GP Net override
            };
          }
        }
        
        return gpPctForecast;
      });
      
      result.set('gp_percent', updatedGpPercentForecasts);
    }
    
    // Calculate remaining parent metrics (not Sales, GP%, GP Net)
    // First calculate sales_expense sub-metrics (needed for sales_expense_percent)
    const salesExpenseSubs = byParent.get('sales_expense') ?? [];
    if (salesExpenseSubs.length > 0) {
      const forecasts: SubMetricForecast[] = salesExpenseSubs.map((sub, index) => 
        calculateSingleSubMetric(sub, 'sales_expense', index, false)
      );
      result.set('sales_expense', forecasts);
    }
    
    // Calculate sales_expense_percent sub-metrics
    // Key change: If sales_expense_percent sub-metric is overridden, we use the override value
    // and derive the sales_expense $ from it (reverse calculation)
    const salesExpensePercentSubs = byParent.get('sales_expense_percent') ?? [];
    if (salesExpensePercentSubs.length > 0) {
      // Build override lookup for sales_expense_percent sub-metrics
      const salesExpPercentOverrideMap = new Map<string, number>();
      subMetricOverrides?.forEach(o => {
        if (o.parentKey === 'sales_expense_percent') {
          salesExpPercentOverrideMap.set(o.subMetricKey, o.overriddenAnnualValue);
        }
      });
      
      // Get current sales_expense sub-forecasts (may be updated based on % overrides)
      const salesExpForecasts = result.get('sales_expense') ?? [];

      // Pair by statement orderIndex (NOT by name). Names can repeat and vary; order is the reliable key.
      const salesExpByOrder = new Map<number, SubMetricForecast>();
      const salesExpOrdered = [...salesExpForecasts].sort((a, b) => {
        const ao = parseInt(a.key.split(':')[2] ?? '', 10);
        const bo = parseInt(b.key.split(':')[2] ?? '', 10);
        return (Number.isNaN(ao) ? 0 : ao) - (Number.isNaN(bo) ? 0 : bo);
      });

      for (const sf of salesExpForecasts) {
        const order = parseInt(sf.key.split(':')[2] ?? '', 10);
        if (!Number.isNaN(order)) {
          salesExpByOrder.set(order, sf);
        }
      }

      // Calculate GP Net sum from GP Net sub-metrics (which include overrides) for each month
      const gpNetSubForecasts = result.get('gp_net') ?? [];
      const gpNetSumByMonth = new Map<string, number>();
      months.forEach(month => {
        let sum = 0;
        gpNetSubForecasts.forEach(gpSub => {
          sum += gpSub.monthlyValues.get(month) ?? 0;
        });
        gpNetSumByMonth.set(month, sum);
      });
      
      // Check if we have GP Net sub-metrics - if so, use their sum; otherwise fall back to parent metric
      const hasGpNetSubs = gpNetSubForecasts.length > 0;
      
      // Track updated sales_expense sub-metrics when % is overridden
      const updatedSalesExpSubs = new Map<number, SubMetricForecast>();
      
      const forecasts: SubMetricForecast[] = salesExpensePercentSubs.map((sub, index) => {
        const orderIndex = sub.orderIndex ?? index;
        const subMetricKey = `sub:sales_expense_percent:${String(orderIndex).padStart(3, '0')}:${sub.name}`;
        
        // Check if THIS percentage sub-metric has an override
        const isPercentOverridden = salesExpPercentOverrideMap.has(subMetricKey);
        const overriddenPercent = salesExpPercentOverrideMap.get(subMetricKey);
        
        const matchingSalesExp = salesExpByOrder.get(orderIndex) ?? salesExpOrdered[index];
        
        if (isPercentOverridden && overriddenPercent !== undefined) {
          // OVERRIDE CASE: User has manually set the % value
          // Use the override % for all months (percentages are constant)
          // Derive sales_expense $ from: GP Net × (% / 100)
          console.log('[forecast] Sales Exp % override detected:', subMetricKey, 'value:', overriddenPercent);
          
          const forecastMonthlyValues = new Map<string, number>();
          const derivedSalesExpMonthlyValues = new Map<string, number>();
          let annualValue = 0;
          let baselineAnnualValue = 0;
          let derivedSalesExpAnnual = 0;
          
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            baselineAnnualValue += subBaseline;
            
            // Use the overridden percentage for each month
            forecastMonthlyValues.set(forecastMonth, overriddenPercent);
            annualValue += overriddenPercent;
            
            // Derive sales_expense $ from GP Net × (% / 100)
            const gpNetForMonth = hasGpNetSubs 
              ? gpNetSumByMonth.get(forecastMonth) ?? 0
              : monthlyVals.get(forecastMonth)?.get('gp_net')?.value ?? 0;
            
            const derivedSalesExp = gpNetForMonth * (overriddenPercent / 100);
            derivedSalesExpMonthlyValues.set(forecastMonth, derivedSalesExp);
            derivedSalesExpAnnual += derivedSalesExp;
          });
          
          // Calculate quarterly values (average for percentages)
          const quarterlyValues = new Map<string, number>();
          const derivedSalesExpQuarterlyValues = new Map<string, number>();
          const quarterMonthIndices = {
            Q1: [0, 1, 2],
            Q2: [3, 4, 5],
            Q3: [6, 7, 8],
            Q4: [9, 10, 11],
          };
          
          Object.entries(quarterMonthIndices).forEach(([quarter, monthIndices]) => {
            let quarterTotal = 0;
            let derivedQuarterTotal = 0;
            monthIndices.forEach(i => {
              const forecastMonth = months[i];
              quarterTotal += forecastMonthlyValues.get(forecastMonth) ?? 0;
              derivedQuarterTotal += derivedSalesExpMonthlyValues.get(forecastMonth) ?? 0;
            });
            quarterlyValues.set(quarter, quarterTotal / 3); // Average for percentages
            derivedSalesExpQuarterlyValues.set(quarter, derivedQuarterTotal);
          });
          
          // Annual is average of monthly percentages
          annualValue = annualValue / 12;
          baselineAnnualValue = baselineAnnualValue / 12;
          
          // Store the derived sales_expense sub-metric for updating the sales_expense sub-forecasts
          if (matchingSalesExp) {
            const salesExpSubKey = `sub:sales_expense:${String(orderIndex).padStart(3, '0')}:${matchingSalesExp.label}`;
            updatedSalesExpSubs.set(orderIndex, {
              key: salesExpSubKey,
              label: matchingSalesExp.label,
              parentKey: 'sales_expense',
              monthlyValues: derivedSalesExpMonthlyValues,
              quarterlyValues: derivedSalesExpQuarterlyValues,
              annualValue: derivedSalesExpAnnual,
              baselineAnnualValue: matchingSalesExp.baselineAnnualValue,
              isOverridden: true, // Mark as overridden since it's derived from % override
            });
          }
          
          return {
            key: subMetricKey,
            label: sub.name,
            parentKey: 'sales_expense_percent',
            monthlyValues: forecastMonthlyValues,
            quarterlyValues,
            annualValue,
            baselineAnnualValue,
            isOverridden: true,
          };
        } else if (matchingSalesExp) {
          // STANDARD CASE: Derive percentage from sales_expense sub-metric
          const forecastMonthlyValues = new Map<string, number>();
          let annualValue = 0;
          let baselineAnnualValue = 0;
          
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            baselineAnnualValue += subBaseline;
            
            // Use GP Net from sub-metrics if available (includes overrides), otherwise fall back to parent metric
            const gpNetForMonth = hasGpNetSubs 
              ? gpNetSumByMonth.get(forecastMonth) ?? 0
              : monthlyVals.get(forecastMonth)?.get('gp_net')?.value ?? 0;
            
            // Get the forecast sales expense sub-metric value
            const salesExpValue = matchingSalesExp.monthlyValues.get(forecastMonth) ?? 0;
            
            // Calculate percentage: sub_sales_expense / gp_net * 100
            const forecastValue = gpNetForMonth > 0 ? (salesExpValue / gpNetForMonth) * 100 : 0;
            
            forecastMonthlyValues.set(forecastMonth, forecastValue);
            annualValue += forecastValue;
          });
          
          // Calculate quarterly values (average for percentages)
          const quarterlyValues = new Map<string, number>();
          const quarterMonthIndices = {
            Q1: [0, 1, 2],
            Q2: [3, 4, 5],
            Q3: [6, 7, 8],
            Q4: [9, 10, 11],
          };
          
          Object.entries(quarterMonthIndices).forEach(([quarter, monthIndices]) => {
            let quarterTotal = 0;
            monthIndices.forEach(i => {
              const forecastMonth = months[i];
              quarterTotal += forecastMonthlyValues.get(forecastMonth) ?? 0;
            });
            quarterlyValues.set(quarter, quarterTotal / 3); // Average for percentages
          });
          
          // Annual is average of monthly percentages
          annualValue = annualValue / 12;
          baselineAnnualValue = baselineAnnualValue / 12;
          
          return {
            key: subMetricKey,
            label: sub.name,
            parentKey: 'sales_expense_percent',
            monthlyValues: forecastMonthlyValues,
            quarterlyValues,
            annualValue,
            baselineAnnualValue,
            isOverridden: matchingSalesExp.isOverridden,
          };
        } else {
          // Fallback to standard calculation
          return calculateSingleSubMetric(sub, 'sales_expense_percent', index, true);
        }
      });
      result.set('sales_expense_percent', forecasts);
      
      // Update sales_expense sub-forecasts with derived values from % overrides
      if (updatedSalesExpSubs.size > 0) {
        const currentSalesExpSubs = result.get('sales_expense') ?? [];
        const updatedSalesExpSubsList = currentSalesExpSubs.map(sub => {
          const orderIndex = parseInt(sub.key.split(':')[2] ?? '', 10);
          if (!Number.isNaN(orderIndex) && updatedSalesExpSubs.has(orderIndex)) {
            return updatedSalesExpSubs.get(orderIndex)!;
          }
          return sub;
        });
        result.set('sales_expense', updatedSalesExpSubsList);
      }
    }
    
    byParent.forEach((subs, parentKey) => {
      if (parentKey === 'total_sales' || parentKey === 'gp_percent' || parentKey === 'gp_net' || 
          parentKey === 'sales_expense' || parentKey === 'sales_expense_percent') {
        return; // Already calculated above
      }
      
      const isPercentageParent = percentageParents.has(parentKey);
      const forecasts: SubMetricForecast[] = subs.map((sub, index) => 
        calculateSingleSubMetric(sub, parentKey, index, isPercentageParent)
      );
      result.set(parentKey, forecasts);
    });
    
    return result;
  }, [subMetricBaselines, subMetricOverrides, months, forecastYear, baselineData, growth, salesExpense, fixedExpense, weightsMap, annualBaseline, entriesMap]);

  // Calculate all values - with sub-metric override flow-up
  // IMPORTANT: Memoize these to prevent recalculation on every render
  const baseMonthlyValues = useMemo(() => calculateMonthlyValues(), [calculateMonthlyValues]);
  
  const subMetricForecasts = useMemo(
    () => calculateSubMetricForecasts(baseMonthlyValues),
    [calculateSubMetricForecasts, baseMonthlyValues]
  );
  
  // Adjust parent totals based on sub-metric sums when overrides exist
  // This allows sub-metric changes to flow up to parent metrics and department profit
  // Key insight: when GP% sub-metric is raised, GP Net increases, and we derive Total Sales from it
  const monthlyValues = useMemo(() => {
    // Check if any GP% sub-metrics have overrides (these should flow up to GP Net and Total Sales)
    const gpPercentSubs = subMetricForecasts.get('gp_percent') ?? [];
    const hasGpPercentOverrides = gpPercentSubs.some(sub => sub.isOverridden);
    const gpNetSubs = subMetricForecasts.get('gp_net') ?? [];
    const hasGpNetSubs = gpNetSubs.length > 0;
    
    // If no GP% overrides and no general overrides, return base values
    const hasSubMetricOverrides = subMetricOverrides && subMetricOverrides.length > 0;
    if (!hasSubMetricOverrides && !hasGpPercentOverrides) {
      return baseMonthlyValues;
    }
    
    // Create a copy of the monthly values that we can adjust
    const adjusted = new Map<string, Map<string, CalculationResult>>();
    
    // Calculate parent sums from sub-metrics for each month
    const parentSumsFromSubs = new Map<string, Map<string, number>>(); // month -> parentKey -> sum
    
    subMetricForecasts.forEach((subs, parentKey) => {
      subs.forEach(sub => {
        sub.monthlyValues.forEach((value, month) => {
          if (!parentSumsFromSubs.has(month)) {
            parentSumsFromSubs.set(month, new Map());
          }
          const current = parentSumsFromSubs.get(month)!.get(parentKey) || 0;
          // For percentage parents, we want the average, not the sum - handle in recalculation
          parentSumsFromSubs.get(month)!.set(parentKey, current + value);
        });
      });
    });
    
    // Calculate baseline GP% for deriving Total Sales when GP Net changes due to GP% overrides
    const baselineTotalSalesAnnual = annualBaseline['total_sales'] || 0;
    const baselineGpNetAnnual = annualBaseline['gp_net'] || 0;
    const baselineGpPercentAnnual = baselineTotalSalesAnnual > 0 
      ? (baselineGpNetAnnual / baselineTotalSalesAnnual) * 100 
      : 0;
    
    // For each month, recalculate using sub-metric sums where they exist
    months.forEach((month, monthIndex) => {
      const baseMetrics = baseMonthlyValues.get(month);
      if (!baseMetrics) return;
      
      const adjustedMetrics = new Map<string, CalculationResult>();
      const subSums = parentSumsFromSubs.get(month);
      
      // Copy base values first
      baseMetrics.forEach((result, key) => {
        adjustedMetrics.set(key, { ...result });
      });
      
      // Get the GP Net from sub-metrics sum (this includes GP% override effects)
      const gpNetFromSubs = hasGpNetSubs ? subSums?.get('gp_net') : undefined;
      const baseGpNet = baseMetrics.get('gp_net')?.value ?? 0;
      const baseTotalSales = baseMetrics.get('total_sales')?.value ?? 0;
      
      // Get baseline monthly GP% for this month (to derive Total Sales when GP Net changes)
      const monthNumber = monthIndex + 1;
      const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
      const baselineMonthData = baselineData.get(priorMonth);
      const baselineSalesMonth = baselineMonthData?.get('total_sales') ?? 0;
      const baselineGpNetMonth = baselineMonthData?.get('gp_net') ?? 0;
      const baselineGpPercentMonth = baselineSalesMonth > 0 
        ? (baselineGpNetMonth / baselineSalesMonth) * 100 
        : baselineGpPercentAnnual;
      
      // If GP Net has changed due to GP% overrides, update GP Net but keep Total Sales at growth-slider value
      // This allows GP% to increase naturally when GP% sub-metrics are raised
      if (gpNetFromSubs !== undefined && hasGpPercentOverrides) {
        // Update GP Net with the sub-metric sum (rolled up from GP% overrides)
        const gpNetCurrent = adjustedMetrics.get('gp_net');
        if (gpNetCurrent) {
          adjustedMetrics.set('gp_net', { ...gpNetCurrent, value: gpNetFromSubs });
        }
        // Total Sales stays at growth-slider value - DO NOT derive from GP Net
        // This allows overall GP% to increase when GP% sub-metrics are raised
      } else if (subSums) {
        // Standard sub-metric rollup (no GP% override case)
        const updatedSales = subSums.get('total_sales');
        const updatedGpNet = subSums.get('gp_net');
        
        if (updatedSales !== undefined) {
          const current = adjustedMetrics.get('total_sales');
          if (current) {
            adjustedMetrics.set('total_sales', { ...current, value: updatedSales });
          }
        }
        
        if (updatedGpNet !== undefined) {
          const current = adjustedMetrics.get('gp_net');
          if (current) {
            adjustedMetrics.set('gp_net', { ...current, value: updatedGpNet });
          }
        }
      }
      
      // Recalculate derived metrics based on potentially updated parent values
      const salesValue = adjustedMetrics.get('total_sales')?.value ?? 0;
      const gpNetValue = adjustedMetrics.get('gp_net')?.value ?? 0;
      const salesExpenseValue = adjustedMetrics.get('sales_expense')?.value ?? 0;
      const semiFixed = adjustedMetrics.get('semi_fixed_expense')?.value ?? 0;
      const fixedExp = adjustedMetrics.get('total_fixed_expense')?.value ?? 0;
      const partsTransfer = adjustedMetrics.get('parts_transfer')?.value ?? 0;
      
      // Check if any Sales Expense % sub-metrics have overrides (derived from subMetricForecasts)
      const salesExpPercentSubs = subMetricForecasts.get('sales_expense_percent') ?? [];
      const hasSalesExpPercentOverrides = salesExpPercentSubs.some(sub => sub.isOverridden);
      
      // Check if sales_expense sub-metrics have overrides (either direct or derived from % overrides)
      const salesExpenseSubs = subMetricForecasts.get('sales_expense') ?? [];
      const hasSalesExpSubOverrides = salesExpenseSubs.some(sub => sub.isOverridden);
      
      // Check if the PARENT sales_expense_percent has a stored forecast value different from baseline
      // This handles GMC stores where sub-metrics are synthesized (not explicitly overridden)
      const parentSalesExpPercent = adjustedMetrics.get('sales_expense_percent');
      const parentSalesExpPercentChanged = parentSalesExpPercent && 
        Math.abs((parentSalesExpPercent.value ?? 0) - (parentSalesExpPercent.baseline_value ?? 0)) > 0.01;
      
      // Calculate Sales Expense adjustment based on override source
      let adjustedSalesExpense = salesExpenseValue;
      
      if (hasSalesExpPercentOverrides || hasSalesExpSubOverrides) {
        // Use the sum from sales_expense sub-metrics (which includes values derived from % overrides)
        const salesExpFromSubs = subSums?.get('sales_expense');
        if (salesExpFromSubs !== undefined) {
          adjustedSalesExpense = salesExpFromSubs;
        }
      } else if (parentSalesExpPercentChanged && gpNetValue > 0) {
        // Parent Sales Expense % changed (e.g., GMC stores with synthesized sub-metrics)
        // Calculate new Sales Expense $ from the changed % target
        const newSalesExpPercent = parentSalesExpPercent?.value ?? 0;
        adjustedSalesExpense = gpNetValue * (newSalesExpPercent / 100);
      } else if (hasGpPercentOverrides) {
        // Scale Sales Expense with GP Net to keep Sales Exp % constant
        // salesExpense / gpNet should stay constant
        const baselineSalesExpPercent = baseGpNet > 0 
          ? (adjustedMetrics.get('sales_expense')?.baseline_value ?? 0) / (baseMetrics.get('gp_net')?.baseline_value ?? baseGpNet) * 100
          : 0;
        if (gpNetValue > 0 && baselineSalesExpPercent > 0) {
          adjustedSalesExpense = gpNetValue * (baselineSalesExpPercent / 100);
        }
      }
      
      // Update sales_expense if it changed
      if (Math.abs(adjustedSalesExpense - salesExpenseValue) > 0.01) {
        const salesExpCurrent = adjustedMetrics.get('sales_expense');
        if (salesExpCurrent) {
          adjustedMetrics.set('sales_expense', { ...salesExpCurrent, value: adjustedSalesExpense });
        }
      }
      
      // Update GP % (recalculate from new values)
      const gpPercentCurrent = adjustedMetrics.get('gp_percent');
      if (gpPercentCurrent && salesValue > 0) {
        adjustedMetrics.set('gp_percent', { 
          ...gpPercentCurrent, 
          value: (gpNetValue / salesValue) * 100 
        });
      }
      
      // Update sales_expense_percent - BUT preserve user-entered values
      const salesExpPercentCurrent = adjustedMetrics.get('sales_expense_percent');
      const storedSalesExpPercent = entriesMap.get(`${month}:sales_expense_percent`);
      const hasUserEnteredSalesExpPercent = storedSalesExpPercent?.forecast_value !== null && 
        storedSalesExpPercent?.forecast_value !== undefined;

      if (salesExpPercentCurrent && gpNetValue > 0 && !hasUserEnteredSalesExpPercent) {
        // Only recalculate if user hasn't explicitly set a value
        adjustedMetrics.set('sales_expense_percent', {
          ...salesExpPercentCurrent,
          value: (adjustedSalesExpense / gpNetValue) * 100,
        });
      }
      
      // Update net_selling_gross
      const nsgCurrent = adjustedMetrics.get('net_selling_gross');
      if (nsgCurrent) {
        adjustedMetrics.set('net_selling_gross', {
          ...nsgCurrent,
          value: gpNetValue - adjustedSalesExpense - semiFixed,
        });
      }
      
      // Update department_profit
      const deptProfitCurrent = adjustedMetrics.get('department_profit');
      const deptProfit = gpNetValue - adjustedSalesExpense - semiFixed - fixedExp;
      if (deptProfitCurrent) {
        adjustedMetrics.set('department_profit', {
          ...deptProfitCurrent,
          value: deptProfit,
        });
      }
      
      // Update net_operating_profit (or 'net' for GMC brand)
      const netOpCurrent = adjustedMetrics.get('net_operating_profit') || adjustedMetrics.get('net');
      const netOpKey = adjustedMetrics.has('net_operating_profit') ? 'net_operating_profit' : 'net';
      if (netOpCurrent) {
        adjustedMetrics.set(netOpKey, {
          ...netOpCurrent,
          value: deptProfit + partsTransfer,
        });
      }
      
      // Update return_on_gross
      const rogCurrent = adjustedMetrics.get('return_on_gross');
      if (rogCurrent && gpNetValue > 0) {
        adjustedMetrics.set('return_on_gross', {
          ...rogCurrent,
          value: (deptProfit / gpNetValue) * 100,
        });
      }
      
      adjusted.set(month, adjustedMetrics);
    });
    
    return adjusted;
  }, [baseMonthlyValues, subMetricForecasts, subMetricOverrides, months, annualBaseline, baselineData, forecastYear, entriesMap]);
  
  const quarterlyValues = calculateQuarterlyValues(monthlyValues);
  const annualValues = calculateAnnualValues(monthlyValues);

  // Calculate implied growth from adjusted annual Total Sales vs baseline
  // This allows the Growth slider to update when user manually edits Total Sales
  const impliedGrowth = useMemo(() => {
    const adjustedTotalSalesAnnual = annualValues.get('total_sales')?.value || 0;
    const baselineTotalSalesAnnual = annualBaseline['total_sales'] || 0;
    
    if (baselineTotalSalesAnnual > 0 && adjustedTotalSalesAnnual > 0) {
      return ((adjustedTotalSalesAnnual / baselineTotalSalesAnnual) - 1) * 100;
    }
    return growth; // fallback to current growth slider value
  }, [annualValues, annualBaseline, growth]);

  return {
    monthlyValues,
    quarterlyValues,
    annualValues,
    subMetricForecasts,
    months,
    metricDefinitions: METRIC_DEFINITIONS,
    distributeQuarterToMonths,
    impliedGrowth,
  };
}
