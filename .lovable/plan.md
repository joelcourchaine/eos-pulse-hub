
## Root Cause

The Forecast Results Grid and Financial Summary Q1 Target use different data sources:

- **Forecast Results Grid (Q1 Avg)**: Shows live calculations from the `useForecastCalculations` engine in the drawer — never stale.
- **Financial Summary Q1 Target**: Reads `forecast_entries` from the database via `useForecastTargets`, averaged across the 3 months.

The mismatch occurs in `ForecastDrawer.tsx` auto-save logic (lines 846–850):

```ts
const manualEditableMetrics = ['sales_expense_percent', 'sales_expense', 'gp_percent', 'gp_net', 'total_sales'];
if (manualEditableMetrics.includes(metricKey) && entry && entry.forecast_value !== null && ...) {
  return; // Preserve manual edits — SKIPS re-saving updated values!
}
```

This was designed to prevent auto-save from overwriting user manual edits. But it's too broad: it prevents the auto-save from updating **any** stored value for those key metrics, even when the growth slider or weights change. So the DB retains old monthly values while the drawer shows fresh calculated values.

The Financial Summary then reads the stale stored values, producing a lower/different Q1 Target than the drawer's live Q1 Avg.

## Fix

**`src/components/financial/ForecastDrawer.tsx`** — Change the skip condition to only skip when the entry is **explicitly locked** (`is_locked = true`), not just "has a stored value". A stored value that isn't locked should be updated by the auto-save.

```text
Before:
  Skip if: metric is in manualEditableMetrics AND entry has a forecast_value stored

After:
  Skip if: entry.is_locked === true
  (Locked entries are already handled by the `if (entry?.is_locked) return;` check on line 843)
```

This means: only entries the user has explicitly locked are preserved. All other entries (including previously auto-saved values for `total_sales`, `gp_net`, etc.) get updated when the calculation engine produces new values.

### Specific change — lines 843–850 in `ForecastDrawer.tsx`

```ts
// BEFORE:
if (entry?.is_locked) return;

const manualEditableMetrics = ['sales_expense_percent', 'sales_expense', 'gp_percent', 'gp_net', 'total_sales'];
if (manualEditableMetrics.includes(metricKey) && entry && entry.forecast_value !== null && entry.forecast_value !== undefined) {
  return; // Preserve manual edits
}

// AFTER:
if (entry?.is_locked) return;
// Removed: the broad "preserve manual edits" skip.
// Manual edits are now protected exclusively by locking.
// This allows auto-save to refresh stored values when drivers/weights change,
// keeping forecast_entries in sync with the live calculation engine.
```

### Files to change
- `src/components/financial/ForecastDrawer.tsx` — remove the over-broad `manualEditableMetrics` skip (lines ~846–850), keeping only the `is_locked` guard

This ensures the DB always reflects the current drawer calculation, so the Financial Summary Q1 Target matches the Forecast Results Q1 Avg exactly.
