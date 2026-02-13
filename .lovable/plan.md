

## Fix: Stale Data After Clearing Scorecard Period

### Problem
After clearing a month's scorecard data, the UI continues showing stale values (like CP ELR $163.72) until the page is refreshed. The database delete succeeds, but the local React state still holds the old values.

### Root Cause
The `handleClearPeriodData` function in `ScorecardGrid.tsx` only clears the `entries` state. However, the display logic checks **three** data sources in priority order:

1. `localValues[key]` (highest priority -- user edits in progress)
2. `entries[key]?.actual_value` (fetched data)
3. `precedingQuartersData[mKey]` (fallback for monthly views)

Since `localValues` and `precedingQuartersData` are not cleared, the UI falls back to stale values from those sources.

### Fix
Update the `handleClearPeriodData` success block (around line 2946) to also clear matching keys from `localValues` and `precedingQuartersData` alongside `entries`.

### Technical Details

**File: `src/components/scorecard/ScorecardGrid.tsx`** (lines ~2946-2958)

After the existing `setEntries` cleanup, add:

- **Clear `localValues`**: Remove all keys matching the cleared period pattern (same pattern used for entries).
- **Clear `precedingQuartersData`**: For month clears, remove matching `{kpiId}-M{monthNum}-{year}` keys for all KPIs in the current view. This prevents the display from falling back to the quarterly aggregation cache.

The key patterns:
- `entries` / `localValues` use: `{kpiId}-month-{YYYY-MM}` for months, `{kpiId}-{weekDate}` for weeks
- `precedingQuartersData` uses: `{kpiId}-M{monthNumber}-{year}` for individual months

Both `localValues` and `precedingQuartersData` will be cleared using the same identifier-based matching already used for `entries`.
