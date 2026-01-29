import { useMemo } from "react";
import { PayplanScenario, CommissionRule } from "./usePayplanScenarios";
import { getMetricsForBrand } from "@/config/financialMetrics";

export interface PayplanComputedRow {
  scenarioId: string;
  scenarioName: string;
  sourceMetric: string;
  type: "commission" | "base_salary" | "total_comp";
  label: string;
  values: Record<string, number>;
  total: number;
}

interface UsePayplanCalculationsProps {
  activeScenarios: PayplanScenario[];
  financialData: Record<string, Record<string, Record<string, number | null>>>;
  months: string[];
  storeIds: string[];
}

/**
 * Hook to calculate payplan commission rows from financial data and scenarios
 */
export function usePayplanCalculations({
  activeScenarios,
  financialData,
  months,
  storeIds,
}: UsePayplanCalculationsProps): PayplanComputedRow[] {
  return useMemo(() => {
    if (!activeScenarios.length || !months.length) return [];

    const allMetrics = getMetricsForBrand(null);
    const keyToName = new Map<string, string>();
    const nameToKey = new Map<string, string>();
    allMetrics.forEach((m: any) => {
      keyToName.set(m.key, m.name);
      nameToKey.set(m.name, m.key);
    });

    const computedRows: PayplanComputedRow[] = [];

    activeScenarios.forEach((scenario) => {
      const monthlyBaseSalary = scenario.base_salary_annual / 12;
      const rules = scenario.commission_rules.rules || [];

      rules.forEach((rule: CommissionRule) => {
        const sourceMetricKey = rule.source_metric;
        const sourceMetricName = keyToName.get(sourceMetricKey) || sourceMetricKey;
        const rate = rule.rate;

        // Aggregate source metric values across all stores for each month
        const commissionValues: Record<string, number> = {};
        const baseValues: Record<string, number> = {};
        const totalCompValues: Record<string, number> = {};
        
        let commissionTotal = 0;
        let baseTotal = 0;
        let totalCompTotal = 0;

        months.forEach((month) => {
          let aggregatedMetricValue = 0;

          // Sum the source metric across all stores
          Object.entries(financialData).forEach(([storeId, storeData]) => {
            if (storeId === "storeName") return;
            
            // Find the metric value - could be by name or key
            const metricValue = 
              storeData[sourceMetricName]?.[month] ?? 
              storeData[sourceMetricKey]?.[month] ?? 
              0;
            
            if (typeof metricValue === "number") {
              aggregatedMetricValue += metricValue;
            }
          });

          // Calculate commission for this month
          let commission = 0;
          
          // Apply thresholds if set
          if (rule.min_threshold !== null && aggregatedMetricValue < rule.min_threshold) {
            commission = 0;
          } else if (rule.max_threshold !== null && aggregatedMetricValue > rule.max_threshold) {
            commission = rule.max_threshold * rate;
          } else {
            commission = aggregatedMetricValue * rate;
          }
          
          // Zero out negative commissions
          if (commission < 0) {
            commission = 0;
          }

          commissionValues[month] = commission;
          baseValues[month] = monthlyBaseSalary;
          totalCompValues[month] = commission + monthlyBaseSalary;

          commissionTotal += commission;
          baseTotal += monthlyBaseSalary;
          totalCompTotal += commission + monthlyBaseSalary;
        });

        // Add rows for this rule
        computedRows.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          sourceMetric: sourceMetricName,
          type: "commission",
          label: `↳ ${scenario.name} Commission (${(rate * 100).toFixed(1)}%)`,
          values: commissionValues,
          total: commissionTotal,
        });

        computedRows.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          sourceMetric: sourceMetricName,
          type: "base_salary",
          label: `↳ ${scenario.name} Base Salary`,
          values: baseValues,
          total: baseTotal,
        });

        computedRows.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          sourceMetric: sourceMetricName,
          type: "total_comp",
          label: `↳ ${scenario.name} Total Comp`,
          values: totalCompValues,
          total: totalCompTotal,
        });
      });
    });

    return computedRows;
  }, [activeScenarios, financialData, months, storeIds]);
}

/**
 * Group computed rows by their source metric for insertion into the trend table
 */
export function groupPayplanRowsByMetric(
  rows: PayplanComputedRow[]
): Map<string, PayplanComputedRow[]> {
  const grouped = new Map<string, PayplanComputedRow[]>();

  rows.forEach((row) => {
    const existing = grouped.get(row.sourceMetric) || [];
    existing.push(row);
    grouped.set(row.sourceMetric, existing);
  });

  return grouped;
}
