
## Fix: Weight Distribution Not Summing to 100%

**Two root causes identified:**

### Bug 1 — Missing normalization in `useWeightedBaseline.ts`
Each month's weight is independently rounded to 2 decimals. The 12 rounded values don't always sum to exactly 100.0 — floating point drift means the total can be 99.99 or 100.01. When these are saved as `initialWeights` during forecast creation, the weights start off slightly wrong and any subsequent manual edits compound the problem.

**Fix:** After calculating all 12 weights in the `useMemo`, add a normalization pass — compute the sum, scale each weight proportionally to 100, round each, then assign the rounding remainder to the largest-weight month so the total is exact.

### Bug 2 — `onUpdateWeight` only saves one month in `ForecastDrawer.tsx`
When a user edits one month's weight, only that single row is written to the database. The `redistributeWeights()` function already exists in `useWeightedBaseline` but is never called from the drawer's update handler. Other months are never adjusted.

**Fix:** In the drawer's `handleUpdateWeight` callback, call `redistributeWeights()` with the current weights to get the full balanced distribution, then save **all months that changed** in parallel using `updateWeight.mutate()`.

---

**Changes — 2 files:**

**`src/hooks/forecast/useWeightedBaseline.ts`**
- At the end of the `calculatedWeights` `useMemo`, add normalization:
  - Sum all weights
  - If sum ≠ 100, scale: each `w.weight = round((w.weight / sum) * 100, 2)`
  - Find largest-weight month, add `(100 - newSum)` to it so total is exactly 100.00

**`src/components/financial/ForecastDrawer.tsx`**
- Find the `handleUpdateWeight` / `onUpdateWeight` handler
- After a user sets a new weight, call `redistributeWeights(mergedWeights, monthNumber, newWeight)` to get all 12 new values
- Loop through the result and call `updateWeight.mutate()` for every month whose `adjusted_weight` changed

No schema changes. No migration. User can reset existing stores via "Reset to Original".
