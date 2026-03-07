
## Root Cause

In `SubMetricsRow.tsx`, the `quarter-target` period cell (lines 722–750) only displays `quarterlyTargetValue` which comes from `getSubMetricTarget` (manual `financial_targets` DB rows). The `getForecastTarget` prop is passed in but is **never consulted** for the quarter-target column — it's only used for monthly cells and hover tooltips.

The fix is a one-file change: in the `quarter-target` block, compute a forecast average for the quarter (same pattern as monthly cells) and display it when no manual target exists, mirroring exactly what the parent metric rows do.

## Fix — `SubMetricsRow.tsx` lines 722–750

The `quarter-target` block currently looks like:

```ts
if (period.type === 'quarter-target') {
  const isEditing = editingTarget === subMetric.name;
  const orderIndex = subMetric.orderIndex ?? idx;

  return (
    <TableCell ... onClick={() => !isEditing && handleTargetClick(subMetric.name, quarterlyTargetValue)}>
      {isEditing ? (
        <Input ... />
      ) : (
        quarterlyTargetValue !== null ? formatValue(quarterlyTargetValue) : "-"
      )}
    </TableCell>
  );
}
```

Change: before rendering, compute a `forecastQuarterAvg` from `getForecastTarget` across the quarter's months (using `getQuarterMonths`), then use it as a fallback when `quarterlyTargetValue` is null:

```ts
if (period.type === 'quarter-target') {
  const isEditing = editingTarget === subMetric.name;
  const orderIndex = subMetric.orderIndex ?? idx;

  // Forecast fallback: average monthly forecast across the quarter
  let forecastQuarterAvg: number | null = null;
  if (getForecastTarget && getQuarterMonths && quarter && currentYear) {
    const qtrMonthIds = getQuarterMonths(quarter, currentYear);
    const fVals = qtrMonthIds
      .map(mid => getForecastTarget(subMetric.name, mid))
      .filter((v): v is number => v !== null);
    if (fVals.length > 0) forecastQuarterAvg = fVals.reduce((s, v) => s + v, 0) / fVals.length;
  }

  const displayTarget = quarterlyTargetValue ?? forecastQuarterAvg;
  const isForecastTarget = quarterlyTargetValue === null && forecastQuarterAvg !== null;

  return (
    <TableCell
      ...
      onClick={() => !isEditing && handleTargetClick(subMetric.name, quarterlyTargetValue)}
    >
      {isEditing ? (
        <Input ... />
      ) : (
        <span
          className={cn(isForecastTarget && "text-primary/70")}
          title={isForecastTarget ? "From forecast" : undefined}
        >
          {displayTarget !== null ? formatValue(displayTarget) : "-"}
        </span>
      )}
    </TableCell>
  );
}
```

The `getForecastTarget` prop in `SubMetricsRow` already receives the fully-resolved key lookup (with order index padding etc.) via the closure in `FinancialSummary.tsx` lines 5248–5306, so this will Just Work — no changes needed in `FinancialSummary.tsx`.

## Files to change
- `src/components/financial/SubMetricsRow.tsx` — add forecast fallback computation and display in the `quarter-target` block (~lines 722–750)
