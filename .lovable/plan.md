
## Problem Analysis

Three distinct issues to fix:

### 1. Wrong Sold Hours data in email totals
The email identifies "Sold Hours" KPIs by `name.includes('sold')`, but the actual KPI is named **"Open and Closed Hours"** (standardized per the codebase memory). This means `weekSoldTotals` is always `null`, making the Sold Hours row and Productivity row show `—` everywhere.

**Fix**: Match the UI logic — sold KPIs are those where `name !== "Available Hours" && name !== "Productivity" && metric_type === "unit"` (same logic as `ScorecardGrid.tsx` line 5491–5494).

### 2. Productivity row — no decimal places
Email renders productivity as `pct.toFixed(1) + '%'`. User wants zero decimals (`Math.round(pct) + '%'`). This applies to all weekly cells AND the Q-Total cell.

### 3. Productivity target cell — manual entry in the UI
Currently the target cell for the Productivity totals row is a read-only display of `productiveTarget` (average of all technicians' productivity targets). The user wants it to be **manually editable inline** — same as the per-KPI target cells already are.

This requires adding an inline input to the Productivity row's Target cell in `ScorecardGrid.tsx`. The value should be stored in component state, and persisted to `kpi_targets` (linked to one of the productivity KPI IDs) when the user presses Enter or blurs.

---

## Files to Change

### A. `supabase/functions/send-scorecard-email/index.ts`
- **Lines 720–721**: Replace `includes('sold')` with UI-matching logic: `k.name !== "Available Hours" && k.name !== "Productivity" && k.metric_type === "unit"`
- **Lines 846, 850**: Change `pct.toFixed(1)` → `Math.round(pct).toString()` for productivity cells (no decimals, no `.0`)

### B. `src/components/scorecard/ScorecardGrid.tsx`
- Add a `productiveTotalTarget` state (initialized from `productiveTarget`)
- In the Productivity row's Target cell (line ~5594–5600): replace the static display with an inline `<Input>` that auto-saves on blur/Enter (same pattern as existing per-KPI inline targets)
- On save, upsert to `kpi_targets` using the first productivity KPI's ID
