

# Fix: Sub-Metric Percentages Missing in YoY Comparison (Previous Year Column)

## Problem
When viewing the Enterprise Year-over-Year comparison for percentage-based sub-metrics (e.g., Sales Expense % sub-items like SALARIES-SUPERVISION, TAXES-PAYROLL, etc.), the "LY" (Last Year) column shows "N/A" and the Diff column shows "-", even though current year values display correctly.

## Root Cause
The percentage sub-metric synthesis logic only processes **current year** data. Previous year data stored in `comparisonMap` contains raw dollar-based sub-metrics (e.g., `sub:sales_expense:001:SALARIES-SUPERVISION`) but these are never converted into their percentage equivalents (e.g., `sub:sales_expense_percent:SALARIES-SUPERVISION`). When the synthesized current-year entry looks up its comparison value, it finds nothing.

## Solution
After synthesizing the current-year percentage sub-metrics, perform the same percentage calculation on the previous year comparison data:

1. For each synthesized percentage sub-metric selection, look up the corresponding dollar-based numerator sub-metric and denominator from the previous year data in `comparisonMap` (or `prevYearByDept` / `prevYearAvgData` aggregations)
2. Calculate the percentage value: `(numerator_sub_dollar / denominator_total) * 100`
3. Store the result in `comparisonMap` using the selection ID key so it gets picked up as the `target` value
4. Recalculate variance between current and previous year percentage values

## Technical Details

**File:** `src/pages/DealerComparison.tsx`

**Change location:** After the current-year percentage sub-metric synthesis block (around line 1698), add a matching synthesis pass for the comparison data.

The new code will:
- Iterate over `percentSubSelections` (already computed) for each department
- For each selection, find the matching raw numerator sub-metric in `comparisonMap` (trying all possible order-index variants like `sub:sales_expense:000:NAME`, `sub:sales_expense:001:NAME`, etc.)
- Find the denominator value (either a matching sub-denominator or the parent denominator total) from `comparisonMap`
- Calculate the percentage and store it under the selection ID key in `comparisonMap`
- Update the synthesized `dataMap` entries with the new `target` value and compute `variance`

This approach mirrors the exact same synthesis logic used for current-year data, ensuring parity between the two columns. All three comparison modes (YoY, Previous Year Average, Previous Year Quarter) will benefit since they all populate `comparisonMap` the same way.

