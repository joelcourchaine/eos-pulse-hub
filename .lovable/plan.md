

## Fix: GP Net Sub-Metrics Appearing Under Total Sales Parent

### Problem
In the Dealer Comparison table, sub-metrics that belong to GP Net (e.g., "CUST. MECH. LABOUR") are visually showing under the Total Sales parent instead of their correct parent. The data values may also be wrong because one parent's sub-metric value overwrites the other's.

### Root Cause
In the single-month code path (line 1088-1139), each financial entry's `metricName` is resolved to a **display name** via `keyToName`. Both `sub:gp_net:001:CUST. MECH. LABOUR` and `sub:total_sales:001:CUST. MECH. LABOUR` resolve to the identical display name `"↳ CUST. MECH. LABOUR"`.

This causes two cascading failures:

1. **Data collision**: In the `storeData` reducer (line 1722), `acc[storeId].metrics["↳ CUST. MECH. LABOUR"]` is set by whichever entry is processed first. The second entry (from the other parent) is silently dropped because the key already exists.

2. **Selection ID mapping failure**: On line 1730, `extractSubMetricParts(item.metricName)` is called to map data to the correct selection ID. But since `item.metricName` is `"↳ CUST. MECH. LABOUR"` (not starting with `"sub:"`), the function returns null and no selection-ID-based indexing happens. The render then falls back to display name lookup (line 2107: `store.metrics[displayName]`), which returns whichever parent's value happened to be stored first.

### Fix

**File: `src/pages/DealerComparison.tsx`**

**Change 1 - Use raw DB keys for sub-metric metricName (single-month path, ~line 1091-1094)**

When processing single-month entries, keep sub-metric `metricName` as the raw DB key (e.g., `sub:gp_net:001:CUST. MECH. LABOUR`) instead of converting to display name. This prevents collisions and allows `extractSubMetricParts` to work correctly in the reducer.

```text
Before:
  const metricName = keyToName.get(k) || k;

After:
  // For sub-metrics, preserve the raw DB key as metricName to avoid display name collisions
  // (e.g., both sub:gp_net:001:NAME and sub:total_sales:001:NAME produce "NAME")
  const metricName = k.startsWith("sub:") ? k : (keyToName.get(k) || k);
```

**Change 2 - Also fix multi-month path (~line 981)**

Same issue exists in the multi-month aggregation path where `keyToName.get(metricKey)` converts sub-metric raw keys to display names.

```text
Before:
  const metricName = keyToName.get(metricKey) || metricKey;

After:
  const metricName = metricKey.startsWith("sub:") ? metricKey : (keyToName.get(metricKey) || metricKey);
```

These two changes ensure that:
- Sub-metric entries in `dataMap` use unique raw DB keys, preventing collisions
- The `storeData` reducer's `extractSubMetricParts` call (line 1730) successfully parses the raw key and maps it to the correct selection ID
- GP Net sub-metrics map to `sub:gp_net:NAME` selections and Total Sales sub-metrics map to `sub:total_sales:NAME` selections
- The render lookup (line 2107) finds data via `store.metrics[selectionId]` correctly

### What This Affects
- Sub-metric data is correctly separated by parent in both single-month and multi-month views
- All brands benefit (not just Nissan)
- No changes to Enterprise.tsx or the metric picker

### What Stays the Same
- Parent metric display names are unchanged
- Percentage sub-metric synthesis continues to work (it already uses selectionId as metricName)
- The ordering/grouping logic in `orderedSelectedMetrics` is unaffected (it uses selection IDs, not display names)

