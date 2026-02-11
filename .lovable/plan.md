

## Fix: Clear Sub-Metric Selections When Store/Brand Changes

### Problem
When switching between brands (e.g., from GMC to Nissan) in Enterprise reports, previously selected sub-metrics persist via sessionStorage. Since sub-metrics are brand-specific (GMC has "CUST. LAB CARS & LD TRKS", Nissan has "CUST. MECH. LABOUR"), the old selections show "No data" for the new brand's stores.

### Root Cause
The `selectedMetrics` state in `Enterprise.tsx` is only cleared when the `metricType` changes (e.g., Weekly to Financial). It is NOT cleared when the store filter, brand filter, or group filter changes. Sub-metrics are brand-specific, so they become invalid when switching brands.

### Fix

**File: `src/pages/Enterprise.tsx`**

Add an effect that strips sub-metric selections (IDs starting with `sub:`) from `selectedMetrics` whenever the store/brand/group filter changes. This preserves parent metric selections (like "Total Sales", "GP Net") which are shared across brands, while removing brand-specific sub-metrics that won't match the new stores.

```text
Trigger: selectedStoreIds, selectedBrandIds, or selectedGroupIds changes
Action: Remove any item from selectedMetrics that starts with "sub:"
```

This uses a `prevStoreFilterRef` to avoid clearing on initial mount (same pattern as `prevMetricTypeRef`), so selections restored from sessionStorage are preserved on page load.

### Technical Detail

1. Track previous filter values with a ref (storeIds + brandIds + groupIds serialized)
2. On change (but not on initial mount), filter out all `sub:*` entries from `selectedMetrics`
3. This keeps parent metrics selected while removing stale sub-metrics
4. The user can then re-select the correct sub-metrics for the new brand from the picker

### What This Affects
- Enterprise.tsx only
- Sub-metric selections are cleared when switching stores/brands/groups
- Parent metric selections (Total Sales, GP %, etc.) are preserved across brand switches
- Initial page load from sessionStorage is unaffected

### What Stays the Same
- DealerComparison.tsx is unchanged
- Filter persistence for non-sub-metric selections continues to work
- The metric picker correctly shows available sub-metrics based on current departments

