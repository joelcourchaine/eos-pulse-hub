

# Fix: Preserve View Mode When Switching Quarters

## Root Cause
On line 1510 of `Dashboard.tsx`, the `ScorecardGrid` has a React `key` that includes the quarter:
```
key={`scorecard-${selectedDepartment}-${selectedYear}-${selectedQuarter}`}
```
When you click a different quarter (Q1, Q2, etc.), the key changes, which **completely remounts** the ScorecardGrid component. This resets its internal `viewMode` state back to `"weekly"` (the default).

## Fix
Two changes are needed:

### 1. Remove quarter and year from the ScorecardGrid key (Dashboard.tsx, line 1510)
Change the key to only include the department:
```
key={`scorecard-${selectedDepartment}`}
```
The ScorecardGrid already handles quarter/year changes internally via its `useEffect` on `[departmentId, kpis, year, quarter]` (line 600), so remounting is unnecessary -- it just causes the viewMode reset.

### 2. Keep "weekly" as the initial default (no change needed)
The initial `useState("weekly")` in both Dashboard.tsx and ScorecardGrid.tsx stays as-is, so the first load defaults to weekly. Since the component no longer remounts on quarter change, the user's selected view mode will persist.

## Files Changed
- `src/pages/Dashboard.tsx` -- remove `selectedYear` and `selectedQuarter` from the ScorecardGrid `key` prop
