

## Fix: Body Shop Forecast Not Producing Visual Cues

### Root Cause

The Body Shop at Winnipeg Chevrolet stores financial data **exclusively as sub-metrics** (e.g., `sub:total_sales:001:CUST. PAINT LAB`) with no parent-level entries (e.g., `total_sales`). When the Forecast Drawer opens:

1. It queries prior-year data filtering out `sub:` prefixed metrics (line 186 of ForecastDrawer.tsx)
2. This returns an empty array for the Body Shop
3. The initialization effect (line 550) checks `priorYearData.length > 0` -- which is `false`
4. So `driversInitialized.current` is never set to `true`
5. The auto-save effect (line 731) checks `driversInitialized.current` -- which is `false` -- and exits early
6. No forecast entries are ever saved to the database
7. The `useForecastTargets` hook finds 0 entries, so no visual cues appear on the Financial Summary

Additionally, there's a secondary path: saved `driverSettings` could set `driversInitialized = true`, but since the auto-save never ran the first time, no driver settings were ever persisted either.

### Fix

**File: `src/components/financial/ForecastDrawer.tsx`** (lines ~548-577)

Update the driver initialization effect to also trigger when `priorYearData` is an empty array but sub-metric baseline data exists. The sub-metric baselines are already loaded via the `useSubMetrics` hook, and the weighted baseline (`useWeightedBaseline`) already handles summing sub-metrics for weight calculations. The only missing piece is that `driversInitialized` never gets set.

The fix:
- After the existing `priorYearData.length > 0` check, add a fallback: if `priorYearData` is loaded (not undefined) but empty, AND the sub-metric baselines have data, still set `driversInitialized.current = true` and `markDirty()`.
- This allows the auto-save to fire, which will persist the computed forecast values (from the calculation engine that already correctly handles sub-metric-only departments) into `forecast_entries`.

```text
Logic change (pseudocode):

// Existing: only initializes when parent-level data exists
if (priorYearData && priorYearData.length > 0) {
  // ... set baseline expenses ...
  driversInitialized.current = true;
  markDirty();
}

// New: also handle sub-metric-only departments
if (priorYearData && priorYearData.length === 0 && subMetricBaselines.length > 0) {
  driversInitialized.current = true;
  markDirty();
}
```

### Build Error Fix

**Files: `src/hooks/useTrackActivity.ts`, `src/components/admin/AdminLoginChart.tsx`, `src/components/admin/AdminStatsCards.tsx`**

The `activity_log` table exists in the database but was dropped from the auto-generated types file during the last migration's type regeneration. These files already use `as any` casts. The fix is to ensure the type assertions continue working -- the simplest approach is to keep the existing `as any` pattern but cast the `from()` call itself.

### Technical Summary

| File | Change |
|------|--------|
| `src/components/financial/ForecastDrawer.tsx` | Add fallback initialization for sub-metric-only departments |
| `src/hooks/useTrackActivity.ts` | Fix type error on `activity_log` table reference |
| `src/components/admin/AdminLoginChart.tsx` | Fix type error on `activity_log` table reference |
| `src/components/admin/AdminStatsCards.tsx` | Fix type error on `activity_log` table reference |

