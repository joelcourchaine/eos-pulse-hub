
## Even Distribution for Total Fixed Expense in Forecast

### Problem
When editing the annual total for "Total Fixed Expense" (or its sub-metrics) in the forecast, the value is distributed across months using weighted proportions (based on GP Net share). Fixed expenses should instead be distributed evenly across all 12 months since they don't fluctuate seasonally.

### Changes

**File: `src/components/financial/ForecastDrawer.tsx`**

1. **`handleMainMetricAnnualEdit` (around line 1355-1372):** Before the weighted distribution logic, add a check for `total_fixed_expense` and `semi_fixed_expense`. If the metric key matches, distribute evenly (value / 12) instead of using weights. This is a simple early-return branch similar to the existing special handling for `gp_percent`, `sales_expense_percent`, etc.

2. **`handleSubMetricEdit` (around line 945):** This function stores an `overriddenAnnualValue` and the calculation engine distributes it. Need to check `useForecastCalculations.ts` to see how sub-metric overrides are distributed monthly.

**File: `src/hooks/forecast/useForecastCalculations.ts`**

Check how sub-metric overrides with `overriddenAnnualValue` are distributed to monthly values. If they use weights or baseline proportions, update the logic for sub-metrics whose `parentKey` is `total_fixed_expense` (or `semi_fixed_expense`) to use even distribution (value / 12) instead.

### Technical Details

For the parent metric in `handleMainMetricAnnualEdit`:
```text
// Before the weighted distribution block:
if (metricKey === 'total_fixed_expense' || metricKey === 'semi_fixed_expense') {
  const monthlyValue = newAnnualValue / 12;
  const updates = weights.map(w => ({
    month: `${forecastYear}-${String(w.month_number).padStart(2, '0')}`,
    metricName: metricKey,
    forecastValue: monthlyValue,
  }));
  await bulkUpdateEntries.mutateAsync(updates);
  await queryClient.invalidateQueries(...);
  markDirty();
  return;
}
```

For sub-metrics in `useForecastCalculations.ts`, the same even-distribution logic applies when the override's `parentKey` is `total_fixed_expense` or `semi_fixed_expense`.

### Files to Modify
1. `src/components/financial/ForecastDrawer.tsx` -- Add even-distribution branch for total_fixed_expense/semi_fixed_expense in `handleMainMetricAnnualEdit`
2. `src/hooks/forecast/useForecastCalculations.ts` -- Update sub-metric override distribution for fixed expense sub-metrics to use even split instead of weighted/proportional
