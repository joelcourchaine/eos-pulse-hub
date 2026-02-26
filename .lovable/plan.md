
## Analysis

After deep investigation, here are the issues found across brands:

### Mazda - Primary Issue
Mazda stores sub-metrics under `total_direct_expenses` as a parent key, but `total_direct_expenses` **does not exist** in `MAZDA_METRICS`. These sub-metrics are orphaned — the generic loop computes them in `calculateSubMetricForecasts`, but since there's no parent row in Mazda's metric layout, they are silently dropped and never shown in the `ForecastResultsGrid`.

**Fix:** Add `total_direct_expenses` to `MAZDA_METRICS` with `hasSubMetrics: true`, positioned between `sales_expense_percent` and `semi_fixed_expense`.

### Mazda - Secondary Issue  
Mazda's `semi_fixed_expense`, `total_fixed_expense`, `total_sales`, `gp_net`, `gp_percent`, and `sales_expense` all have sub-metrics in the DB but none are flagged with `hasSubMetrics: true` in `MAZDA_METRICS`. The `FinancialSummary` uses `metric.hasSubMetrics || checkHasSubMetrics()` so it works there dynamically. The `ForecastResultsGrid` also uses `subMetrics?.has(metric.key)` dynamically — so sub-metrics that ARE computed in `calculateSubMetricForecasts` should show. The `hasSubMetrics` flag is cosmetic for the financial summary expand button, but not the root of the forecast issue.

### GMC - Legacy Key Mismatch
GMC stores sub-metrics under `sub:fixed_expense:*` (old key) but the current metric key is `total_fixed_expense`. These entries are orphaned since `byParent.get('fixed_expense')` will have entries but there's no `fixed_expense` in `METRIC_DEFINITIONS`.

**Fix:** In `calculateSubMetricForecasts`, add a key alias: when processing `byParent`, remap `fixed_expense` → `total_fixed_expense` if `total_fixed_expense` has no subs of its own.

### Nissan - Missing `total_fixed_expense` sub-metric support
Some Nissan stores have `sub:total_fixed_expense:*` entries in the DB. `total_fixed_expense` is in `NISSAN_METRICS` but without `hasSubMetrics: true`. The generic loop handles them correctly, so they should display in the forecast. The `FinancialSummary` needs `hasSubMetrics: true` for the expand chevron. 

**Fix:** Add `hasSubMetrics: true` to `total_fixed_expense` in `NISSAN_METRICS`.

### All brands - `hasSubMetrics` flags audit
Several brands are missing `hasSubMetrics: true` on metrics that do have sub-metric data in the DB. This only affects `FinancialSummary` (which has the dynamic `checkHasSubMetrics` fallback), so it's lower priority but good to fix for correctness.

## Implementation Plan

### 1. `src/config/financialMetrics.ts`

**Mazda:** Add `total_direct_expenses` metric (hidden from normal display but needed as a parent container). Also add `hasSubMetrics: true` to relevant Mazda metrics that have DB entries:
- `total_sales` → `hasSubMetrics: true`
- `gp_net` → `hasSubMetrics: true`
- `gp_percent` → `hasSubMetrics: true`
- `sales_expense` → `hasSubMetrics: true`
- `semi_fixed_expense` → `hasSubMetrics: true`
- `total_fixed_expense` → `hasSubMetrics: true`
- Add `total_direct_expenses` with `hasSubMetrics: true` between `sales_expense_percent` and `semi_fixed_expense`

**Nissan:** Add `hasSubMetrics: true` to `total_fixed_expense`.

### 2. `src/hooks/forecast/useForecastCalculations.ts`

In `calculateSubMetricForecasts`, in the `byParent.forEach` generic loop, add a key alias for GMC's legacy `fixed_expense` → `total_fixed_expense`:

```typescript
byParent.forEach((subs, parentKey) => {
  // Remap legacy 'fixed_expense' key to 'total_fixed_expense'
  const resolvedKey = parentKey === 'fixed_expense' ? 'total_fixed_expense' : parentKey;
  if (resolvedKey === 'total_sales' || ...) return;
  // ... rest of logic using resolvedKey
```

Also add `fixed_expense` to the skip list check (since it'll be remapped).

### 3. `src/config/financialMetrics.ts` - `isDriverMetric` in `useForecastCalculations.ts`

Ensure `semi_fixed_expense` for Mazda is treated as a driver (since it has no `calculation` in `MAZDA_METRICS`). The current `isDriverMetric` function already handles this correctly (returns `false` for non-driver, non-derived metrics), so no change needed here.

## Files to Change

1. **`src/config/financialMetrics.ts`** — Add `total_direct_expenses` to `MAZDA_METRICS`, add `hasSubMetrics` flags to Mazda/Nissan metrics
2. **`src/hooks/forecast/useForecastCalculations.ts`** — Add `fixed_expense` → `total_fixed_expense` key remapping in the generic loop to fix GMC legacy entries
