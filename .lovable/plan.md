
## Root Cause

`productiveTarget` (line 5558–5560) is computed as:
```typescript
productiveKpis.reduce((acc, k) => acc + (kpiTargets[k.id] || k.target_value || 0), 0) / productiveKpis.length
```
This averages all technician-level Productivity KPI targets. It never reads the manually-entered value saved by `handleProductiveTotalTargetSave`.

`handleProductiveTotalTargetSave` correctly saves the value to `kpi_targets` for the "Productivity" KPI. But `productiveTarget` ignores it, always re-deriving from individual KPI targets.

## Fix

Change how `productiveTarget` is derived:
1. First check if there's a manually saved value in `kpiTargets` for the "Productivity" KPI (the one with `k.name === "Productivity"`)
2. If yes, use it directly (no averaging)
3. If no, fall back to the current average calculation

```typescript
// Lines 5556–5560 — change from:
const productiveKpis = roleFilteredKpis.filter((k) => k.name === "Productivity");
const productiveTarget = productiveKpis.length > 0
  ? productiveKpis.reduce((acc, k) => acc + (kpiTargets[k.id] || k.target_value || 0), 0) / productiveKpis.length
  : null;

// to:
const productiveKpis = roleFilteredKpis.filter((k) => k.name === "Productivity");
const productivityKpiWithTarget = productiveKpis.find((k) => kpiTargets[k.id] != null);
const productiveTarget = productivityKpiWithTarget
  ? kpiTargets[productivityKpiWithTarget.id]
  : productiveKpis.length > 0
    ? productiveKpis.reduce((acc, k) => acc + (kpiTargets[k.id] || k.target_value || 0), 0) / productiveKpis.length
    : null;
```

This ensures: if any Productivity KPI has a manually entered target in `kpiTargets`, that exact value is displayed — no averaging, no recalculation.

## File to Change
- `src/components/scorecard/ScorecardGrid.tsx` lines 5556–5560 only
