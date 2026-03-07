
## Root Cause

The Forecast Results Grid **sums** monthly dollar values to get quarterly totals (e.g., Jan + Feb + Mar = Q1). But the Financial Summary's Q1 Target column **averages** those same monthly values — giving roughly 1/3 of the correct quarterly number for dollar metrics. This affects both parent metric rows and sub-metric rows.

Three files have this bug:

```text
FinancialSummary.tsx line 184-185  — calcRatioAwareForecast() averages non-ratio metrics
SubMetricsRow.tsx   line 730-733   — sub-metric Q1 target averages monthly forecast
SubMetricsRow.tsx   line 282-285   — sub-metric quarter tooltip averages monthly forecast
SubMetricsRow.tsx   line 942-946   — sub-metric quarter-trend column averages monthly forecast
```

For **percentage ratio metrics** (e.g., `sales_expense_percent`), the current ratio-aware logic (`sum(num)/sum(den)`) is already correct — that stays unchanged.

For **dollar/currency metrics** (e.g., `total_sales`, `gp_net`, `total_fixed_expense`), the fix is simple: **sum** the 3 monthly values instead of averaging them.

## Changes

### 1. `FinancialSummary.tsx` — `calcRatioAwareForecast` fallback (~line 184)

```ts
// BEFORE (wrong — averages 3 months):
if (vals.length > 0) return { value: vals.reduce((s, v) => s + v, 0) / vals.length, isForecast: true };

// AFTER (correct — sums 3 months like the Forecast Results Grid):
if (vals.length > 0) return { value: vals.reduce((s, v) => s + v, 0), isForecast: true };
```

This fixes all 3 call sites in `FinancialSummary.tsx` (Q1 Target cell, quarter trend columns, and the TrendCellTooltip) in one change.

### 2. `SubMetricsRow.tsx` — 3 inline average calculations

**Q1 Target cell (~line 730-733):**
```ts
// BEFORE:
if (fVals.length > 0) forecastQuarterAvg = fVals.reduce((s, v) => s + v, 0) / fVals.length;
// AFTER:
if (fVals.length > 0) forecastQuarterAvg = fVals.reduce((s, v) => s + v, 0);
```

**Quarter tooltip (~line 282-285):**
```ts
// BEFORE:
if (fVals.length > 0) forecastValue = fVals.reduce((s, v) => s + v, 0) / fVals.length;
// AFTER:
if (fVals.length > 0) forecastValue = fVals.reduce((s, v) => s + v, 0);
```

**Quarter trend column (~line 942-946):**
```ts
// BEFORE:
if (forecastValues.length > 0) qtrForecastTarget = forecastValues.reduce((s, v) => s + v, 0) / forecastValues.length;
// AFTER:
if (forecastValues.length > 0) qtrForecastTarget = forecastValues.reduce((s, v) => s + v, 0);
```

### Files to change
- `src/components/financial/FinancialSummary.tsx` — 1 line changed in `calcRatioAwareForecast`
- `src/components/financial/SubMetricsRow.tsx` — 3 lines changed (Q1 target, tooltip, quarter trend column)
