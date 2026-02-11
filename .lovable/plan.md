
## Fix: Use Brand-Specific Metrics Exclusively in DealerComparison

### Problem
When comparing Nissan stores in the Enterprise dealer comparison, the system falls back to GMC metric definitions throughout the processing pipeline. Nissan has unique metrics (like `total_direct_expenses`) that don't exist in GMC's definition set. This causes:
- Sub-metric lookups to fail silently (parent def not found)
- Placeholder rows to be created for wrong metrics
- Percentage sub-metric synthesis to skip Nissan entries entirely

### Root Causes (6 locations in `DealerComparison.tsx`)

1. **Line 567**: The `brandMetricDefs` map only includes `['GMC', 'Ford', 'Nissan', 'Mazda']`, missing Honda, Hyundai, Genesis, Stellantis, KTRV, Other
2. **Line 598**: `keyToDef` is hardcoded to `brandMetricDefs.get('GMC')` and used as the global fallback
3. **Lines 185 and 253**: `getMetricsForBrand(null)` returns GMC metrics, so Nissan-specific metric keys (like `total_direct_expenses`) are never registered in the type map or ordering logic
4. **Line 1417**: The percentage sub-metric synthesis block uses `keyToDef` (GMC) to look up parent definitions -- Nissan parents are not found, so synthesis is skipped
5. **Line 1549**: Placeholder creation for missing metrics uses `keyToDef` (GMC) instead of the store's actual brand

### Fix

**File: `src/pages/DealerComparison.tsx`**

1. **Expand brand list** (line 567): Include all supported brands in the `brandMetricDefs` map: GMC, Ford, Nissan, Mazda, Honda, Hyundai, Genesis, Stellantis, KTRV, Other.

2. **Use detected brand for fallback** (line 598): Instead of hardcoding `keyToDef` to GMC, detect the primary brand from the financial entries (already done on line 554 as `brand`) and use that brand's definitions as the default.

3. **Fix `subMetricTypeBySelectionId`** (line 185): Replace `getMetricsForBrand(null)` with a lookup that checks all brand definitions, so Nissan-specific parent keys like `total_direct_expenses` are correctly identified.

4. **Fix metric ordering** (line 253): Similarly, use `brandDisplayName` or detected brand instead of `getMetricsForBrand(null)` so the ordering logic uses the correct brand's metric list.

5. **Fix percentage sub-metric synthesis** (line 1417): Replace `keyToDef.get(parentKey)` with the brand-specific lookup using the store's actual brand from `storeBrands`.

6. **Fix placeholder creation** (line 1549): Replace `keyToDef.get(metricKey)` with the brand-specific lookup.

### Technical Detail

The key change is making the `keyToDef` fallback map use the **detected brand** instead of always GMC:

```text
Before: const keyToDef = brandMetricDefs.get('GMC') || new Map();
After:  const keyToDef = brandMetricDefs.get(detectedBrandKey) || brandMetricDefs.get('GMC') || new Map();
```

Where `detectedBrandKey` is derived from the `brand` variable already computed on line 554 (or from `brandDisplayName` passed via location state).

For the percentage sub-metric synthesis (the most critical fix), the `percentSubSelections` block will use `getMetricDef(parentKey, storeBrand)` per-store instead of the global `keyToDef.get(parentKey)`.

### What This Affects
- All financial metric lookups in DealerComparison now use the correct brand definitions
- Nissan-specific metrics (total_direct_expenses, semi_fixed_expense derived from it) will be properly recognized
- Percentage sub-metric synthesis will work for all brands, not just GMC
- All other brands (Honda, Hyundai, Genesis, Stellantis) also benefit from this fix

### What Stays the Same
- Enterprise.tsx metric selection UI is unchanged
- Financial Summary page is unaffected (already handles this correctly)
- The sub-metric clearing on brand switch (just added) remains in place
