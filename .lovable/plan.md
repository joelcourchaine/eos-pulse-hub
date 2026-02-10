

## Save Sub-Metric Forecasts on Drawer Open

### Problem
The auto-save code added in the last change correctly includes sub-metric forecast values, but it only fires when `isDirtyRef.current = true` -- which only happens when the user actively changes a driver or weight. Simply opening the forecast drawer computes sub-metric values but never persists them because nothing is "dirty."

### Fix
Add a one-time effect in `ForecastDrawer.tsx` that runs after sub-metric forecasts are first computed. It checks whether any sub-metric forecast entries are missing from the database and, if so, marks the forecast as dirty to trigger the existing auto-save loop.

### Changes

**File: `src/components/financial/ForecastDrawer.tsx`**

Add a new `useEffect` that:

1. Runs when the drawer is open, the forecast exists, drivers are initialized, and `subMetricForecasts` has entries
2. Uses a ref (e.g., `subMetricSeedCheckedRef`) to ensure it only runs once per drawer open session
3. Checks if any sub-metric keys from `subMetricForecasts` are missing from `entries`
4. If missing entries are found, calls `markDirty()` to trigger the existing auto-save debounce

Reset the ref when the drawer closes (when `open` changes to false).

```text
Pseudocode:

const subMetricSeedCheckedRef = useRef(false);

// Reset when drawer closes
useEffect(() => {
  if (!open) subMetricSeedCheckedRef.current = false;
}, [open]);

// Check once after forecasts are ready
useEffect(() => {
  if (!open || !forecast || !driversInitialized.current) return;
  if (subMetricSeedCheckedRef.current) return;
  if (!subMetricForecasts || subMetricForecasts.size === 0) return;
  
  subMetricSeedCheckedRef.current = true;
  
  // Check if any sub-metric forecast values are missing from entries
  let hasMissing = false;
  subMetricForecasts.forEach((forecasts) => {
    forecasts.forEach((sub) => {
      sub.monthlyValues.forEach((value, month) => {
        if (value === null || isNaN(value)) return;
        const exists = entries?.some(
          e => e.metric_name === sub.key && e.month === month
        );
        if (!exists) hasMissing = true;
      });
    });
  });
  
  if (hasMissing) markDirty();
}, [open, forecast, subMetricForecasts, entries]);
```

### No Other Changes Needed

- The existing auto-save loop already handles persisting sub-metric values
- The existing `useForecastTargets` hook already reads all `forecast_entries` including sub-metric keys
- The existing `getForecastTarget` callback in `FinancialSummary.tsx` already matches sub-metric keys

### How It Works

1. User opens the Forecast Drawer for a department
2. Sub-metric forecasts are computed from baseline data
3. The new effect detects that no sub-metric entries exist in the database yet
4. It sets `isDirtyRef.current = true`
5. The existing auto-save loop fires after 800ms debounce
6. Sub-metric forecast values are persisted to `forecast_entries`
7. User closes the drawer and views Financial Summary
8. `useForecastTargets` picks up the new sub-metric entries
9. Visual cues (green/yellow/red) appear on sub-metric rows

### Files to Modify
1. `src/components/financial/ForecastDrawer.tsx` -- Add seed-check effect to trigger initial save of sub-metric forecasts
