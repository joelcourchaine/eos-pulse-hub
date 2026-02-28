
## Root Cause

The `financial_targets` table for Abbotsford Nissan has all metrics saved with `target_value: 0` (confirmed via DB query). Only `sales_expense_percent` has a real target (50), which is why it's the only metric showing visual cues.

The status calculation in `FinancialSummary.tsx` calls `getTargetForMonth()`, which returns the manual target first. When the manual target is 0:
- **Percentage metrics** (like `sales_expense_percent`): variance = `actual - 0` = the actual value itself → colors show (though incorrectly)
- **Dollar metrics**: variance = `(actual - 0) / Math.abs(0)` = `Infinity` / `NaN` → condition fails → `status = null` → no color

The forecast fallback inside `getTargetForMonth` is never reached because the manual target row exists (value = 0 counts as "found").

## Fix

In `getTargetForMonth` (around line 523–554), treat a manual target of exactly `0` as "not set" so the function falls through to the forecast fallback. If the forecast also has no value, return `null` (no target = no color).

```ts
// Current logic: returns { value: 0, source: "manual" } when target_value = 0
// Fix: skip manual targets that are 0 so forecast can fill in
const monthlyValue = targets[metricKey]; // this is 0
if (monthlyValue !== null && monthlyValue !== undefined && monthlyValue !== 0) {
  return { value: monthlyValue, ... };
}
// fall through to null → forecast takes over
```

**Single file change:** `src/components/financial/FinancialSummary.tsx`

Specifically, the block around lines 537–552 where manual targets are returned needs to add `&& monthlyValue !== 0` to the condition guard. This means:
- Stores with real non-zero targets: unchanged behavior
- Stores with 0 targets (like Abbotsford Nissan): falls through to forecast targets
- If no forecast either: `status = null`, no color (correct — no target set)
