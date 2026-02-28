
## Root Cause

The main data loading `useEffect` (line 556–600) has dependencies `[departmentId, kpis, year, quarter]` — `viewMode` is intentionally excluded so switching views is "instant." 

On initial load, `viewMode` defaults to `"weekly"`, so `loadScorecardData` fetches **weekly entries** into `entries`. When the user switches to Monthly, `entries` only contains weekly-keyed data (`{kpi_id}-{week_date}`), so all monthly cells render empty. Yearly works because it has its own pre-loaded `yearlyViewEntries` state.

## Fix

**`src/components/scorecard/ScorecardGrid.tsx`** — two targeted changes:

**1. Pre-load monthly data alongside weekly data on initial load** (inside `loadScorecardData`, in the `else` branch at line 1292, where monthly data is fetched):

The function currently receives `targetsToUse` and calls either the weekly path or monthly path based on `viewMode`. Since `viewMode` is `"weekly"` on the initial load call, monthly data is never fetched into `entries`.

**Solution:** After the initial weekly load completes, also pre-load monthly data for the current quarter into a separate `monthlyEntries` state (similar to how `yearlyViewEntries` is separate), and merge them when rendering Monthly view.

**Actually simpler solution:** In the `loadData` callback inside the `useEffect`, after `loadScorecardData` (which loads weekly data), also call a dedicated `loadMonthlyEntries()` that pre-fetches monthly data for the current quarter into `entries` merged with the weekly data — OR into a new `monthlyViewEntries` state that Monthly/Quarterly views read from instead of `entries`.

**Cleanest approach:** Add a `monthlyViewEntries` state (parallel to `yearlyViewEntries`). Load it in `loadData` alongside `loadYearlyViewData`. When rendering Monthly/Quarterly cells, read from `monthlyViewEntries` instead of `entries`. On save, update both `entries` and `monthlyViewEntries`.

**Changes needed:**
1. Add `const [monthlyViewEntries, setMonthlyViewEntries] = useState<{[key: string]: ScorecardEntry}>({})` state
2. Clear it in the reset block (line 561 area)
3. Add `loadMonthlyViewData()` function that fetches all monthly entries for the current quarter (same logic as the `else` branch in `loadScorecardData`) and populates `monthlyViewEntries`
4. Call `await loadMonthlyViewData()` in `loadData` (line 591 area)
5. In the rendering code for monthly/quarterly cells, use `monthlyViewEntries[key] ?? entries[key]` — this ensures the pre-loaded monthly data is used when `entries` only has weekly data
6. On save (upsert), also update `monthlyViewEntries` the same way `yearlyViewEntries` is updated after a cell edit
