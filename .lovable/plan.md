

## Fix: Sort Sub-Metrics by Excel Statement Order (Matching Financial Summary)

### Problem
Sub-metrics in the Dealer Comparison (and Enterprise metric picker) appear in alphabetical order instead of the original Excel statement order used in the Financial Summary. The Financial Summary preserves order via the `orderIndex` embedded in the DB key format `sub:parentKey:orderIndex:name`, but Enterprise and DealerComparison discard this information.

### Root Cause (2 files)

1. **Enterprise.tsx (line 569-583)**: The sub-metric query groups names into a `Map<string, Set<string>>`, discarding the order index entirely. Then on line 613, it sorts alphabetically: `Array.from(...).sort()`.

2. **DealerComparison.tsx (line 292-299)**: Sub-metrics within each parent group are rendered in the order they appear in `selectedMetrics` (which inherits the alphabetical order from Enterprise).

### Fix

**File 1: `src/pages/Enterprise.tsx`**

Change the sub-metric query result from `Map<string, Set<string>>` to `Map<string, Map<string, number>>` where the inner map is `name -> minOrderIndex`. This preserves the order index from the DB key.

- **Query parsing (line 569-583)**: Extract the order index (`parts[2]`) and store it alongside the name. Use the minimum order index seen across departments for each sub-metric name.
- **Available metrics builder (line 613)**: Replace `.sort()` with a sort by order index: `subNames.sort((a, b) => orderA - orderB)`.
- **Combined view metrics (line 693)**: Same sorting fix.

**File 2: `src/pages/DealerComparison.tsx`**

In `orderedSelectedMetrics` (line 292-299), sort sub-metrics within each parent group by their order index from the DB. Since the DealerComparison already fetches `financialEntries` which contain the raw metric keys with order indices, extract the order index for each selection ID by matching against the raw keys.

- Build a `subMetricOrderMap: Map<string, number>` from the financial entries that maps `parentKey|subName` to order index
- When adding subs for each parent (line 294), sort them by this order before pushing

### Technical Details

**Enterprise.tsx sub-metric map change:**
```text
Before: Map<string, Set<string>>  (parentKey -> set of names)
After:  Map<string, Map<string, number>>  (parentKey -> map of name -> orderIndex)
```

**Enterprise.tsx sorting change:**
```text
Before: const subNames = Array.from(subMetricData.get(key)!).sort();
After:  const subEntries = Array.from(subMetricData.get(key)!.entries());
        subEntries.sort((a, b) => a[1] - b[1]);
        const subNames = subEntries.map(e => e[0]);
```

**DealerComparison.tsx ordering fix:**
```text
// Build order map from financial entries
const subOrderMap = new Map<string, number>();
financialEntries?.forEach(entry => {
  const parts = (entry.metric_name as string).split(':');
  if (parts.length >= 4) {
    const parentKey = parts[1];
    const orderIdx = parseInt(parts[2], 10) || 999;
    const name = parts.slice(3).join(':');
    const mapKey = `${parentKey}|${name}`;
    const existing = subOrderMap.get(mapKey);
    if (existing === undefined || orderIdx < existing) {
      subOrderMap.set(mapKey, orderIdx);
    }
  }
});

// Then when adding subs for a parent, sort by order:
subs.sort((a, b) => {
  const parsedA = extractSubMetricParts(a);
  const parsedB = extractSubMetricParts(b);
  const orderA = parsedA ? (subOrderMap.get(`${parsedA.parentKey}|${parsedA.subName}`) ?? 999) : 999;
  const orderB = parsedB ? (subOrderMap.get(`${parsedB.parentKey}|${parsedB.subName}`) ?? 999) : 999;
  return orderA - orderB;
});
```

### What This Affects
- Sub-metric display order in Enterprise metric picker and Dealer Comparison table
- All brands benefit
- Order now matches the Financial Summary (which uses the Excel statement order)

### What Stays the Same
- Sub-metric values and calculations are unchanged
- Parent metric ordering is unchanged
- Financial Summary behavior is unchanged (already correct)
