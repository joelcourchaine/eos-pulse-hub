
## Root Cause

The previous fix applied ratio-aware aggregation (`sum(num) / sum(den)`) in only **one of three places** that calculate quarterly percentage targets from `forecast_entries`. The other two still use simple averages, which is why Stellantis (and all other brands) show mismatched values in those views.

The three locations are:

```text
1. Q1 Target cell (~line 4608)         ← FIXED (ratio-aware)
2. TrendCellTooltip (~line 2436)       ← BROKEN (simple average)  — "Forecast" hover tooltip
3. Quarter trend columns (~line 4292)  ← BROKEN (simple average)  — preceding Q1/Q2/Q3/Q4 cells
```

## Fix

### Step 1 — Extract RATIO_METRICS to module level (~line 132)

Move the constant out of the inline IIFE so all three locations share one definition:

```ts
const RATIO_METRICS: Record<string, { num: string; den: string }> = {
  sales_expense_percent:       { num: 'sales_expense',    den: 'gp_net'       },
  gp_percent:                  { num: 'gp_net',           den: 'total_sales'  },
  semi_fixed_expense_percent:  { num: 'semi_fixed_expense', den: 'gp_net'     },
  total_fixed_expense_percent: { num: 'total_fixed_expense', den: 'gp_net'    },
  return_on_gross:             { num: 'department_profit', den: 'gp_net'      },
};
```

### Step 2 — Extract a shared helper function

Add a `calcRatioAwareForecast(metricKey, qtrMonthIds, getForecastTarget)` function that handles both ratio and non-ratio cases, returning `{ value, isForecast }`.

### Step 3 — Fix `TrendCellTooltip` (~lines 2436–2442)

Replace the simple average with the ratio-aware helper. The tooltip's "Forecast" row will then show the correct weighted percentage.

### Step 4 — Fix quarter trend columns (~lines 4292–4304)

Replace the simple average fallback with the ratio-aware helper. This fixes the preceding Q1/Q2/Q3/Q4 column values for percentage metrics across all brands (Stellantis, Ford, GMC, etc.).

### Step 5 — Simplify Q1 Target cell (~lines 4608–4636)

Replace the inline IIFE logic with the shared helper (removes the duplicate RATIO_METRICS definition there too).

### Files to change
- `src/components/financial/FinancialSummary.tsx` — extract shared helper, fix all 3 calculation sites
