
## Root Cause

For Ford's `GP %` sub-metrics (Parts Department, etc.), visual color cues require a `effectiveTarget` value — either a manual quarterly target, a Rock target, or a **forecast fallback**.

The forecast fallback logic in `FinancialSummary.tsx` (lines 5314–5349) for percentage metrics first tries to look up `sub:gp_percent:001:NAME` in the forecast store. Ford's forecast engine stores sub-metric entries under the **dollar parent key** (`sub:gp_net:001:NAME`), not under `gp_percent`. When the percentage key returns null, the code explicitly refuses to fall back to the dollar key (to avoid showing a dollar value as a percentage). So the forecast fallback always returns `null` for `gp_percent` sub-metrics → no `effectiveTarget` → no color cues.

This is the same issue that would affect any brand whose `GP %` sub-metrics don't have explicit percentage-keyed forecast entries.

## Fix

In the `getForecastTarget` lambda inside `SubMetricsRow`'s usage (lines 5314–5349 of `FinancialSummary.tsx`), add a **synthesis path** for `gp_percent`:

When both `sub:gp_percent:...` keys return null AND the metric is `gp_percent`, synthesize the percentage forecast by:
1. Look up the `gp_net` sub-metric forecast for this sub-metric name + month → `numeratorForecast`
2. Look up the **parent** `total_sales` forecast for this month (via `getForecastTarget("total_sales", monthId)`)
3. Return `(numeratorForecast / totalSalesForecast) * 100`

This mirrors exactly how the displayed sub-metric values are calculated (line 5175–5183), so the forecast target will be in the same percentage units as the actual value.

### Only file changed
- `src/components/financial/FinancialSummary.tsx` — update the `getForecastTarget` callback passed to `SubMetricsRow` (lines ~5314–5349)

```text
Current (simplified):
  if percentage metric:
    try sub:gp_percent:001:NAME  → null
    return null  ← cues disabled

Fixed:
  if percentage metric (gp_percent):
    try sub:gp_percent:001:NAME  → null
    synthesize: (gp_net submetric forecast) / (total_sales parent forecast) * 100  ← cues work
```

### Technical note
The synthesis uses `allSubMetrics` to find the order index for the `gp_net` sub-metric, then reads from the `forecastTargets` map the same way the existing logic already does for dollar keys. No new hooks or database changes required.
