
## Final Confirmed Plan — Ready to Implement

**2 files, no DB changes, no new components.**

### `src/pages/Enterprise.tsx`
1. Add `"2_month" | "3_month"` to `DatePeriodType` union (line 28)
2. Add `addMonths` to date-fns import (line 15)
3. Add two new `<SelectItem>` values to the Date Period select, visible only when `comparisonMode === "year_over_year"` (~line 1334)
4. Add a Starting Month picker UI branch for `2_month`/`3_month` with preview label (~line 1342)
5. Add `dateParams.startMonth`/`endMonth` derivation in the "View Dashboard" onClick for the two new types (~line 1947)
6. Add a `useEffect` to reset `datePeriodType` to `"month"` if the comparison mode changes away from `year_over_year`

### `src/pages/DealerComparison.tsx`
1. Extend `financialEntries` range filter to include `2_month`/`3_month` (~line 170)
2. Update `isMultiMonth` to include `2_month`/`3_month` (line 972)
3. Update `isThreeColumnMode` to include `2_month`/`3_month` (~line 1928)
4. Add range label formatting for `currentColumnLabel`/`comparisonColumnLabel` (~line 1937)
5. Extend `storeDataCompleteness` range filter to include `2_month`/`3_month` (~line 1962)
