
## Root Cause

The Financial Summary Q1 Target column has two independent data sources for parent vs sub-metric rows, and they can diverge:

**Parent metric Q1 Target** (`calcRatioAwareForecast` in `FinancialSummary.tsx`):
- Calls `getForecastTarget('total_sales', monthId)` — looks up `total_sales:2026-01` in `forecast_entries`
- This value comes from `useForecastCalculations` → parent metric row, calculated via `annualValues['total_sales'] * weightFactor` (growth-driven)

**Sub-metric Q1 Targets** (`SubMetricsRow.tsx` lines 726–733):
- Calls `getForecastTarget('sub:total_sales:001:Counter Retail', monthId)` — looks up individual sub-metric keys in `forecast_entries`
- These values come from `calculateSubMetricForecasts` — each sub-metric is scaled proportionally from its own baseline (e.g., `subBaseline / parentBaseline * parentForecast`)

**Why they diverge:**
The sub-metric scaling formula uses `parentBaseline` from `baselineData` (prior-year `financial_entries`), but this parent baseline can be `0` or missing for sub-metric-only stores (Stellantis, Honda) — causing sub-metrics to fall back to `subBaseline` directly. Meanwhile, the parent metric is still computed via growth * annual total. When the sub-metrics' forecasts don't sum to the parent's stored forecast, the Q1 Target column shows a mismatch.

A secondary divergence: `calcRatioAwareForecast` for non-ratio currency metrics divides by `vals.length` (average). This is correct for an "avg monthly" target. But if `vals.length < 3` (i.e., fewer than 3 months have stored forecast entries), the average is computed from a partial set, giving a wrong result. Sub-metric rows have the same issue at line 733.

## Fix

The correct approach: **for currency/dollar parent metrics that have sub-metrics**, compute the Q1 Target by **summing sub-metric forecast values** across the quarter (same 3-month sum, then / 3 for average display) rather than using the parent's stored `forecast_entries` value. This guarantees they always add up.

Specifically:

### Change 1 — `FinancialSummary.tsx`: Replace parent metric Q1 Target calculation for sub-metric parents

In the Q1 Target cell (~line 4628–4636), before calling `calcRatioAwareForecast`, check if the metric has sub-metrics AND is a currency type. If so, compute the Q1 average by summing sub-metric forecast values per month (using the same `getForecastTarget` wrappers from the SubMetricsRow props, reconstructed from `allSubMetrics`), then averaging those monthly totals — or simply fall back to `calcRatioAwareForecast` if no sub-metric forecasts exist.

Concretely, add a helper `calcSubMetricRollupForecast(metricKey, qtrMonthIds)`:
```ts
// If metric has sub-metrics and is dollar-type, roll up from sub-metric forecasts
// This guarantees parent Q1 target = sum of sub-metric Q1 targets
const subNames = getSubMetricNames(metricKey);  // already available
if (subNames.length > 0 && metric.type !== 'percentage') {
  const monthlyTotals = qtrMonths.map(mid => {
    return subNames.reduce((sum, name) => {
      // Reuse the same getForecastTarget closure passed to SubMetricsRow
      const subForecastKey = buildSubForecastKey(metricKey, name); // sub:key:NNN:name
      return sum + (getForecastTarget(subForecastKey, mid) ?? 0);
    }, 0);
  });
  if (monthlyTotals.some(v => v > 0)) {
    displayTarget = monthlyTotals.reduce((s,v)=>s+v,0) / monthlyTotals.length;
    isForecastTarget = true;
  }
}
```

But we need a clean way to build the sub-metric forecast key given the stored `allSubMetrics` data. The exact key format is `sub:{parentKey}:{orderStr}:{name}` as already shown in the `getForecastTarget` prop closure at line 5289.

### Simpler approach (less invasive): Fix the `getForecastTarget` prop for sub-metrics to also expose a "sum-of-subs" getter, and use it in the Q1 Target cell

Actually, the cleanest fix: **in the Q1 Target cell, when the metric is a dollar metric with sub-metrics**, reconstruct the monthly sum from `allSubMetrics` + `getForecastTarget`:

```ts
if (hasForecastTargets && hasSubMetrics(metric.key) && metric.type !== 'percentage') {
  const subNames = getSubMetricNames(metric.key);
  const monthlyTotals = qtrMonths.map(mid => {
    return subNames.reduce((sum, subName) => {
      const subEntry = allSubMetrics.find(sm => sm.parentMetricKey === metric.key && sm.name === subName);
      if (!subEntry) return sum;
      const orderStr = String(subEntry.orderIndex).padStart(3, '0');
      const key = `sub:${metric.key}:${orderStr}:${subName}`;
      return sum + (getForecastTarget(key, mid) ?? 0);
    }, 0);
  }).filter(v => v > 0);
  
  if (monthlyTotals.length > 0) {
    displayTarget = monthlyTotals.reduce((s,v) => s+v, 0) / monthlyTotals.length;
    isForecastTarget = true;
  } else {
    // fall back to existing calcRatioAwareForecast
    const { value: fv, isForecast } = calcRatioAwareForecast(metric.key, qtrMonths.map(m=>m.identifier), getForecastTarget);
    if (fv !== null) { displayTarget = fv; isForecastTarget = isForecast; }
  }
} else if (hasForecastTargets) {
  // existing calcRatioAwareForecast path for percentage metrics and metrics without sub-metrics
  ...
}
```

The same logic needs to apply in the **preceding quarter trend columns** (~line 4314–4324) and the **TrendCellTooltip** (~line 2463–2464) for parent metrics that have sub-metrics.

### Files to change
- `src/components/financial/FinancialSummary.tsx`
  - **Q1 Target cell** (~lines 4628–4636): add sub-metric rollup branch for dollar metrics with sub-metrics
  - **Quarter trend columns** (~lines 4314–4324): same fix
  - **TrendCellTooltip** (~lines 2463–2464): same fix
  - Extract a helper function (e.g. `calcSubMetricSumForecast`) to avoid repeating the logic in 3 places

### What stays the same
- Percentage metrics (`gp_percent`, `sales_expense_percent`, etc.) continue using `calcRatioAwareForecast` — their Q1 target is a ratio computation, not a sub-metric sum
- Sub-metric rows in `SubMetricsRow.tsx` — no changes needed, they already fetch individual sub-metric forecast entries correctly
- `useForecastCalculations` and `ForecastDrawer` — no changes needed
