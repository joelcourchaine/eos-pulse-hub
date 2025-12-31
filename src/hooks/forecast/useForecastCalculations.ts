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

interface UseForecastCalculationsProps {
  entries: ForecastEntry[];
  weights: ForecastWeight[];
  baselineData: Map<string, Map<string, number>>; // month -> metric -> value
  forecastYear: number;
  salesGrowth: number;
  gpPercent: number;
  salesExpPercent: number;
  fixedExpense: number;
}

export function useForecastCalculations({
  entries,
  weights,
  baselineData,
  forecastYear,
  salesGrowth,
  gpPercent,
  salesExpPercent,
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
    baselineData.forEach((metrics) => {
      metrics.forEach((value, metricName) => {
        totals[metricName] = (totals[metricName] || 0) + value;
      });
    });
    return totals;
  }, [baselineData]);

  // Calculate forecasted values for each month and metric
  const calculateMonthlyValues = useCallback((): Map<string, Map<string, CalculationResult>> => {
    const results = new Map<string, Map<string, CalculationResult>>();
    
    // Calculate annual targets from drivers
    const baselineTotalSales = annualBaseline['total_sales'] || 0;
    const annualTotalSales = baselineTotalSales * (1 + salesGrowth / 100);
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
      
      METRIC_DEFINITIONS.forEach(metric => {
        const entryKey = `${month}:${metric.key}`;
        const existingEntry = entriesMap.get(entryKey);
        
        // Check if this entry is locked
        const isLocked = existingEntry?.is_locked ?? false;
        
        // Get baseline value for this month/metric
        const baselineMonthData = baselineData.get(month);
        const baselineValue = baselineMonthData?.get(metric.key) || 0;
        
        let value: number;
        
        if (isLocked && existingEntry?.forecast_value !== null) {
          // Use locked value
          value = existingEntry.forecast_value;
        } else if (metric.type === 'percent') {
          // Percentages don't get weighted distribution
          value = annualValues[metric.key] || 0;
        } else {
          // Apply weight to distribute annual value
          value = (annualValues[metric.key] || 0) * weightFactor;
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
  }, [months, weightsMap, entriesMap, baselineData, annualBaseline, salesGrowth, gpPercent, salesExpPercent, fixedExpense]);

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

  // Calculate all values
  const monthlyValues = calculateMonthlyValues();
  const quarterlyValues = calculateQuarterlyValues(monthlyValues);
  const annualValues = calculateAnnualValues(monthlyValues);

  return {
    monthlyValues,
    quarterlyValues,
    annualValues,
    months,
    metricDefinitions: METRIC_DEFINITIONS,
    distributeQuarterToMonths,
  };
}
