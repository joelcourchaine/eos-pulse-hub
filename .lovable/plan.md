
## Root Cause

The Financial Summary Q1 Target for `sales_expense_percent` (and other percentage ratio metrics: `gp_percent`, `semi_fixed_expense_percent`, `total_fixed_expense_percent`, `return_on_gross`) uses the wrong aggregation method.

**What it does now:**
- `FinancialSummary.tsx` lines 4608–4618: fetches the 3 monthly `forecast_entries` values for the metric and **averages them** (simple arithmetic mean of percentages).
- This is wrong for ratio metrics — averaging 45.1%, 45.4%, 45.8% gives 45.43% ≈ 45.6%.

**What the Forecast Results Grid does:**
- `useForecastCalculations.ts` lines 686–692: computes `Q1 sales_expense ÷ Q1 gp_net × 100` — a **weighted ratio** across the quarter.
- This gives 45.2% because the months with higher GP Net pull the ratio down.

The same "naive average of percentages" bug exists in:
1. **Parent metric Q1 Target cell** (`FinancialSummary.tsx` ~line 4608–4618) — already confirmed
2. **SubMetricsRow.tsx** lines 727–733 — same average pattern for sub-metric quarter-target cells

## Fix

For `sales_expense_percent`, `gp_percent`, `semi_fixed_expense_percent`, `total_fixed_expense_percent`, and `return_on_gross`, instead of averaging the monthly percentage values, we must fetch their **numerator and denominator** monthly forecast values and compute the ratio from the quarterly sums.

The mapping is:
| Metric | Numerator key | Denominator key |
|---|---|---|
| `sales_expense_percent` | `sales_expense` | `gp_net` |
| `gp_percent` | `gp_net` | `total_sales` |
| `semi_fixed_expense_percent` | `semi_fixed_expense` | `gp_net` |
| `total_fixed_expense_percent` | `total_fixed_expense` | `gp_net` |
| `return_on_gross` | `department_profit` | `gp_net` |

### Change 1 — `FinancialSummary.tsx` (parent metric Q1 Target, ~lines 4608–4618)

Replace the simple average with a ratio-aware calculation:

```ts
// BEFORE:
const forecastVals = qtrMonths.map((mid) => getForecastTarget(metric.key, mid)).filter(...)
displayTarget = forecastVals.reduce((s, v) => s + v, 0) / forecastVals.length;

// AFTER:
const RATIO_METRICS: Record<string, { num: string; den: string }> = {
  sales_expense_percent: { num: 'sales_expense', den: 'gp_net' },
  gp_percent:            { num: 'gp_net',         den: 'total_sales' },
  semi_fixed_expense_percent: { num: 'semi_fixed_expense', den: 'gp_net' },
  total_fixed_expense_percent: { num: 'total_fixed_expense', den: 'gp_net' },
  return_on_gross:       { num: 'department_profit', den: 'gp_net' },
};
const ratioSpec = RATIO_METRICS[metric.key];
if (ratioSpec) {
  const numSum = qtrMonths.reduce((s, mid) => s + (getForecastTarget(ratioSpec.num, mid) ?? 0), 0);
  const denSum = qtrMonths.reduce((s, mid) => s + (getForecastTarget(ratioSpec.den, mid) ?? 0), 0);
  if (denSum > 0) { displayTarget = (numSum / denSum) * 100; isForecastTarget = true; }
} else {
  // Non-ratio: simple average (currency/number metrics)
  const forecastVals = qtrMonths.map(...).filter(...)
  displayTarget = forecastVals.reduce(...) / forecastVals.length;
  isForecastTarget = true;
}
```

### Change 2 — `SubMetricsRow.tsx` (sub-metric quarter-target, lines 727–733)

Sub-metrics under percentage parent metrics are dollar amounts (the numerator), so their quarter-target average is correct. No change needed here — the mismatch only affects the **parent metric row** percentage display.

### Files to change
- `src/components/financial/FinancialSummary.tsx` — replace simple average with ratio-aware aggregation in the Q1 Target cell for percentage metrics (~lines 4608–4618)
