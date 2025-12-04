import { FinancialMetric, getMetricsForBrand } from "@/config/financialMetrics";

export interface FinancialComparisonData {
  storeId: string;
  storeName: string;
  departmentId?: string;
  departmentName?: string;
  metricName: string;
  value: number | null;
  target: number | null;
  variance: number | null;
}

export interface FinancialEntry {
  metric_name: string;
  value: number | null;
  month?: string;
  departments?: {
    id: string;
    name: string;
    store_id: string;
    stores?: {
      name: string;
      brand?: string;
      brands?: { name: string };
    };
  };
}

interface ProcessOptions {
  datePeriodType: "month" | "full_year" | "custom_range";
  isFixedCombined: boolean;
  selectedMetrics: string[];
  comparisonMode?: string;
  comparisonMap?: Map<string, { value: number; direction?: string }>;
}

/**
 * Calculate a single metric value given raw values and already-calculated values
 */
export function calculateMetricValue(
  metricConfig: FinancialMetric,
  rawValues: Map<string, number>,
  calculatedValues: Map<string, number>
): number | null {
  if (!metricConfig.calculation) {
    return rawValues.get(metricConfig.key) ?? null;
  }

  const calc = metricConfig.calculation;

  // Percentage calculation (numerator / denominator)
  if ("numerator" in calc && "denominator" in calc) {
    const num = calculatedValues.get(calc.numerator) ?? rawValues.get(calc.numerator) ?? 0;
    const denom = calculatedValues.get(calc.denominator) ?? rawValues.get(calc.denominator) ?? 0;
    return denom !== 0 ? (num / denom) * 100 : 0;
  }

  // Subtraction calculation (base - deductions)
  if (calc.type === "subtract") {
    const baseValue = calculatedValues.get(calc.base) ?? rawValues.get(calc.base) ?? 0;
    const deductions = calc.deductions.reduce((sum: number, key: string) => {
      return sum + (calculatedValues.get(key) ?? rawValues.get(key) ?? 0);
    }, 0);
    return baseValue - deductions;
  }

  // Complex calculation (base - deductions + additions)
  if (calc.type === "complex") {
    const baseValue = calculatedValues.get(calc.base) ?? rawValues.get(calc.base) ?? 0;
    const deductions =
      calc.deductions?.reduce((sum: number, key: string) => {
        return sum + (calculatedValues.get(key) ?? rawValues.get(key) ?? 0);
      }, 0) || 0;
    const additions =
      calc.additions?.reduce((sum: number, key: string) => {
        return sum + (calculatedValues.get(key) ?? rawValues.get(key) ?? 0);
      }, 0) || 0;
    return baseValue - deductions + additions;
  }

  return null;
}

/**
 * Process all metrics for a store/department, calculating values in dependency order
 */
export function processMetricsForStoreDept(
  rawValues: Map<string, number>,
  brandMetrics: FinancialMetric[],
  selectedMetrics: string[]
): Map<string, number> {
  const calculatedValues = new Map<string, number>();

  // Process metrics in order (dependencies first)
  brandMetrics.forEach((metric) => {
    const value = calculateMetricValue(metric, rawValues, calculatedValues);
    if (value !== null) {
      calculatedValues.set(metric.key, value);
    }
  });

  return calculatedValues;
}

/**
 * Main function to process financial entries into comparison data
 */
