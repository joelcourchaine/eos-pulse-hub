

## Fix: Add LY/Forecast Hover Tooltips for Parent Metrics in Regular Quarter View

### Problem
The regular quarter view (Q1, Q2, Q3, Q4) does not show LY or Forecast hover tooltips on parent metric cells. The Monthly Trend and Quarter Trend views have `TrendCellTooltip` and `QuarterTrendCellTooltip` wrappers, but the regular quarter view renders plain values without any tooltip.

Two issues need fixing:
1. **Missing M-format parent metric data**: The `loadPrecedingQuartersData` non-trend branch stores parent metric values only as quarterly averages (`metricKey-Q{q}-{year}`), not as individual month entries (`metricKey-M{month}-{year}`). The tooltip lookup needs M-format keys.
2. **No tooltip wrapper on cells**: The regular quarter view cell rendering (both previous year months and current year months) does not wrap values with `TrendCellTooltip`.

### Fix (single file: `src/components/financial/FinancialSummary.tsx`)

#### Change 1: Store parent metric M-format values (~line 1890)
In the non-trend branch of `loadPrecedingQuartersData`, before the existing sub-metric M-format storage block, add a loop that stores individual parent metric values per month. For each month in `allMonthIds`, iterate through `FINANCIAL_METRICS` and store the direct database value (or sub-metric sum fallback, or calculated value) as `metricKey-M{month}-{year}`.

```
// Store individual parent metric M-format entries for tooltip lookups
for (const monthId of allMonthIds) {
  const [yrStr, moStr] = monthId.split('-');
  const yr = parseInt(yrStr, 10);
  const mo = parseInt(moStr, 10);

  FINANCIAL_METRICS.forEach(metric => {
    const mKey = `${metric.key}-M${mo}-${yr}`;
    if (averages[mKey] !== undefined) return; // Already set

    if (metric.type === 'percentage' && metric.calculation && 'numerator' in metric.calculation) {
      const { numerator, denominator } = metric.calculation;
      const numKey = `${numerator}-M${mo}-${yr}`;
      const denKey = `${denominator}-M${mo}-${yr}`;
      const numVal = averages[numKey];
      const denVal = averages[denKey];
      if (numVal !== undefined && denVal !== undefined && denVal !== 0) {
        averages[mKey] = (numVal / denVal) * 100;
      }
    } else {
      // Direct value
      const directEntry = data?.find(e => e.month === monthId && e.metric_name === metric.key);
      if (directEntry?.value !== null && directEntry?.value !== undefined) {
        averages[mKey] = Number(directEntry.value);
      } else {
        // Sub-metric sum fallback
        const subPrefix = `sub:${metric.key}:`;
        const subs = data?.filter(e =>
          e.month === monthId &&
          e.metric_name.startsWith(subPrefix) &&
          e.value !== null && e.value !== undefined
        ) || [];
        if (subs.length > 0) {
          averages[mKey] = subs.reduce((s, e) => s + Number(e.value), 0);
        }
      }
    }
  });
}
```

This must run before the percentage synthesis block so that dollar values are available for percentage calculations. Dollar metrics are stored first, then percentages are derived.

#### Change 2: Wrap current year month cells with TrendCellTooltip (~line 4544-4560)
In the current year month rendering section, wrap the cell content with the existing `TrendCellTooltip` component. This will show LY (previous year same month) and Forecast values on hover.

The previous year month cells will NOT get tooltips since their LY data (two years back) is not loaded in the query. This is acceptable behavior -- the primary value of tooltips is on current year data.

#### Change 3: Wrap previous year month cells with TrendCellTooltip (~line 4305-4325)
Optionally add `TrendCellTooltip` to previous year month cells as well. The LY lookup will find nothing (data two years back isn't loaded), but the Forecast value may still be available, making it useful. If neither LY nor Forecast exists, the tooltip simply doesn't render (existing behavior of `TrendCellTooltip`).

### Summary
- Store parent metric M-format values in non-trend `loadPrecedingQuartersData`
- Add `TrendCellTooltip` wrapper to both current year and previous year month cells in regular quarter view
- No new components needed -- reuses existing `TrendCellTooltip`

