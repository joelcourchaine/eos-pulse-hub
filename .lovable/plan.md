

## Fix: Order Parent Metrics by Brand Config in Dealer Comparison

### Problem
"Total Direct Expenses" and its sub-metrics appear out of order in the Dealer Comparison table. Parent metrics are displayed in selection order (the order the user clicked them in the picker) rather than the brand's canonical order defined in `financialMetrics.ts`, which matches the Financial Summary / Excel statement layout.

### Root Cause
In `src/pages/DealerComparison.tsx` (line 313), `parentIds` is iterated in the order items appear in `selectedMetrics`, which is arbitrary. No step reorders parents to match the brand config.

### Fix

**File: `src/pages/DealerComparison.tsx`**

Before iterating `parentIds` to build the ordered list (line 308-330), sort `parentIds` according to the brand's canonical metric order from `getMetricsForBrand`. Metrics not found in the config get pushed to the end.

```text
// After line 306 (after sortSubsByOrder), add:

// Sort parent metrics by brand config order
const brandMetrics = getMetricsForBrand(brandName);
const parentOrderMap = new Map<string, number>();
brandMetrics.forEach((m: any, idx: number) => parentOrderMap.set(m.name, idx));

parentIds.sort((a, b) => {
  const ai = parentOrderMap.get(a) ?? 9999;
  const bi = parentOrderMap.get(b) ?? 9999;
  return ai - bi;
});
```

This ensures "Total Direct Expenses" appears in its correct position (after GP Net, before Semi Fixed Expense, etc.) matching the Financial Summary order. Sub-metrics within each parent are already sorted by `orderIndex` from the previous fix.

### Technical Details
- `brandName` is already available in scope from the component state
- `getMetricsForBrand` is already imported
- The sort is applied to `parentIds` in-place before the first pass loop that builds `ordered[]`
- Sub-metric ordering within each parent remains handled by `sortSubsByOrder`

### What This Affects
- Parent metric display order in Dealer Comparison table now matches Financial Summary / Excel layout
- All brands benefit, not just Nissan

### What Stays the Same
- Sub-metric ordering within parents (already fixed)
- Enterprise metric picker ordering (separate code path)
- Values, calculations, and synthesis logic are untouched
