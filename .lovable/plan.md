
## Root Cause

For **percentage metrics** like `sales_expense_percent`, sub-metric data is stored in the database under the **numerator key** (`sales_expense`), not under `sales_expense_percent`. The `visibleSubMetrics` filter in `SubMetricsRow.tsx` calls `getSubMetricValue(sm.name, monthId)` to decide whether to show or hide a row. For `sales_expense_percent`, that function is passed as:

```ts
// FinancialSummary.tsx line 5232
return getSubMetricValue(metric.key, subMetricName, monthId);
//                        ^^^^^^^^^^^^^^^^^^^
//                        "sales_expense_percent" — no data stored here
```

So every sub-metric row returns `null` → all get hidden, even though the dollar values exist under `sales_expense`.

The `gp_percent` case already has a special workaround (lines 5224–5231). `sales_expense_percent` (and any other percentage metric where data lives in the numerator) needs the same fix.

## Fix

**`src/components/financial/FinancialSummary.tsx`** — one change in the `getSubMetricValue` callback passed to `<SubMetricsRow>` (around line 5222):

```tsx
// Before: only handles gp_percent
getSubMetricValue={(subMetricName, monthId) => {
  if (metric.key === "gp_percent") {
    return getCalculatedSubMetricValue(...);
  }
  return getSubMetricValue(metric.key, subMetricName, monthId);
}}

// After: all percentage metrics with a numerator/denominator calculation
// fall back to the numerator key when no data exists under the percentage key
getSubMetricValue={(subMetricName, monthId) => {
  if (metric.key === "gp_percent") {
    return getCalculatedSubMetricValue(...);
  }
  // For percentage metrics, data is stored under the numerator key (e.g. sales_expense),
  // not under the percentage key (e.g. sales_expense_percent)
  if (
    metric.type === "percentage" &&
    metric.calculation &&
    "numerator" in metric.calculation
  ) {
    return getSubMetricValue(metric.calculation.numerator, subMetricName, monthId);
  }
  return getSubMetricValue(metric.key, subMetricName, monthId);
}}
```

This ensures:
- The **visibility filter** in `SubMetricsRow` correctly sees the real dollar values and shows the rows
- The **cell rendering** for display values (`isPercentageMetric` path) continues to calculate the proper percentage via `getSubMetricValueForParent` — that logic is already correct
- `gp_percent` retains its dedicated handler unchanged
- Dollar metrics are unaffected

One file, one small code block change.
