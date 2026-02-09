
## Fix: Percentage Metrics Incorrectly Summed in Enterprise YOY Comparison

### Root Cause

The "backfill parent totals from sub-metrics" logic (around line 959-1020 in DealerComparison.tsx) sums ALL sub-metric values to reconstruct missing parent metrics. This works correctly for dollar metrics (e.g., summing `sub:gp_net:001`, `sub:gp_net:002`, etc. to get `gp_net`), but is mathematically wrong for percentage metrics.

For example, the database has entries like:
- `sub:gp_percent:001:CUST. LAB CARS & LD TRKS` = 79.0%
- `sub:gp_percent:005:Q/SRV LAB-CARS & LD TRKS` = 66.2%
- `sub:gp_percent:013:WARRANTY CLAIM LAB` = 69.0%
- ...plus ~15 more sub-percentage entries

The backfill sums these to ~570.3% and stores it as the parent `gp_percent`. Then, when the derived metric calculator runs (line 1180), it sees `gp_percent` already exists and skips the correct formula calculation (`gp_net / total_sales * 100 = 71.8%`).

The previous year value (64.2%) is correct because the `comparisonMap` builder at line 659-670 properly recalculates percentage metrics from their formula, overwriting any incorrect summed values.

### Fix

**File:** `src/pages/DealerComparison.tsx`

**Change 1 - Single-month backfill (lines 959-1020):**
Before summing a sub-metric's value into its parent total, check if the parent metric is a percentage type. If it is, skip the backfill for that parent -- percentage values must be calculated from their formula (numerator/denominator), not summed from sub-metric line items.

```
// In the backfill loop, skip percentage-type parents:
const parentDef = getMetricDef(parentKey, null);
if (parentDef?.type === 'percentage') return; // Don't sum percentage sub-metrics
```

**Change 2 - Multi-month backfill (backfillParentTotalsFromSubMetrics at lines 762-780):**
Apply the same percentage-type check here. This path handles `full_year` and `custom_range` date periods, but could have the same problem. The multi-month path later recalculates percentages (lines 869-903), so it would overwrite the bad value, but preventing it from being backfilled in the first place is cleaner and prevents potential edge cases.

No changes needed to:
- The `comparisonMap` (previous year) builder -- it already correctly recalculates percentages
- The derived metric calculator -- it will now properly run for `gp_percent` since the backfill no longer creates a false entry
- The `formatValue` or `formatDiffValue` functions -- they format correctly; the input values were wrong
