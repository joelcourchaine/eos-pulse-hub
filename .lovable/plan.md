
## Problem

In `DealerComparison.tsx`, the `prevYearAvgData` query that fetches the comparison quarter data has two bugs introduced by the QvQ changes:

1. **Guard clause fails**: The query starts with `if (departmentIds.length === 0 || !selectedMonth) return []` — but in QvQ mode `selectedMonth` is `undefined` (we pass `startMonth`/`endMonth` instead), so it returns empty data immediately.

2. **`enabled` condition blocks it**: The query is only enabled when `datePeriodType === "month"` (line 518), but QvQ mode now uses `datePeriodType = "custom_range"`, so the query never fires.

The current data flow:
- Enterprise sends: `datePeriodType = "custom_range"`, `startMonth = "2026-01"`, `endMonth = "2026-03"`, `selectedComparisonQuarter = 1`, NO `selectedMonth`
- DealerComparison receives this correctly — the main `financialEntries` query works fine (custom_range is handled)
- But `prevYearAvgData` bails out because `!selectedMonth` is true and `datePeriodType !== "month"`

## Fix — one file only: `src/pages/DealerComparison.tsx`

### Change 1: Fix the `enabled` condition
```
// Before (line ~518):
enabled: ... && datePeriodType === "month",

// After:
enabled: ... && (datePeriodType === "month" || (comparisonMode === "prev_year_quarter" && datePeriodType === "custom_range")),
```

### Change 2: Fix the guard + year derivation inside the query
When in QvQ mode with `custom_range`, derive `prevYear` from `startMonth` instead of `selectedMonth`:
```ts
// Before:
if (departmentIds.length === 0 || !selectedMonth) return [];
const currentDate = new Date(selectedMonth + '-15');
const prevYear = currentDate.getFullYear() - 1;

// After:
// For QvQ custom_range, derive the year from startMonth
const refMonth = selectedMonth || startMonth;
if (departmentIds.length === 0 || !refMonth) return [];
const currentDate = new Date(refMonth + '-15');
const prevYear = currentDate.getFullYear() - 1;
```

The rest of the `prevYearAvgData` logic already handles `prev_year_quarter` correctly — it uses `selectedComparisonQuarter` to determine which 3 months of `prevYear` to fetch. Once `prevYear` is correctly derived from `startMonth` and the query is unblocked, both quarters will load.

## Files to change

| File | Change |
|------|--------|
| `src/pages/DealerComparison.tsx` | Fix `prevYearAvgData` query: (1) derive year from `startMonth` when `selectedMonth` is absent, (2) update `enabled` condition to allow `custom_range` + `prev_year_quarter` |
