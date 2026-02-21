

# Unified Data Loading for Instant View Switching

## Problem
Switching between Weekly, Monthly, and Quarterly tabs triggers a full data reload (clearing all state and re-fetching from the database). This causes a visible loading spinner and delay every time you toggle views, even though the underlying data for the same quarter is already available.

## Root Cause
The main `useEffect` (line 490) includes `viewMode` in its dependency array. When you click Weekly or Monthly, it:
1. Clears ALL entries, profiles, targets, and user data
2. Sets loading = true (shows spinner)
3. Re-fetches everything from the database
4. Re-renders the entire table

## Solution: Load Both Weekly + Monthly Data Together

Instead of loading only the active view's data, load **both** weekly and monthly entries for the current quarter in a single pass. Switching views then becomes a pure rendering change with zero network requests.

### Changes to `src/components/scorecard/ScorecardGrid.tsx`

### 1. Separate state for weekly and monthly entries
Add a second entries state so both datasets coexist:
- `weeklyEntries` - stores weekly scorecard entries keyed by `{kpiId}-{weekDate}`
- `monthlyEntries` - stores monthly scorecard entries keyed by `{kpiId}-month-{monthId}`
- The existing `entries` state becomes a computed view that points to the active set based on `viewMode`

### 2. Load both datasets in `loadScorecardData`
Modify `loadScorecardData` to always fetch **both** weekly and monthly data for the current quarter (when not in trend mode). This means:
- Fetch weekly entries (`entry_type = 'weekly'`) for the 13 weeks of the quarter
- Fetch monthly entries (`entry_type = 'monthly'`) for the 3 months + 3 previous year months
- Fetch previous year targets (needed for monthly view)
- Store results in `weeklyEntries` and `monthlyEntries` separately

### 3. Remove `viewMode` from the useEffect dependency array
The consolidated useEffect at line 490 will depend on `[departmentId, kpis, year, quarter]` only -- NOT `viewMode`. Changing `viewMode` will no longer trigger any data fetch.

### 4. Derive active entries from viewMode
Replace direct references to `entries` with a computed variable:
```
const activeEntries = isMonthlyTrendMode ? entries
  : isQuarterTrendMode ? entries
  : viewMode === "weekly" ? weeklyEntries
  : monthlyEntries;
```
All rendering code will use `activeEntries` instead of `entries`.

### 5. Keep trend modes unchanged
Quarter Trend (quarter=0) and Monthly Trend (quarter=-1) still use their own dedicated loading paths since they load fundamentally different data ranges. Those paths remain as-is.

### 6. No loading state on view toggle
Since `viewMode` no longer triggers the useEffect, there will be no loading spinner when switching between Weekly and Monthly. The table columns and data simply swap instantly.

## Technical Details

- **Data size**: Loading both weekly (13 weeks x N KPIs) and monthly (6 months x N KPIs) is minimal extra data -- typically under 500 rows total
- **State shape**: Two separate Maps avoid key collisions between weekly keys (`kpiId-2026-01-05`) and monthly keys (`kpiId-month-2026-01`)
- **Saving entries**: The save/upsert functions already check `viewMode` to determine `entry_type` and conflict column, so those remain correct
- **Paste row**: Already checks viewMode for the correct entry_type
- **Quarter pills (Q1-Q4)**: Still trigger a `quarter` change which reloads data -- that's correct since different quarters have different data
- **Summary strip**: Will use `weeklyEntries` directly for week-based stats regardless of active viewMode

## Files Changed
- `src/components/scorecard/ScorecardGrid.tsx` (single file, data layer + dependency array changes only)

