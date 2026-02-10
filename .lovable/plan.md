

## Save Sub-Metric Forecast Values for Use as Targets

### Problem
The forecast system calculates sub-metric values (e.g., individual line items under Total Direct Expenses) but only saves parent-level metrics to `forecast_entries`. The Financial Summary's `useForecastTargets` hook reads from `forecast_entries` to display green/yellow/red indicators, so sub-metrics never get visual cues because their forecast values simply aren't stored.

### Approach
Extend the existing auto-save logic in `ForecastDrawer.tsx` to also persist sub-metric forecast values to `forecast_entries`. Since `useForecastTargets` already queries all entries keyed by `metric_name:month`, once sub-metric values are stored with keys like `sub:total_direct_expenses:010:DATA PROCESSING`, the existing `getForecastTarget` callback in `FinancialSummary.tsx` will pick them up automatically -- no changes needed there.

### Changes

**File: `src/components/financial/ForecastDrawer.tsx`**

In the auto-save effect (around line 687-769), after building updates from `currentMonthlyValues` (parent metrics), also iterate over `subMetricForecasts` and add their monthly values to the updates array.

The sub-metric forecast keys are already in the format `sub:{parentKey}:{orderIndex}:{name}` which matches what the `getForecastTarget` callback in FinancialSummary expects.

```text
After line 744 (after the parent metrics loop):

1. Get the latest subMetricForecasts from a ref
2. For each parent key in subMetricForecasts:
   - For each sub-metric forecast entry:
     - For each month in its monthlyValues:
       - Check if an entry already exists with this key+month
       - If value has changed, add to updates array
```

This needs a new ref to track `subMetricForecasts`:
- Add `latestSubMetricForecastsRef` alongside the existing `latestMonthlyValuesRef`
- Keep it updated in the same `useEffect` that updates `latestMonthlyValuesRef`

**File: `src/hooks/forecast/useForecastCalculations.ts`**

The `SubMetricForecast` interface already has `key` (e.g., `sub:total_direct_expenses:010:DATA PROCESSING`) and `monthlyValues` map. No changes needed here -- the data is already available.

### How It Works End-to-End

1. User opens the Forecast Drawer and adjusts drivers/weights
2. Auto-save fires, now saving both parent metrics AND sub-metric values to `forecast_entries`
3. User closes the Forecast Drawer and views the Financial Summary
4. `useForecastTargets` fetches all `forecast_entries` including sub-metric keys
5. `getForecastTarget` in FinancialSummary matches `sub:parentKey:orderIndex:name` keys
6. Sub-metrics now show green/yellow/red visual cues based on forecast values

### Edge Cases
- Sub-metrics that are synthesized (e.g., sales_expense_percent sub-metrics derived from dollar amounts) will also be saved, providing targets for percentage-type sub-metrics
- The `targetDirection` for sub-metrics will inherit from their parent metric (already handled in the existing `getForecastTarget` callback)
- Existing forecasts will get sub-metric entries on the next auto-save trigger (opening the drawer is sufficient)

### Files to Modify
1. `src/components/financial/ForecastDrawer.tsx` -- Add sub-metric forecast values to the auto-save loop
