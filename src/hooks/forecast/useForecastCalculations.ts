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
const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: 'total_sales', label: 'Total Sales', type: 'currency', isDriver: true, isDerived: false },
  { key: 'gp_net', label: 'GP Net', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.total_sales * (i.gp_percent / 100),
    reverseCalculate: (value, i) => ({ gp_percent: i.total_sales > 0 ? (value / i.total_sales) * 100 : 0 })
  },
  { key: 'gp_percent', label: 'GP %', type: 'percent', isDriver: true, isDerived: false },
  { key: 'sales_expense', label: 'Sales Expense', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net * (i.sales_expense_percent / 100),
    reverseCalculate: (value, i) => ({ sales_expense_percent: i.gp_net > 0 ? (value / i.gp_net) * 100 : 0 })
  },
  { key: 'sales_expense_percent', label: 'Sales Exp %', type: 'percent', isDriver: true, isDerived: false },
  { key: 'semi_fixed_expense', label: 'Semi-Fixed Exp', type: 'currency', isDriver: false, isDerived: false },
  { key: 'total_fixed_expense', label: 'Fixed Expense', type: 'currency', isDriver: true, isDerived: false },
  { key: 'net_selling_gross', label: 'Net Selling Gross', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense - i.semi_fixed_expense
  },
  { key: 'department_profit', label: 'Dept Profit', type: 'currency', isDriver: false, isDerived: true,
    calculate: (i) => i.gp_net - i.sales_expense - i.semi_fixed_expense - i.total_fixed_expense
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

// Calculation mode for sub-metrics: which metric is derived
// 'solve-for-gp-net': Sales and GP% are inputs, GP Net = Sales × GP% (default)
// 'gp-drives-growth': GP% changes drive proportional Sales growth, GP Net = (Baseline Sales × GP% change ratio) × New GP%
export type SubMetricCalcMode = 'solve-for-gp-net' | 'gp-drives-growth';

interface UseForecastCalculationsProps {
  entries: ForecastEntry[];
  weights: ForecastWeight[];
  baselineData: Map<string, Map<string, number>>; // month -> metric -> value
  subMetricBaselines?: SubMetricBaseline[]; // sub-metric baseline data
  subMetricOverrides?: SubMetricOverride[]; // user overrides for sub-metrics
  forecastYear: number;
  salesGrowth: number;
  gpPercent: number;
  salesExpPercent: number;
  fixedExpense: number;
  subMetricCalcMode?: SubMetricCalcMode; // default: 'solve-for-gp-net'
}

export function useForecastCalculations({
  entries,
  weights,
  baselineData,
  subMetricBaselines,
  subMetricOverrides,
  forecastYear,
  salesGrowth,
  gpPercent,
  salesExpPercent,
  fixedExpense,
  subMetricCalcMode = 'gp-drives-growth',
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
    const baselineGpPercentAnnual = baselineTotalSales > 0 ? (baselineGpNet / baselineTotalSales) * 100 : 0;
    
    // In GP-drives-growth mode, GP% improvements also increase Sales proportionally
    // gpChangeRatio = new GP% / baseline GP% (e.g., 25% / 20% = 1.25)
    const gpChangeRatio = baselineGpPercentAnnual > 0 ? gpPercent / baselineGpPercentAnnual : 1;
    
    // Calculate annual total sales based on mode
    let annualTotalSales: number;
    if (subMetricCalcMode === 'gp-drives-growth') {
      // GP% drives growth: Sales = Baseline Sales × GP change ratio × (1 + sales growth)
      annualTotalSales = baselineTotalSales * gpChangeRatio * (1 + salesGrowth / 100);
    } else {
      // Standard mode: Sales = Baseline Sales × (1 + sales growth)
      annualTotalSales = baselineTotalSales * (1 + salesGrowth / 100);
    }
    
    const annualGpNet = annualTotalSales * (gpPercent / 100);
    const annualSalesExp = annualGpNet * (salesExpPercent / 100);
    const annualSemiFixed = annualBaseline['semi_fixed_expense'] || 0;
    const annualPartsTransfer = annualBaseline['parts_transfer'] || 0;
    
    const annualValues: Record<string, number> = {
      total_sales: annualTotalSales,
      gp_net: annualGpNet,
      gp_percent: gpPercent,
      sales_expense: annualSalesExp,
      sales_expense_percent: salesExpPercent,
      semi_fixed_expense: annualSemiFixed,
      total_fixed_expense: fixedExpense,
      net_selling_gross: annualGpNet - annualSalesExp - annualSemiFixed,
      department_profit: annualGpNet - annualSalesExp - annualSemiFixed - fixedExpense,
      parts_transfer: annualPartsTransfer,
      net_operating_profit: (annualGpNet - annualSalesExp - annualSemiFixed - fixedExpense) + annualPartsTransfer,
      return_on_gross: annualGpNet > 0 ? ((annualGpNet - annualSalesExp - annualSemiFixed - fixedExpense) / annualGpNet) * 100 : 0,
    };

    // Distribute to months using weights
    months.forEach((month, index) => {
      const monthNumber = index + 1;
      const weight = weightsMap.get(monthNumber) || (100 / 12);
      const weightFactor = weight / 100;
      
      const monthResults = new Map<string, CalculationResult>();
      
      // Map to prior year month for baseline lookup (e.g., 2026-01 -> 2025-01)
      const priorYearMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
      
      METRIC_DEFINITIONS.forEach(metric => {
        const entryKey = `${month}:${metric.key}`;
        const existingEntry = entriesMap.get(entryKey);
        
        // Check if this entry is locked
        const isLocked = existingEntry?.is_locked ?? false;

         const baselineMonthData = baselineData.get(priorYearMonth);
         const hasStoredPartsTransfer = baselineMonthData?.has('parts_transfer') ?? false;

         const baselineInputs = {
           total_sales: baselineMonthData?.get('total_sales') ?? 0,
           gp_net: baselineMonthData?.get('gp_net') ?? 0,
           sales_expense: baselineMonthData?.get('sales_expense') ?? 0,
           semi_fixed_expense: baselineMonthData?.get('semi_fixed_expense') ?? 0,
           total_fixed_expense: baselineMonthData?.get('total_fixed_expense') ?? 0,
           adjusted_selling_gross: baselineMonthData?.get('adjusted_selling_gross') ?? 0,
           parts_transfer: baselineMonthData?.get('parts_transfer') ?? 0,
         };

         const baselineNetSellingGross =
           baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.semi_fixed_expense;

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
           semi_fixed_expense: baselineInputs.semi_fixed_expense,
           total_fixed_expense: baselineInputs.total_fixed_expense,
           net_selling_gross: baselineNetSellingGross,
           department_profit: baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.semi_fixed_expense - baselineInputs.total_fixed_expense,
           parts_transfer: derivedPartsTransfer,
           net_operating_profit:
             (baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.semi_fixed_expense - baselineInputs.total_fixed_expense) +
             derivedPartsTransfer,
           return_on_gross:
             baselineInputs.gp_net > 0
               ? ((baselineInputs.gp_net - baselineInputs.sales_expense - baselineInputs.semi_fixed_expense - baselineInputs.total_fixed_expense) / baselineInputs.gp_net) * 100
               : 0,
         };

        // Prefer exact stored baseline metric when it exists (e.g., total_fixed_expense), otherwise use computed baseline
        const baselineValue =
          baselineMonthData?.get(metric.key) ??
          baselineMonthlyValues[metric.key] ??
          0;

        let value: number;
        
        // Calculate baseline comparison values for useBaselineDirectly check
        const baselineGpPercentCalc = annualBaseline['total_sales'] > 0 
          ? (annualBaseline['gp_net'] / annualBaseline['total_sales']) * 100 
          : 0;
        const baselineSalesExpPercentCalc = annualBaseline['gp_net'] > 0 
          ? (annualBaseline['sales_expense'] / annualBaseline['gp_net']) * 100 
          : 0;
        
        // Use baseline directly when no changes to avoid rounding differences
        const useBaselineDirectly = salesGrowth === 0 
          && Math.abs(gpPercent - baselineGpPercentCalc) < 0.1 
          && Math.abs(salesExpPercent - baselineSalesExpPercentCalc) < 0.1;

        if (isLocked && existingEntry?.forecast_value !== null) {
          // Use locked value
          value = existingEntry.forecast_value;
        } else if (useBaselineDirectly) {
          // At baseline settings - use baseline value for ALL metrics to avoid rounding differences
          value = baselineValue;
        } else if (metric.type === 'percent') {
          // For percentages, use the driver-defined values (gpPercent, salesExpPercent)
          value = annualValues[metric.key] || 0;
        } else {
          // Apply growth proportionally to baseline values to maintain seasonal patterns
          const growthFactor = 1 + (salesGrowth / 100);
          
          // For GP-drives-growth mode, calculate ratio against ANNUAL baseline GP%
          // This ensures when driver GP% matches baseline, there's no change
          const baselineGpPercent = baselineGpPercentCalc;
          const annualGpChangeRatio = baselineGpPercent > 0 ? gpPercent / baselineGpPercent : 1;
          
          if (metric.key === 'total_sales') {
            if (subMetricCalcMode === 'gp-drives-growth') {
              // GP% drives growth: Sales scales by GP change ratio AND growth factor
              value = baselineValue * annualGpChangeRatio * growthFactor;
            } else {
              // Standard mode: Scale total_sales by growth factor only
              value = baselineValue * growthFactor;
            }
          } else if (metric.key === 'gp_net') {
            // GP Net = scaled total_sales * gpPercent
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            value = scaledSales * (gpPercent / 100);
          } else if (metric.key === 'sales_expense') {
            // Sales Expense = calculated GP Net * salesExpPercent
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            const calculatedGpNet = scaledSales * (gpPercent / 100);
            value = calculatedGpNet * (salesExpPercent / 100);
          } else if (metric.key === 'total_fixed_expense') {
            // Use baseline pattern for fixed expense
            value = baselineValue;
          } else if (metric.key === 'semi_fixed_expense' || metric.key === 'parts_transfer') {
            // Keep baseline pattern for these
            value = baselineValue;
          } else if (metric.key === 'net_selling_gross') {
            // Derived: GP Net - Sales Expense - Semi-Fixed
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            const calcGpNet = scaledSales * (gpPercent / 100);
            const calcSalesExp = calcGpNet * (salesExpPercent / 100);
            const semiFixed = baselineMonthlyValues.semi_fixed_expense;
            value = calcGpNet - calcSalesExp - semiFixed;
          } else if (metric.key === 'department_profit') {
            // Derived: GP Net - Sales Expense - Semi-Fixed - Fixed
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            const calcGpNet = scaledSales * (gpPercent / 100);
            const calcSalesExp = calcGpNet * (salesExpPercent / 100);
            const semiFixed = baselineMonthlyValues.semi_fixed_expense;
            const fixedExp = baselineMonthlyValues.total_fixed_expense;
            value = calcGpNet - calcSalesExp - semiFixed - fixedExp;
          } else if (metric.key === 'net_operating_profit') {
            // Derived: Dept Profit + Parts Transfer
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            const calcGpNet = scaledSales * (gpPercent / 100);
            const calcSalesExp = calcGpNet * (salesExpPercent / 100);
            const semiFixed = baselineMonthlyValues.semi_fixed_expense;
            const fixedExp = baselineMonthlyValues.total_fixed_expense;
            const deptProfit = calcGpNet - calcSalesExp - semiFixed - fixedExp;
            value = deptProfit + baselineMonthlyValues.parts_transfer;
          } else if (metric.key === 'return_on_gross') {
            // Derived: (Dept Profit / GP Net) * 100
            let scaledSales: number;
            if (subMetricCalcMode === 'gp-drives-growth') {
              scaledSales = baselineMonthlyValues.total_sales * annualGpChangeRatio * growthFactor;
            } else {
              scaledSales = baselineMonthlyValues.total_sales * growthFactor;
            }
            const calcGpNet = scaledSales * (gpPercent / 100);
            const calcSalesExp = calcGpNet * (salesExpPercent / 100);
            const semiFixed = baselineMonthlyValues.semi_fixed_expense;
            const fixedExp = baselineMonthlyValues.total_fixed_expense;
            const deptProfit = calcGpNet - calcSalesExp - semiFixed - fixedExp;
            value = calcGpNet > 0 ? (deptProfit / calcGpNet) * 100 : 0;
          } else {
            // Default: scale by growth factor
            value = baselineValue * growthFactor;
          }
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
  }, [months, weightsMap, entriesMap, baselineData, annualBaseline, salesGrowth, gpPercent, salesExpPercent, fixedExpense, subMetricCalcMode]);

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
    
    METRIC_DEFINITIONS.forEach(metric => {
      let totalValue = 0;
      let totalBaseline = 0;
      let anyLocked = false;
      
      months.forEach(month => {
        const monthData = monthlyValues.get(month);
        const metricData = monthData?.get(metric.key);
        
        if (metricData) {
          totalValue += metricData.value;
          totalBaseline += metricData.baseline_value;
          if (metricData.is_locked) anyLocked = true;
        }
      });
      
      // For percentages, average instead of sum
      if (metric.type === 'percent') {
        totalValue = totalValue / 12;
        totalBaseline = totalBaseline / 12;
      }
      
      annualResults.set(metric.key, {
        month: 'annual',
        metric_name: metric.key,
        value: totalValue,
        baseline_value: totalBaseline,
        is_locked: anyLocked,
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

    // Helper to calculate a single sub-metric forecast
    const calculateSingleSubMetric = (
      sub: SubMetricBaseline,
      parentKey: string,
      index: number,
      isPercentageParent: boolean,
      overrideValue?: number
    ): SubMetricForecast => {
      const subMetricKey = `sub:${parentKey}:${String(index).padStart(3, '0')}:${sub.name}`;
      const isOverridden = overrideValue !== undefined || overrideMap.has(subMetricKey);
      const overriddenAnnual = overrideValue ?? overrideMap.get(subMetricKey);
      
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
            // For percentage parents, sub-metrics stay the same (they're component percentages)
            forecastValue = subBaseline;
          } else {
            // For currency parents, scale sub-metrics proportionally
            const parentBaselineData = baselineData.get(priorMonth);
            const parentBaseline = parentBaselineData?.get(parentKey) ?? 0;
            
            // Get forecast value for parent
            const parentForecast = monthlyVals.get(forecastMonth)?.get(parentKey)?.value ?? 0;
            
            // Calculate ratio: what fraction of parent was this sub-metric?
            const ratio = parentBaseline > 0 ? subBaseline / parentBaseline : 0;
            
            // Apply same ratio to forecast parent value
            forecastValue = parentForecast * ratio;
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
    
    if (subMetricCalcMode === 'gp-drives-growth') {
      // GP-DRIVES-GROWTH MODE: GP% improvements also increase Sales proportionally
      // Sales = Baseline Sales × (New GP% / Baseline GP%) × (1 + sales growth)
      // GP Net = New Sales × New GP% (compounds both increases)
      
      // Calculate Sales sub-metrics with GP% driving growth
      if (salesSubs.length > 0) {
        const gpPercentForecasts = result.get('gp_percent') ?? [];
        const gpPercentByName = new Map<string, SubMetricForecast>();
        gpPercentForecasts.forEach(gpf => gpPercentByName.set(gpf.label.toLowerCase(), gpf));
        
        const forecasts: SubMetricForecast[] = salesSubs.map((sub, index) => {
          const subName = sub.name.toLowerCase();
          const matchingGpPercent = gpPercentByName.get(subName);
          
          const subMetricKey = `sub:total_sales:${String(index).padStart(3, '0')}:${sub.name}`;
          const forecastMonthlyValues = new Map<string, number>();
          let annualValue = 0;
          let baselineAnnualValue = 0;
          
          // Calculate baseline annual values and GP%
          let baselineAnnualGpPercent = 0;
          let monthCount = 0;
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            baselineAnnualValue += subBaseline;
            
            if (matchingGpPercent) {
              const gpPctBaseline = matchingGpPercent.baselineAnnualValue;
              baselineAnnualGpPercent = gpPctBaseline; // Use the average baseline GP%
            }
            monthCount++;
          });
          
          // Calculate scaled Sales for each month
          months.forEach((forecastMonth, monthIndex) => {
            const monthNumber = monthIndex + 1;
            const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
            const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
            
            let forecastValue: number;
            if (matchingGpPercent && baselineAnnualGpPercent > 0) {
              // Get the forecast GP% for this sub-metric
              const forecastGpPercent = matchingGpPercent.monthlyValues.get(forecastMonth) ?? baselineAnnualGpPercent;
              // Calculate the GP% change ratio (using the baseline average for the sub-metric)
              const gpChangeRatio = forecastGpPercent / baselineAnnualGpPercent;
              // Apply GP% change ratio and sales growth to baseline
              forecastValue = subBaseline * gpChangeRatio * (1 + salesGrowth / 100);
            } else {
              // No GP% sub-metric, just apply sales growth
              forecastValue = subBaseline * (1 + salesGrowth / 100);
            }
            
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
            isOverridden: !!matchingGpPercent?.isOverridden,
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
            const subMetricKey = `sub:gp_net:${String(index).padStart(3, '0')}:${sub.name}`;
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
    } else {
      // SOLVE-FOR-GP-NET MODE (default): Sales is anchor, GP Net is derived
      
      // Calculate Sales sub-metrics first (as independent values)
      if (salesSubs.length > 0) {
        const forecasts: SubMetricForecast[] = salesSubs.map((sub, index) => 
          calculateSingleSubMetric(sub, 'total_sales', index, false)
        );
        result.set('total_sales', forecasts);
      }
      
      // Calculate GP Net sub-metrics with linked calculation: GP Net = Sales × GP%
      if (gpNetSubs.length > 0) {
        const salesForecasts = result.get('total_sales') ?? [];
        const gpPercentForecasts = result.get('gp_percent') ?? [];
        
        // Build lookup maps by sub-metric name (lowercase for matching)
        const salesByName = new Map<string, SubMetricForecast>();
        salesForecasts.forEach(sf => salesByName.set(sf.label.toLowerCase(), sf));
        
        const gpPercentByName = new Map<string, SubMetricForecast>();
        gpPercentForecasts.forEach(gpf => gpPercentByName.set(gpf.label.toLowerCase(), gpf));
        
        const forecasts: SubMetricForecast[] = gpNetSubs.map((sub, index) => {
          const subName = sub.name.toLowerCase();
          const matchingSales = salesByName.get(subName);
          const matchingGpPercent = gpPercentByName.get(subName);
          
          // If we have matching Sales and GP% sub-metrics, calculate GP Net from them
          if (matchingSales && matchingGpPercent) {
            const subMetricKey = `sub:gp_net:${String(index).padStart(3, '0')}:${sub.name}`;
            const forecastMonthlyValues = new Map<string, number>();
            let annualValue = 0;
            let baselineAnnualValue = 0;
            
            // Calculate baseline annual value
            months.forEach((forecastMonth, monthIndex) => {
              const monthNumber = monthIndex + 1;
              const priorMonth = `${forecastYear - 1}-${String(monthNumber).padStart(2, '0')}`;
              const subBaseline = sub.monthlyValues.get(priorMonth) ?? 0;
              baselineAnnualValue += subBaseline;
            });
            
            // Calculate linked GP Net = Sales × (GP% / 100) for each month
            months.forEach(forecastMonth => {
              const salesValue = matchingSales.monthlyValues.get(forecastMonth) ?? 0;
              const gpPercentValue = matchingGpPercent.monthlyValues.get(forecastMonth) ?? 0;
              const gpNetValue = salesValue * (gpPercentValue / 100);
              
              forecastMonthlyValues.set(forecastMonth, gpNetValue);
              annualValue += gpNetValue;
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
            
            // Check if either Sales or GP% has an override - if so, mark GP Net as derived/affected
            const isLinked = matchingSales.isOverridden || matchingGpPercent.isOverridden;
            
            return {
              key: subMetricKey,
              label: sub.name,
              parentKey: 'gp_net',
              monthlyValues: forecastMonthlyValues,
              quarterlyValues,
              annualValue,
              baselineAnnualValue,
              isOverridden: isLinked, // Show as "affected" if either input is overridden
            };
          } else {
            // No matching sub-metrics, fall back to standard calculation
            return calculateSingleSubMetric(sub, 'gp_net', index, false);
          }
        });
        
        result.set('gp_net', forecasts);
      }
    }
    
    // Calculate remaining parent metrics (not Sales, GP%, GP Net)
    byParent.forEach((subs, parentKey) => {
      if (parentKey === 'total_sales' || parentKey === 'gp_percent' || parentKey === 'gp_net') {
        return; // Already calculated above
      }
      
      const isPercentageParent = percentageParents.has(parentKey);
      const forecasts: SubMetricForecast[] = subs.map((sub, index) => 
        calculateSingleSubMetric(sub, parentKey, index, isPercentageParent)
      );
      result.set(parentKey, forecasts);
    });
    
    return result;
  }, [subMetricBaselines, subMetricOverrides, months, forecastYear, baselineData, subMetricCalcMode]);

  // Calculate all values - with sub-metric override flow-up
  const baseMonthlyValues = calculateMonthlyValues();
  const subMetricForecasts = calculateSubMetricForecasts(baseMonthlyValues);
  
  // Adjust parent totals based on sub-metric sums when overrides exist
  // This allows sub-metric changes to flow up to parent metrics and department profit
  const monthlyValues = useMemo(() => {
    // Check if any sub-metrics have overrides
    const hasSubMetricOverrides = subMetricOverrides && subMetricOverrides.length > 0;
    
    if (!hasSubMetricOverrides) {
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
          parentSumsFromSubs.get(month)!.set(parentKey, current + value);
        });
      });
    });
    
    // For each month, recalculate using sub-metric sums where they exist
    months.forEach(month => {
      const baseMetrics = baseMonthlyValues.get(month);
      if (!baseMetrics) return;
      
      const adjustedMetrics = new Map<string, CalculationResult>();
      const subSums = parentSumsFromSubs.get(month);
      
      // Copy base values first
      baseMetrics.forEach((result, key) => {
        adjustedMetrics.set(key, { ...result });
      });
      
      // Override parent values with sub-metric sums where applicable
      if (subSums) {
        // Get updated values from sub-metric sums
        const updatedSales = subSums.get('total_sales');
        const updatedGpNet = subSums.get('gp_net');
        
        // Update total_sales if we have sub-metric data for it
        if (updatedSales !== undefined) {
          const current = adjustedMetrics.get('total_sales');
          if (current) {
            adjustedMetrics.set('total_sales', { ...current, value: updatedSales });
          }
        }
        
        // Update gp_net if we have sub-metric data for it
        if (updatedGpNet !== undefined) {
          const current = adjustedMetrics.get('gp_net');
          if (current) {
            adjustedMetrics.set('gp_net', { ...current, value: updatedGpNet });
          }
        }
        
        // Recalculate derived metrics based on potentially updated parent values
        const salesValue = adjustedMetrics.get('total_sales')?.value ?? 0;
        const gpNetValue = adjustedMetrics.get('gp_net')?.value ?? 0;
        const salesExpense = adjustedMetrics.get('sales_expense')?.value ?? 0;
        const semiFixed = adjustedMetrics.get('semi_fixed_expense')?.value ?? 0;
        const fixedExp = adjustedMetrics.get('total_fixed_expense')?.value ?? 0;
        const partsTransfer = adjustedMetrics.get('parts_transfer')?.value ?? 0;
        
        // Update GP %
        const gpPercentCurrent = adjustedMetrics.get('gp_percent');
        if (gpPercentCurrent && salesValue > 0) {
          adjustedMetrics.set('gp_percent', { 
            ...gpPercentCurrent, 
            value: (gpNetValue / salesValue) * 100 
          });
        }
        
        // Update net_selling_gross
        const nsgCurrent = adjustedMetrics.get('net_selling_gross');
        if (nsgCurrent) {
          adjustedMetrics.set('net_selling_gross', {
            ...nsgCurrent,
            value: gpNetValue - salesExpense - semiFixed,
          });
        }
        
        // Update department_profit
        const deptProfitCurrent = adjustedMetrics.get('department_profit');
        if (deptProfitCurrent) {
          adjustedMetrics.set('department_profit', {
            ...deptProfitCurrent,
            value: gpNetValue - salesExpense - semiFixed - fixedExp,
          });
        }
        
        // Update net_operating_profit
        const netOpCurrent = adjustedMetrics.get('net_operating_profit');
        if (netOpCurrent) {
          adjustedMetrics.set('net_operating_profit', {
            ...netOpCurrent,
            value: gpNetValue - salesExpense - semiFixed - fixedExp + partsTransfer,
          });
        }
        
        // Update return_on_gross
        const rogCurrent = adjustedMetrics.get('return_on_gross');
        if (rogCurrent && gpNetValue > 0) {
          adjustedMetrics.set('return_on_gross', {
            ...rogCurrent,
            value: ((gpNetValue - salesExpense - semiFixed - fixedExp) / gpNetValue) * 100,
          });
        }
      }
      
      adjusted.set(month, adjustedMetrics);
    });
    
    return adjusted;
  }, [baseMonthlyValues, subMetricForecasts, subMetricOverrides, months]);
  
  const quarterlyValues = calculateQuarterlyValues(monthlyValues);
  const annualValues = calculateAnnualValues(monthlyValues);

  return {
    monthlyValues,
    quarterlyValues,
    annualValues,
    subMetricForecasts,
    months,
    metricDefinitions: METRIC_DEFINITIONS,
    distributeQuarterToMonths,
  };
}
