// Ratio-aware forecast aggregation: percentage metrics must be computed as sum(num)/sum(den)
export const RATIO_METRICS: Record<string, { num: string; den: string }> = {
  sales_expense_percent:       { num: "sales_expense",      den: "gp_net"      },
  gp_percent:                  { num: "gp_net",             den: "total_sales" },
  semi_fixed_expense_percent:  { num: "semi_fixed_expense", den: "gp_net"      },
  total_fixed_expense_percent: { num: "total_fixed_expense", den: "gp_net"    },
  return_on_gross:             { num: "department_profit",  den: "gp_net"      },
};

export const calcRatioAwareForecast = (
  metricKey: string,
  qtrMonthIds: string[],
  getTarget: (key: string, mid: string) => number | null,
): { value: number | null; isForecast: boolean } => {
  const ratioSpec = RATIO_METRICS[metricKey];
  if (ratioSpec) {
    const numSum = qtrMonthIds.reduce((s, mid) => s + (getTarget(ratioSpec.num, mid) ?? 0), 0);
    const denSum = qtrMonthIds.reduce((s, mid) => s + (getTarget(ratioSpec.den, mid) ?? 0), 0);
    if (denSum > 0) return { value: (numSum / denSum) * 100, isForecast: true };
    return { value: null, isForecast: false };
  }
  const vals = qtrMonthIds.map((mid) => getTarget(metricKey, mid)).filter((v): v is number => v !== null);
  if (vals.length > 0) return { value: vals.reduce((s, v) => s + v, 0) / vals.length, isForecast: true };
  return { value: null, isForecast: false };
};

/**
 * For currency/dollar parent metrics that have sub-metrics, roll up the quarterly forecast
 * by summing the individual sub-metric forecast values per month, then averaging.
 * This guarantees the parent's displayed Q1 Target always equals the sum of its sub-metric targets.
 * Returns null if no sub-metric forecast data is found (caller should fall back to calcRatioAwareForecast).
 */
export const calcSubMetricSumForecast = (
  metricKey: string,
  qtrMonthIds: string[],
  subEntries: Array<{ parentMetricKey: string; name: string; orderIndex: number }>,
  getTarget: (key: string, mid: string) => number | null,
): { value: number | null; isForecast: boolean } => {
  // Get unique sub-metric names for this parent, preserving insertion order
  const seen = new Set<string>();
  const subNames: string[] = [];
  for (const sm of subEntries) {
    if (sm.parentMetricKey === metricKey && !seen.has(sm.name)) {
      seen.add(sm.name);
      subNames.push(sm.name);
    }
  }
  if (subNames.length === 0) return { value: null, isForecast: false };

  // Sum sub-metric forecasts per month, then average across the quarter
  const monthlyTotals = qtrMonthIds.map((mid) =>
    subNames.reduce((sum, subName) => {
      const subEntry = subEntries.find(
        (sm) => sm.parentMetricKey === metricKey && sm.name === subName,
      );
      if (!subEntry) return sum;
      const orderStr = String(subEntry.orderIndex).padStart(3, "0");
      const key = `sub:${metricKey}:${orderStr}:${subName}`;
      return sum + (getTarget(key, mid) ?? 0);
    }, 0),
  );

  const nonZero = monthlyTotals.filter((v) => v > 0);
  if (nonZero.length === 0) return { value: null, isForecast: false };

  // Use the full quarter length (3) for the denominator so the average is consistent
  const avg = monthlyTotals.reduce((s, v) => s + v, 0) / qtrMonthIds.length;
  return { value: avg, isForecast: true };
};

/** Calculate variance percentage between actual and target */
export const calcVariance = (
  value: number,
  target: number,
  metricType: string,
): number =>
  metricType === "percentage"
    ? value - target
    : ((value - target) / Math.abs(target)) * 100;

/** Determine RAG status from variance and target direction */
export const getVarianceStatus = (
  variance: number,
  direction: "above" | "below",
): "success" | "warning" | "destructive" => {
  if (direction === "above") {
    return variance >= 0 ? "success" : variance >= -10 ? "warning" : "destructive";
  }
  return variance <= 0 ? "success" : variance <= 10 ? "warning" : "destructive";
};
