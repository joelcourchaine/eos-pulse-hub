
# Fix: Previous Year Parent Metrics Missing in Dealer Comparison YoY View

## Problem

When viewing the Side-by-Side Comparison in Year-over-Year mode, parent metrics (Total Sales, GP Net, GP %, Sales Expense, etc.) show "N/A" for the 2025 comparison column, while "Parts Transfer" correctly shows $10,140.

## Root Cause

Murray Estevan's 2025 financial data was imported with **only sub-metric rows** (e.g., `sub:total_sales:001:CUST. LAB CARS & LD TRKS`) and a few standalone metrics like `parts_transfer`. There are no direct parent-level rows for `total_sales`, `gp_net`, etc. in the 2025 data.

The **current year** processing code already handles this by backfilling missing parent totals from sub-metric sums (lines 1005-1032 for multi-month, lines 1211-1276 for single-month). However, the **YoY comparison code** (which builds the previous-year baseline) does NOT perform this backfilling. It only reads raw DB entries and then attempts derived calculations -- but derived calculations fail because their base inputs (like `total_sales`) don't exist in the map.

The same gap exists in the "Previous Year Average" and "Previous Year Quarter Average" comparison modes.

## Solution

Add sub-metric-to-parent backfilling logic in three places within `src/pages/DealerComparison.tsx`:

### 1. Year-over-Year comparison builder (~lines 726-812)

After aggregating raw previous year entries into `prevYearByDept`, and before calculating derived metrics, iterate over each department's metrics map and sum `sub:{parentKey}:*` entries to reconstruct missing parent totals. Skip percentage-type parents (they must be derived from formulas, not summed).

```
// After line 736 (after raw aggregation loop)
// Backfill missing parent totals from sub-metrics
prevYearByDept.forEach((metrics, deptId) => {
  const parentSums = new Map<string, number>();
  metrics.forEach((value, metricName) => {
    if (!metricName.startsWith('sub:')) return;
    const parts = metricName.split(':');
    const parentKey = parts[1];
    // Skip percentage parents
    const parentDef = getMetricDef(parentKey, null);
    if (parentDef?.type === 'percentage') return;
    parentSums.set(parentKey, (parentSums.get(parentKey) || 0) + value);
  });
  parentSums.forEach((sum, parentKey) => {
    if (!metrics.has(parentKey)) {
      metrics.set(parentKey, sum);
    }
  });
});
```

### 2. Previous Year Average / Quarter comparison builder (~lines 837-916)

Same backfilling logic applied after converting sums to averages but before storing in the comparison map and calculating derived metrics.

### 3. getMetricDef availability

The `getMetricDef` helper function is defined at line 688 inside the `useEffect`, so it is available in scope for all three comparison builders. No additional changes needed here.

## Files Modified

- **`src/pages/DealerComparison.tsx`**: Add parent-total backfilling from sub-metrics in 2 locations (YoY builder and prev-year-avg builder), mirroring the existing backfill logic used for current-year data.

## Impact

- Fixes N/A display for all parent metrics when previous year data was imported at the sub-metric level only
- Applies to all brands (GMC, Ford, Nissan, etc.) since the backfill logic is brand-agnostic
- No change when parent metrics already exist in the DB (backfill only fills missing values)
- Also fixes the Diff column which currently shows "-" because the comparison value is null
