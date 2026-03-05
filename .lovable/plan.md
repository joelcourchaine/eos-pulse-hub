
## Problem

Lines 5555–5562 of `ScorecardGrid.tsx` compute `productiveTarget` using a two-step fallback:

1. **First priority**: a manually saved target for the first Productivity KPI that has one in `kpiTargets`
2. **Fallback**: average of all individual technician productivity targets (from `kpiTargets` or `kpi.target_value`)

The user wants step 2 eliminated entirely. If no manual Totals-level productivity target has been explicitly saved by the user, the target should be `null` — meaning no coloring applied to the totals Productivity row.

## Root Cause

```ts
// Lines 5555-5562 — current (bad) fallback
const productiveTarget = productivityKpiWithTarget
  ? kpiTargets[productivityKpiWithTarget.id]
  : productiveKpis.length > 0
    ? productiveKpis.reduce((acc, k) => acc + (kpiTargets[k.id] || k.target_value || 0), 0) / productiveKpis.length  // ← calculated, unwanted
    : null;
```

## Fix — `src/components/scorecard/ScorecardGrid.tsx` lines 5555–5562

Remove the calculated average fallback. The target should only come from a manually saved `kpi_targets` row — if none exists, it's `null`:

```ts
// Lines 5555-5562 — after fix
const productiveTarget = productivityKpiWithTarget
  ? kpiTargets[productivityKpiWithTarget.id]
  : null; // No fallback to calculated average — must be explicitly set by user
```

This means:
- When no explicit Totals productivity target has been set → target is `null` → `calcProductiveStatus` returns `null` → no color on any cell → just shows the raw percentage
- When the user clicks the target cell and types a value → saves to `kpi_targets` → colors activate normally

## Scope

Single 3-line change in `ScorecardGrid.tsx` at lines 5558–5562. No database changes needed.
