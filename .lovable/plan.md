
## Root Cause

In `FinancialSummary.tsx`, the `getForecastTarget` callback (line 5372–5429) works like this:

1. Find `subMetricEntry` in `allSubMetrics` (current-year sub-metrics data) to get its `orderIndex`
2. Build the forecast DB key: `sub:total_direct_expenses:001:NAME`
3. Look up that key in the `forecastTargets` map

**The problem**: if a sub-metric has **no current-year actual data** (e.g., POLICY ADJUSTMENT, WARRANTY ADJUSTMENT for this Nissan store), it won't exist in `allSubMetrics` at all. Step 1 returns `undefined`, so step 2 can't build a key → returns `null` → no visual cue.

Yet the forecast engine **does** generate forecast entries for these sub-metrics (it uses prior-year baselines), so the data exists in the DB — it just can't be looked up.

## Fix

When `subMetricEntry` is not found in the current-year `allSubMetrics`, fall back to searching the **prior-year sub-metric data**. The ForecastDrawer already loads this data as `subMetricBaselines`; we need to make the same prior-year sub-metric data available in the Financial Summary.

The cleanest approach is: **inside the `getForecastTarget` callback**, when the entry isn't found in `allSubMetrics`, try to match by name alone across all sub-metrics regardless of year. Since the sub-metric entries in `allSubMetrics` are deduplicated by `(parentMetricKey, name)`, we can look up by name when the parent key matches — and if still not found, try the forecast map using a range of likely order indices.

**More precisely — the simplest safe fix:**

In `FinancialSummary.tsx`, the `getForecastTarget` callback already has `allSubMetrics` in closure. When `subMetricEntry` is `null`, the current code returns `null`. Instead, we should **scan the forecast map for any key matching the pattern `sub:${dollarParentKey}:*:${subMetricName}`**.

The `forecastTargets` map is not directly accessible in the callback — only `getForecastTarget(key, monthId)` is. However, `forecastTargets` (the Map) is available via the `useForecastTargets` hook in `FinancialSummary`. 

The cleanest minimal fix: change the `getForecastTarget` prop callback so that when `subMetricEntry` is missing, it **iterates over plausible order indices** (0–999) to find a match. That's too slow.

**Better approach**: expose `forecastTargets` (the raw Map) from the hook alongside `getForecastTarget`, then in the callback do a linear scan over the map keys to find a match by pattern.

## Implementation Plan

### 1. Export `forecastTargets` map from `useForecastTargets`
Already done — `forecastTargets` is already returned from the hook.

### 2. Use `forecastTargets` in the `getForecastTarget` callback in `FinancialSummary.tsx`

In the `<SubMetricsRow>` `getForecastTarget` prop (around line 5382), add a fallback when `subMetricEntry` is `null`:

```ts
// Current: returns null if subMetricEntry not found
// Fix: when not found in current-year data, scan forecast map by name
if (!subMetricEntry) {
  // Scan forecast map for any entry matching sub:{dollarParentKey}:*:{subMetricName}:{monthId}
  const prefix = `sub:${dollarParentKey}:`;
  const suffix = `:${subMetricName}:${monthId}`;
  for (const [mapKey, val] of forecastTargets) {
    if (mapKey.startsWith(prefix) && mapKey.endsWith(suffix)) {
      return val;
    }
  }
  return null;
}
```

This scans the in-memory `forecastTargets` Map (already loaded) to find any key in the form `sub:total_direct_expenses:XXX:NAME:MONTH`. It's O(n) over the forecast entries but only triggers for sub-metrics missing from current-year data — a rare case.

### Files to change

**`src/components/financial/FinancialSummary.tsx`** — one change in the `getForecastTarget` callback at line ~5382:

```ts
// When subMetricEntry is not found (no current-year data for this sub-metric),
// fall back to scanning the forecast map by key pattern
if (!subMetricEntry) {
  const prefix = `sub:${dollarParentKey}:`;
  const suffix = `:${subMetricName}:${monthId}`;
  for (const [mapKey, val] of forecastTargets) {
    if (mapKey.startsWith(prefix) && mapKey.endsWith(suffix)) return val;
  }
  return null;
}
```

This is a **one-file, minimal addition** that handles the case without any new data fetching. `forecastTargets` is already in scope (returned by `useForecastTargets`).