export function processFinancialData(
  financialEntries: FinancialEntry[],
  options: ProcessOptions
): FinancialComparisonData[] {
  const { datePeriodType, isFixedCombined, selectedMetrics, comparisonMode, comparisonMap } = options;

  if (!financialEntries || financialEntries.length === 0) {
    return [];
  }

  // Detect brand from first entry
  const firstEntry = financialEntries[0];
  const brand =
    firstEntry?.departments?.stores?.brands?.name ||
    firstEntry?.departments?.stores?.brand ||
    null;
  const brandMetrics = getMetricsForBrand(brand);

  // Create metric maps
  const keyToName = new Map<string, string>();
  const nameToKey = new Map<string, string>();
  const keyToDef = new Map<string, FinancialMetric>();

  brandMetrics.forEach((m) => {
    keyToName.set(m.key, m.name);
    nameToKey.set(m.name, m.key);
    keyToDef.set(m.key, m);
  });

  // Group entries by store + department
  const groupedByStoreDept = new Map<
    string,
    {
      storeId: string;
      storeName: string;
      departmentId: string;
      departmentName: string;
      rawValues: Map<string, number>;
    }
  >();

  financialEntries.forEach((entry) => {
    const storeId = entry.departments?.store_id || "";
    const storeName = entry.departments?.stores?.name || "";
    const deptId = entry.departments?.id || "";
    const deptName = entry.departments?.name || "";
    const key = `${storeId}-${deptId}`;

    if (!groupedByStoreDept.has(key)) {
      groupedByStoreDept.set(key, {
        storeId,
        storeName,
        departmentId: deptId,
        departmentName: deptName,
        rawValues: new Map(),
      });
    }

    const storeData = groupedByStoreDept.get(key)!;

    if (datePeriodType === "month") {
      // For single month, just use the value directly
      if (entry.value !== null) {
        storeData.rawValues.set(entry.metric_name, Number(entry.value));
      }
    } else {
      // For full year or custom range, sum values across months
      const currentValue = storeData.rawValues.get(entry.metric_name) || 0;
      storeData.rawValues.set(
        entry.metric_name,
        currentValue + (entry.value ? Number(entry.value) : 0)
      );
    }
  });

  // If Fixed Combined, merge Parts and Service departments
  if (isFixedCombined) {
    const combinedByStore = new Map<
      string,
      {
        storeId: string;
        storeName: string;
        rawValues: Map<string, number>;
      }
    >();

    groupedByStoreDept.forEach((storeData) => {
      const isParts = storeData.departmentName.toLowerCase().includes("parts");
      const isService = storeData.departmentName.toLowerCase().includes("service");

      if (isParts || isService) {
        if (!combinedByStore.has(storeData.storeId)) {
          combinedByStore.set(storeData.storeId, {
            storeId: storeData.storeId,
            storeName: storeData.storeName,
            rawValues: new Map(),
          });
        }

        const combined = combinedByStore.get(storeData.storeId)!;

        // Sum raw values (only non-calculated dollar metrics)
        storeData.rawValues.forEach((value, metricKey) => {
          const metricDef = keyToDef.get(metricKey);
          // Only aggregate base dollar metrics (no calculation)
          if (metricDef?.type === "dollar" && !metricDef.calculation) {
            const currentValue = combined.rawValues.get(metricKey) || 0;
            combined.rawValues.set(metricKey, currentValue + value);
          }
        });
      }
    });

    // Generate output for Fixed Combined
    const result: FinancialComparisonData[] = [];

    combinedByStore.forEach((storeData) => {
      const calculatedValues = processMetricsForStoreDept(
        storeData.rawValues,
        brandMetrics,
        selectedMetrics
      );

      selectedMetrics.forEach((metricName) => {
        const metricConfig = brandMetrics.find((m) => m.name === metricName);
        if (metricConfig) {
          const value = calculatedValues.get(metricConfig.key);
          if (value !== undefined) {
            const comparisonKey = `fixed-combined-${metricConfig.key}`;
            const comparisonInfo = comparisonMap?.get(comparisonKey);

            let variance: number | null = null;
            if (value !== null && comparisonInfo?.value && comparisonInfo.value !== 0) {
              const rawVariance =
                ((value - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
              const shouldReverse =
                comparisonMode === "targets" && metricConfig.targetDirection === "below";
              variance = shouldReverse ? -rawVariance : rawVariance;
            }

            result.push({
              storeId: storeData.storeId,
              storeName: storeData.storeName,
              departmentId: undefined,
              departmentName: "Fixed Combined",
              metricName,
              value,
              target: comparisonInfo?.value || null,
              variance,
            });
          }
        }
      });
    });

    return result;
  }

  // Standard processing (not Fixed Combined)
  const result: FinancialComparisonData[] = [];

  groupedByStoreDept.forEach((storeData) => {
    const calculatedValues = processMetricsForStoreDept(
      storeData.rawValues,
      brandMetrics,
      selectedMetrics
    );

    selectedMetrics.forEach((metricName) => {
      const metricConfig = brandMetrics.find((m) => m.name === metricName);
      if (metricConfig) {
        const value = calculatedValues.get(metricConfig.key);
        if (value !== undefined) {
          const comparisonKey = `${storeData.departmentId}-${metricConfig.key}`;
          const comparisonInfo = comparisonMap?.get(comparisonKey);

          let variance: number | null = null;
          if (value !== null && comparisonInfo?.value && comparisonInfo.value !== 0) {
            const rawVariance =
              ((value - comparisonInfo.value) / Math.abs(comparisonInfo.value)) * 100;
            const shouldReverse =
              comparisonMode === "targets" && metricConfig.targetDirection === "below";
            variance = shouldReverse ? -rawVariance : rawVariance;
          }

          result.push({
            storeId: storeData.storeId,
            storeName: storeData.storeName,
            departmentId: storeData.departmentId,
            departmentName: storeData.departmentName,
            metricName,
            value,
            target: comparisonInfo?.value || null,
            variance,
          });
        }
      }
    });
  });

  return result;
}
