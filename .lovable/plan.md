

## Use Forecast Values as Monthly Target Indicators on Financial Summary

### Overview

Currently, the Financial Summary uses quarterly `financial_targets` to determine green/yellow/red status indicators on each cell. This change will add forecast entries as a **per-month** target source, providing much more granular performance indicators. When a forecast exists for the department and year, each monthly cell will be compared against its corresponding `forecast_value` from `forecast_entries` -- including all sub-metrics.

A small visual indicator will show whether the target source is the forecast or a manually set target, so users always know what they're being measured against.

### How It Works

1. When the Financial Summary loads, it will also fetch the `department_forecasts` record for the current department + year
2. If a forecast exists, it fetches all `forecast_entries` for that forecast
3. For each monthly cell, the target lookup order becomes:
   - **First**: Check `financial_targets` for a manually set quarterly target (existing behavior)
   - **Fallback**: Check `forecast_entries` for a `forecast_value` matching that exact month and metric
4. The same variance logic applies: green (on/above target), yellow (within 10%), red (more than 10% off)
5. Sub-metrics follow the same pattern: their forecast entries use `metric_name` values like `sub:total_sales:0:NEW VEHICLES` which already exist in `forecast_entries`

### Visual Indicator

When a cell's status color comes from a forecast (not a manual target), a small icon or label will distinguish it:
- Cells colored by manual targets: no extra indicator (current behavior)
- Cells colored by forecast targets: a subtle "F" badge or forecast icon in the corner of the cell, visible on hover or always-on depending on density
- The target column in quarterly view will show the forecast value with a "(forecast)" label when no manual target exists

### Scope of Changes

**Monthly Trend View** -- Each of the 12 month columns will compare actual vs forecast for that specific month

**Standard Quarterly View** -- Each of the 3 month columns will compare actual vs the forecast value for that specific month (not the quarterly average)

**Quarter Trend View** -- Each quarter will compare the quarterly average of actuals against the quarterly average of forecast values

**Sub-metrics** -- All sub-metric rows (e.g., "NEW VEHICLES" under "Total Sales") will also get status indicators when a matching forecast entry exists

### Technical Details

**Files to modify:**

1. **`src/components/financial/FinancialSummary.tsx`**
   - Add new state: `forecastTargets` -- a Map of `{metricName}:{monthIdentifier}` to `forecast_value`
   - In the data loading phase, query `department_forecasts` for the department + year, then fetch all `forecast_entries` for that forecast
   - Create a helper function `getTargetForMonth(metricKey, monthIdentifier)` that returns `{ value, direction, source: 'manual' | 'forecast' }` by checking manual targets first, then falling back to forecast
   - Update all status calculation blocks (there are ~4 places: monthly trend calculated metrics, monthly trend editable metrics, quarterly view previous-year months, quarterly view current months) to use the new helper
   - For the target column in quarterly view, show forecast value with a visual distinction when no manual target exists
   - Pass forecast target data down to `SubMetricsRow` component

2. **`src/components/financial/SubMetricsRow.tsx`**
   - Accept new prop: `getForecastTarget?: (subMetricName: string, monthId: string) => number | null`
   - In monthly cells, when no sub-metric target exists from `financial_targets`, fall back to the forecast value
   - Apply the same green/yellow/red status coloring to sub-metric cells

**Data query (added to loadData):**
```
-- Step 1: Get forecast for this department + year
SELECT id FROM department_forecasts
WHERE department_id = :departmentId AND forecast_year = :year
LIMIT 1

-- Step 2: Get all forecast entries
SELECT metric_name, month, forecast_value
FROM forecast_entries
WHERE forecast_id = :forecastId
AND forecast_value IS NOT NULL
```

**Target resolution logic:**
```
function getTargetForMonth(metricKey, monthId, metricDefinition):
  // 1. Check manual quarterly targets
  quarter = getQuarterFromMonth(monthId)
  manualTarget = trendTargets[metricKey]?.[`Q${quarter}-${year}`]
  if manualTarget exists and value != 0:
    return { value: manualTarget.value, direction: manualTarget.direction, source: 'manual' }

  // 2. Fall back to forecast
  forecastValue = forecastTargets.get(`${metricKey}:${monthId}`)
  if forecastValue exists:
    return { value: forecastValue, direction: metricDefinition.targetDirection, source: 'forecast' }

  return null
```

**Visual indicator:** When `source === 'forecast'`, the cell will show a small "F" indicator (using a tiny badge or superscript) in the top-right corner of colored cells to distinguish forecast-sourced indicators from manual target indicators.

### No database changes required
All data comes from existing `department_forecasts` and `forecast_entries` tables.

