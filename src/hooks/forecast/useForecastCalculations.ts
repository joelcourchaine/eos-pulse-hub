import { useMemo, useCallback } from 'react';
import type { ForecastEntry, ForecastWeight } from './useForecast';

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
  calculate?: (inputs: Record<string, number>) => number;
  reverseCalculate?: (value: number, inputs: Record<string, number>) => Partial<Record<string, number>>;
}

// Define metrics and their calculation logic
// Order matches Ford financial summary: Total Sales, GP Net, GP %, Sales Expense, Sales Exp %, Net Selling Gross, Fixed Expense, Dept Profit, Parts Transfer, Net Operating, Return on Gross
const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'total_sales', label: 'Total Sales', type: 'currency', isDriver: true, isDerived: false },
  { key: 'gp_net', label: 'GP Net', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.total_sales * (i.gp_percent / 100),
    reverseCalculate: (value, i) => ({ gp_percent: i.total_sales > 0 ? (value / i.total_sales) * 100 : 0 })
  },
  { key: 'gp_percent', label: 'GP %', type: 'percent', isDriver: true, isDerived: false },
  { key: 'sales_expense', label: 'Sales Expense', type: 'currency', isDriver: true, isDerived: false },
  { key: 'sales_expense_percent', label: 'Sales Exp %', type: 'percent', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net > 0 ? (i.sales_expense / i.gp_net) * 100 : 0
  },
  { key: 'net_selling_gross', label: 'Net Selling Gross', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense
  },
  { key: 'total_fixed_expense', label: 'Fixed Expense', type: 'currency', isDriver: true, isDerived: false },
  { key: 'department_profit', label: 'Dept Profit', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense - i.total_fixed_expense
  },
  { key: 'parts_transfer', label: 'Parts Transfer', type: 'currency', isDriver: false, isDerived: false },
  { key: 'net_operating_profit', label: 'Net Operating', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.department_profit + (i.parts_transfer || 0)
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
}: UseForecastCalculationsProps) {
  
  // Get all months for the forecast year
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return `${forecastYear}-${String(month).padStart(2, '0')}`;
    });
  }, [forecastYear]);

  // Create entries map for quick lookup
  const entriesMap = useMemo(() => {
    const map = new Map<string, ForecastEntry>();
    entries.forEach(e => {
      map.set(`${e.month}:${e.metric_name}`, e);
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

  // Calculate annual baseline from prior year data
  const annualBaseline = useMemo(() => {
    const totals: Record<string, number> = {};
    let sawPartsTransfer = false;

    baselineData.forEach((metrics) => {
      metrics.forEach((value, metricName) => {
        if (metricName === 'parts_transfer') sawPartsTransfer = true;
        totals[metricName] = (totals[metricName] || 0) + value;
      });
    });

    // Some brands don't store parts_transfer directly; derive it from adjusted_selling_gross when present.
    // Only do this when parts_transfer is truly missing (not when it's legitimately zero).
    if (!sawPartsTransfer && totals.adjusted_selling_gross !== undefined) {
      const derivedNetSellingGross =
        totals.net_selling_gross ??
        (totals.gp_net || 0) - (totals.sales_expense || 0) - (totals.semi_fixed_expense || 0);
      totals.parts_transfer = totals.adjusted_selling_gross - derivedNetSellingGross;
    }

    return totals;
  }, [baselineData]);

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

      const baselineInputs = {
        total_sales: baselineMonthData?.get('total_sales') ?? 0,
        gp_net: baselineMonthData?.get('gp_net') ?? 0,
        sales_expense: baselineMonthData?.get('sales_expense') ?? 0,
        total_fixed_expense: baselineMonthData?.get('total_fixed_expense') ?? 0,
        adjusted_selling_gross: baselineMonthData?.get('adjusted_selling_gross') ?? 0,
        parts_transfer: baselineMonthData?.get('parts_transfer') ?? 0,
      };

      const baselineNetSellingGross =
        baselineInputs.gp_net - baselineInputs.sales_expense;

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
        net_operating_profit:
          (baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.total_fixed_expense) +
          derivedPartsTransfer,
        return_on_gross:
          baselineInputs.gp_net > 0
            ? ((baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.total_fixed_expense) / baselineInputs.gp_net) * 100
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

      // Calculate baseline comparison values for useBaselineDirectly check
      const baselineSalesExpenseCalc = annualBaseline['sales_expense'] || 0;
      
      // Use baseline directly when no changes to avoid rounding differences
      // But NOT if any driver metrics are locked (user made manual edits)
      const hasAnyLockedDrivers = lockedValues['gp_percent'] !== undefined || 
        lockedValues['total_sales'] !== undefined || 
        lockedValues['gp_net'] !== undefined;
      const useBaselineDirectly = growth === 0 
        && Math.abs(salesExpense - baselineSalesExpenseCalc) < 1 // Within $1
        && !hasAnyLockedDrivers;

      // Helper function to get GP Net considering locked values
      const getCalculatedGpNet = (): number => {
        const lockedGpNet = lockedValues['gp_net'];
        if (lockedGpNet !== undefined && lockedGpNet !== null) {
          return lockedGpNet;
        }
        
        const lockedGpPercent = lockedValues['gp_percent'];
        if (lockedGpPercent !== undefined && lockedGpPercent !== null) {
          const lockedTotalSales = lockedValues['total_sales'];
          const totalSalesForCalc = lockedTotalSales ?? (baselineMonthlyValues.total_sales * growthFactor);
          return totalSalesForCalc * (lockedGpPercent / 100);
        }
        
        return baselineMonthlyValues.gp_net * growthFactor;
      };

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

        if (isLocked && existingEntry?.forecast_value !== null) {
          // Use locked value
          value = existingEntry.forecast_value;
        } else if (useBaselineDirectly) {
          // At baseline settings - use baseline value for ALL metrics to avoid rounding differences
          value = baselineValue;
        } else if (metric.key === 'gp_percent') {
          // GP% stays constant - derived from baseline ratio
          value = gpPercent;
        } else if (metric.key === 'total_sales') {
          // Scale total_sales by growth factor
          value = baselineValue * growthFactor;
        } else if (metric.key === 'gp_net') {
          // GP Net calculation: if GP% is locked, use locked GP% with current total_sales
          value = getCalculatedGpNet();
        } else if (metric.key === 'sales_expense_percent') {
          // Sales Expense % stays constant - use baseline ratio
          value = baselineMonthlyValues.sales_expense_percent;
        } else if (metric.key === 'sales_expense') {
          // Sales Expense scales with growth to keep Sales Exp % constant
          value = baselineMonthlyValues.sales_expense * growthFactor;
        } else if (metric.key === 'total_fixed_expense') {
          // Use baseline pattern for fixed expense
          value = baselineValue;
        } else if (metric.key === 'parts_transfer') {
          // Keep baseline pattern for parts transfer
          value = baselineValue;
        } else if (metric.key === 'net_selling_gross') {
          // Derived: GP Net - Sales Expense
          const calcGpNet = getCalculatedGpNet();
          const calcSalesExp = baselineMonthlyValues.sales_expense * growthFactor;
          value = calcGpNet - calcSalesExp;
        } else if (metric.key === 'department_profit') {
          // Derived: GP Net - Sales Expense - Fixed
          const calcGpNet = getCalculatedGpNet();
          const calcSalesExp = baselineMonthlyValues.sales_expense * growthFactor;
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          value = calcGpNet - calcSalesExp - fixedExp;
        } else if (metric.key === 'net_operating_profit') {
          // Derived: Dept Profit + Parts Transfer
          const calcGpNet = getCalculatedGpNet();
          const calcSalesExp = baselineMonthlyValues.sales_expense * growthFactor;
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          const deptProfit = calcGpNet - calcSalesExp - fixedExp;
          value = deptProfit + baselineMonthlyValues.parts_transfer;
        } else if (metric.key === 'return_on_gross') {
          // Derived: (Dept Profit / GP Net) * 100
          const calcGpNet = getCalculatedGpNet();
          const calcSalesExp = baselineMonthlyValues.sales_expense * growthFactor;
          const fixedExp = baselineMonthlyValues.total_fixed_expense;
          const deptProfit = calcGpNet - calcSalesExp - fixedExp;
          value = calcGpNet > 0 ? (deptProfit / calcGpNet) * 100 : 0;
        } else {
          // Default: scale by growth factor
          value = baselineValue * growthFactor;
        }
        
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
  }, [months, weightsMap, entriesMap, baselineData, annualBaseline, growth, salesExpense, fixedExpense]);

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
  }, [months]);

  // Get annual totals
  const calculateAnnualValues = useCallback((monthlyValues: Map<string, Map<string, CalculationResult>>) => {
    const annualResults = new Map<string, CalculationResult>();
    
    // First, sum all currency values to calculate derived percentages correctly
    const totals: Record<string, { value: number; baseline: number; locked: boolean; allLocked: boolean; lockedValues: number[] }> = {};
    
    METRIC_DEFINITIONS.forEach(metric => {
      totals[metric.key] = { value: 0, baseline: 0, locked: false, allLocked: true, lockedValues: [] };
    });
    
    months.forEach(month => {
      const monthData = monthlyValues.get(month);
      METRIC_DEFINITIONS.forEach(metric => {
        const metricData = monthData?.get(metric.key);
        if (metricData) {
          totals[metric.key].value += metricData.value;
          totals[metric.key].baseline += metricData.baseline_value;
          if (metricData.is_locked) {
            totals[metric.key].locked = true;
            totals[metric.key].lockedValues.push(metricData.value);
          } else {
            totals[metric.key].allLocked = false;
          }
        }
      });
    });
    
    // Now calculate proper values - percentages should be calculated from totals, not averaged
    // Exception: if a percentage metric has ALL months locked to the same value, use that value for the forecast
    METRIC_DEFINITIONS.forEach(metric => {
      let finalValue = totals[metric.key].value;
      let finalBaseline = totals[metric.key].baseline;
      
      // For percentage metrics, check if all months are locked to the same value
      const isPercentMetric = metric.type === 'percent';
      const allMonthsLocked = totals[metric.key].allLocked && totals[metric.key].lockedValues.length === 12;
      const allSameValue = allMonthsLocked && 
        totals[metric.key].lockedValues.every((v, _, arr) => Math.abs(v - arr[0]) < 0.01);
      
      // Always recalculate percentage baselines from currency totals
      if (metric.key === 'gp_percent') {
        // GP% = GP Net / Total Sales * 100
        const gpNet = totals['gp_net']?.value ?? 0;
        const totalSales = totals['total_sales']?.value ?? 0;
        
        // For forecast value: use locked value if all months locked to same, otherwise calculate
        if (isPercentMetric && allSameValue) {
          finalValue = totals[metric.key].lockedValues[0];
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
        
        if (isPercentMetric && allSameValue) {
          finalValue = totals[metric.key].lockedValues[0];
        } else {
          finalValue = gpNet > 0 ? (salesExp / gpNet) * 100 : 0;
        }
        
        const baselineSalesExp = totals['sales_expense']?.baseline ?? 0;
        const baselineGpNet = totals['gp_net']?.baseline ?? 0;
        finalBaseline = baselineGpNet > 0 ? (baselineSalesExp / baselineGpNet) * 100 : 0;
      } else if (metric.key === 'return_on_gross') {
        // Return on Gross = Dept Profit / GP Net * 100
        const deptProfit = totals['department_profit']?.value ?? 0;
        const gpNet = totals['gp_net']?.value ?? 0;
        
        if (isPercentMetric && allSameValue) {
          finalValue = totals[metric.key].lockedValues[0];
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
  }, [months]);

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
    
    if (import.meta.env.DEV) {
      console.debug('[forecast] calculateSubMetricForecasts called', {
        hasSubMetricBaselines: !!subMetricBaselines && subMetricBaselines.length > 0,
        subMetricOverridesCount: subMetricOverrides?.length ?? 0,
      });
    }
    
    if (!subMetricBaselines || subMetricBaselines.length === 0) {
      return result;
    }
    
    // Build override lookup map
    const overrideMap = new Map<string, number>();
    subMetricOverrides?.forEach(o => {
      overrideMap.set(o.subMetricKey, o.overriddenAnnualValue);
    });
    
    // Always log override map when overrides exist
    if (subMetricOverrides && subMetricOverrides.length > 0) {
      console.log('[forecast] overrideMap keys:', Array.from(overrideMap.keys()));
    }
    
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

      // Log key matching for gp_percent sub-metrics
      if (parentKey === 'gp_percent') {
        console.log('[forecast] gp_percent sub check:', subMetricKey, 'override found:', isOverridden);
      }

      if (import.meta.env.DEV && parentKey === 'gp_percent' && sub.name.toLowerCase() === 'internal service') {
        console.debug('[forecast] gp_percent sub override check', {
          subMetricKey,
          isOverridden,
          overriddenAnnual,
        });
      }
      
      const forecastMonthlyValues = new Map<string, number>();
      let annualValue = 0;
      let baselineAnnualValue = 0;
      
      // First pass: calculate baseline annual value
      months.forEach((forecastMonth, monthIndex) => {
        const monthNumber = monthIndex + 1;
        const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
        const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
        baselineAnnualValue += subBaseline;
      });
      
      // If overridden, distribute override annual value across months
      if (isOverridden && overriddenAnnual !== undefined) {
        console.log('[forecast] Applying override for', subMetricKey, 'value:', overriddenAnnual, 'isPercentageParent:', isPercentageParent);
        if (isPercentageParent) {
          // For percentage sub-metrics, each month gets the same percentage value
          months.forEach((forecastMonth) => {
            forecastMonthlyValues.set(forecastMonth, overriddenAnnual);
            annualValue += overriddenAnnual;
          });
          console.log('[forecast] After override application, annualValue:', annualValue);
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
            // For percentage parents, sub-metrics stay the same (they're component percentages)
            forecastValue = subBaseline;
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

            // Debug the most common “why didn’t my sub-metric move?” scenario.
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
        baselineAnnualValue = baselineAnnualValue / 12;
      }
      
      if (isOverridden) {
        console.log('[forecast] Returning overridden sub-metric:', subMetricKey, 'annualValue:', annualValue, 'isOverridden:', isOverridden);
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
    
    const salesSubs = byParent.get('total_sales') ?? [];
    const gpPercentSubs = byParent.get('gp_percent') ?? [];
    const gpNetSubs = byParent.get('gp_net') ?? [];
    
    // Always calculate GP% sub-metrics first (they're always an input)
    if (gpPercentSubs.length > 0) {
      const forecasts: SubMetricForecast[] = gpPercentSubs.map((sub, index) => 
        calculateSingleSubMetric(sub, 'gp_percent', index, true)
      );
      result.set('gp_percent', forecasts);
    }
    
    // SIMPLIFIED MODE: Growth % scales both Total Sales and GP Net proportionally
    // GP% stays constant from baseline, so sub-metric GP% values don't change
    // unless user manually overrides them
    
    // Calculate Sales sub-metrics - just apply growth factor
    if (salesSubs.length > 0) {
      const growthFactor = 1 + (growth / 100);
      
      const forecasts: SubMetricForecast[] = salesSubs.map((sub, index) => {
        const subMetricKey = `sub:total_sales:${String(index).padStart(3, '0')}:${sub.name}`;
        const forecastMonthlyValues = new Map<string, number>();
        let annualValue = 0;
        let baselineAnnualValue = 0;
        
        // Calculate scaled Sales for each month
        months.forEach((forecastMonth, monthIndex) => {
          const monthNumber = monthIndex + 1;
          const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
          const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
          baselineAnnualValue += subBaseline;
          
          // At baseline (growth = 0), use baseline directly
          const forecastValue = growth === 0 ? subBaseline : subBaseline * growthFactor;
          
          forecastMonthlyValues.set(forecastMonth, forecastValue);
          annualValue += forecastValue;
        });
        
        // Calculate quarterly values
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
          parentKey: 'total_sales',
          monthlyValues: forecastMonthlyValues,
          quarterlyValues,
          annualValue,
          baselineAnnualValue,
          isOverridden: false,
        };
      });
      
      result.set('total_sales', forecasts);
    }

    // Calculate GP Net sub-metrics: GP Net = Sales × GP%
    if (gpNetSubs.length > 0) {
      const salesForecasts = result.get('total_sales') ?? [];
      const gpPercentForecasts = result.get('gp_percent') ?? [];
      
      const salesByName = new Map<string, SubMetricForecast>();
      salesForecasts.forEach(sf => salesByName.set(sf.label.toLowerCase(), sf));
      
      const gpPercentByName = new Map<string, SubMetricForecast>();
      gpPercentForecasts.forEach(gpf => gpPercentByName.set(gpf.label.toLowerCase(), gpf));
      
      const forecasts: SubMetricForecast[] = gpNetSubs.map((sub, index) => {
        const subName = sub.name.toLowerCase();
        const matchingSales = salesByName.get(subName);
        const matchingGpPercent = gpPercentByName.get(subName);
        
        if (matchingSales && matchingGpPercent) {
          const subMetricKey = `sub:gp_net:${String(sub.orderIndex ?? index).padStart(3, '0')}:${sub.name}`;
          const forecastMonthlyValues = new Map<string, number>();
          let annualValue = 0;
          let baselineAnnualValue = 0;
          
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            baselineAnnualValue += subBaseline;
            
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
            isOverridden: matchingSales.isOverridden || matchingGpPercent.isOverridden,
          };
        } else {
          return calculateSingleSubMetric(sub, 'gp_net', index, false);
        }
      });
      
      result.set('gp_net', forecasts);
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
  const baseMonthlyValues = calculateMonthlyValues();
  const subMetricForecasts = calculateSubMetricForecasts(baseMonthlyValues);
  
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
      
      // Calculate Sales Expense adjustment based on override source
      let adjustedSalesExpense = salesExpenseValue;
      
      if (hasSalesExpPercentOverrides || hasSalesExpSubOverrides) {
        // Use the sum from sales_expense sub-metrics (which includes values derived from % overrides)
        const salesExpFromSubs = subSums?.get('sales_expense');
        if (salesExpFromSubs !== undefined) {
          adjustedSalesExpense = salesExpFromSubs;
        }
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
      
      // Update sales_expense_percent
      const salesExpPercentCurrent = adjustedMetrics.get('sales_expense_percent');
      if (salesExpPercentCurrent && gpNetValue > 0) {
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
      
      // Update net_operating_profit
      const netOpCurrent = adjustedMetrics.get('net_operating_profit');
      if (netOpCurrent) {
        adjustedMetrics.set('net_operating_profit', {
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
  }, [baseMonthlyValues, subMetricForecasts, subMetricOverrides, months, annualBaseline, baselineData, forecastYear]);
  
  const quarterlyValues = calculateQuarterlyValues(monthlyValues);
  const annualValues = calculateAnnualValues(monthlyValues);

  // Calculate implied growth from adjusted annual GP Net vs baseline
  // This allows the Growth slider to update when GP% sub-metric overrides increase GP Net
  const impliedGrowth = useMemo(() => {
    const adjustedGpNetAnnual = annualValues.get('gp_net')?.value || 0;
    const baselineGpNetAnnual = annualBaseline['gp_net'] || 0;
    
    if (baselineGpNetAnnual > 0 && adjustedGpNetAnnual > 0) {
      return ((adjustedGpNetAnnual / baselineGpNetAnnual) - 1) * 100;
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
