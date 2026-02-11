

## Fix: Percentage Sub-Metric Synthesis Fails Due to Display Name Collision

### Problem
GP % sub-metrics (CUST. MECH. LABOUR, INTERNAL MECH. LABOUR, etc.) still show raw dollar values (24553.0%, 27014.0%) instead of calculated percentages. The previous synthesis fix is structurally correct but fails at runtime.

### Root Cause
The `allValues` map used by the synthesis step is built using `nameToKey.get(d.metricName)` to convert display names back to raw DB keys. But multiple sub-metrics across different parents share the **same display name** (e.g., both `sub:gp_net:001:CUST. MECH. LABOUR` and `sub:total_sales:001:CUST. MECH. LABOUR` produce `"↳ CUST. MECH. LABOUR"`). The `nameToKey` map can only store one mapping per display name, so only the last-registered parent's sub-metric is recoverable. The synthesis then can't find both the numerator (gp_net) and denominator (total_sales) sub-metrics, causing it to silently skip the calculation.

### Fix

**File: `src/pages/DealerComparison.tsx`**

Replace the `allValues` map construction (around line 1469-1482) to build directly from `financialEntries` instead of going through the lossy `nameToKey` lookup. This guarantees all sub-metric values are accessible by their raw DB keys.

**Current (broken):**
```text
const allValues = new Map();
Object.values(dataMap).forEach((d) => {
  // nameToKey.get("↳ CUST. MECH. LABOUR") returns only ONE raw key
  // due to display name collision across parents
  const k = nameToKey.get(d.metricName);
  if (k) allValues.set(k, d.value);
  else if (d.metricName.startsWith("sub:")) allValues.set(d.metricName, d.value);
});
```

**Fixed:**
```text
const allValues = new Map();

// 1. Add parent metric values from dataMap (no collision for base metrics)
Object.values(dataMap).forEach((d) => {
  if (d.storeId === storeId && d.departmentId === deptId && d.value !== null) {
    const k = nameToKey.get(d.metricName);
    if (k && !k.startsWith("sub:")) allValues.set(k, d.value);
  }
});

// 2. Add ALL sub-metric values directly from financialEntries using raw DB keys
//    This avoids the nameToKey display-name collision entirely
financialEntries.forEach((entry) => {
  const rawKey = entry.metric_name as string;
  if (!rawKey?.startsWith("sub:")) return;
  const entryStoreId = entry?.departments?.store_id || "";
  const entryDeptId = entry?.departments?.id;
  if (entryStoreId !== storeId || entryDeptId !== deptId) return;
  const val = entry.value !== null ? Number(entry.value) : null;
  if (val !== null) allValues.set(rawKey, val);
});
```

This same fix needs to be applied in the multi-month aggregation path as well, where the allValues map is built similarly. For multi-month, the raw sub-metric values should come from the aggregated `storeMetrics` map (which already uses raw DB keys) rather than going through display names.

Additionally, the original raw-dollar entries for percentage sub-metrics should be **excluded** from the final result set to prevent duplicate rows. After synthesis, filter out any dataMap entry whose raw DB key belongs to a numerator sub-metric that was replaced by a synthesized percentage entry.

### Technical Summary

1. Build `allValues` from `financialEntries` directly (raw keys) instead of through `nameToKey` (lossy display names)
2. This ensures both `sub:gp_net:001:CUST. MECH. LABOUR` AND `sub:total_sales:001:CUST. MECH. LABOUR` are available for the division
3. After synthesis, remove original dollar entries that were replaced by percentage values to prevent duplicate rows in the output

### What This Affects
- DealerComparison percentage sub-metric synthesis only
- Both single-month and multi-month code paths
- All brands benefit (not just Nissan)

### What Stays the Same
- Dollar sub-metrics continue to display raw values
- Parent metric calculations are unaffected
- Financial Summary page is unaffected

