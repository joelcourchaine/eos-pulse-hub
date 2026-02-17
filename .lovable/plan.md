

# Fix Inverted Visual Cues for Total Direct Expenses in Enterprise YoY View

## Problem

On the Dealer Comparison (Enterprise) page, the "Total Direct Expenses" parent metric and its sub-metrics for Nissan show inverted colors in Year-over-Year mode: green when expenses went up (bad) and red when they went down (good).

## Root Cause

Multiple rendering functions (`isDiffFavorable`, `getVarianceColor`, `lowerIsBetter`, `formatValue`, `formatDiffValue`) call `getMetricsForBrand(null)` to look up metric definitions. Passing `null` returns GMC/Chevrolet metrics by default. Since "Total Direct Expenses" only exists in the Nissan (and a few other) brand configurations and NOT in GMC, the lookup fails and the code defaults to "higher is better" -- which is wrong for an expense metric.

## Fix

### 1. Create a cross-brand metric lookup helper (in `DealerComparison.tsx`)

Add a helper function that searches all brand metric definitions instead of just GMC:

```typescript
const getAllBrandMetricDefs = (): FinancialMetric[] => {
  const brands = [null, 'nissan', 'ford', 'mazda', 'honda', 'hyundai', 'genesis', 'stellantis', 'ktrv'];
  const seen = new Set<string>();
  const all: FinancialMetric[] = [];
  brands.forEach(b => {
    getMetricsForBrand(b).forEach(m => {
      if (!seen.has(m.key)) {
        seen.add(m.key);
        all.push(m);
      }
    });
  });
  return all;
};
```

### 2. Replace `getMetricsForBrand(null)` calls in rendering functions

Update the following functions to use `getAllBrandMetricDefs()` instead of `getMetricsForBrand(null)`:

- **`isDiffFavorable`** (~line 1973) -- determines green/red for YoY diff column
- **`lowerIsBetter`** computation (~line 2290) -- passed to email/print components  
- **`formatValue`** (~lines 1917, 1933) -- determines dollar vs percentage formatting
- **`formatDiffValue`** (~lines 1956, 1963) -- formats the diff column values
- **`isPercentage`** computation (~lines 2281, 2285) -- determines percentage display

This ensures that Nissan-specific metrics like "Total Direct Expenses" (`targetDirection: "below"`) are found regardless of which brand's config they belong to, so expense metrics correctly show green when below last year and red when above.

### Files Changed

- `src/pages/DealerComparison.tsx` -- add helper, update ~10 call sites from `getMetricsForBrand(null)` to `getAllBrandMetricDefs()`

