

# Default to Weekly & Remove Legacy Trend Navigation

## Changes

### 1. Default viewMode to "weekly"
In `Dashboard.tsx` (line 111), change the initial state from `"monthly"` to `"weekly"` so the scorecard loads in weekly view by default.

### 2. Remove the trend pills row from ScorecardGrid
The row shown in your screenshot (with year arrows, Q Trend, M Trend, Q1-Q4 buttons) at lines 3642-3654 in `ScorecardGrid.tsx` will be removed entirely. This row only appears when `isQuarterTrendMode` or `isMonthlyTrendMode` is active -- both are now redundant since "Quarterly" and "Yearly" viewModes replace them.

### 3. Remove the PeriodNavigation between Scorecard and Financial Summary
In `Dashboard.tsx` (lines 1532-1544), there is a `PeriodNavigation` component rendered between the scorecard card and the financial summary. This will be removed since the year selector and quarter pills are already in the scorecard's own top bar.

### 4. Clean up dead trend mode code
Since Q Trend (`quarter=0`) and M Trend (`quarter=-1`) are no longer reachable from any UI button:
- The `isQuarterTrendMode` and `isMonthlyTrendMode` guards scattered throughout the file become dead code. We will leave them in place for now as safety nets (they cost nothing at runtime) but can be cleaned up in a future pass.

## Files Changed
- `src/pages/Dashboard.tsx` -- default viewMode to "weekly", remove PeriodNavigation
- `src/components/scorecard/ScorecardGrid.tsx` -- remove trend pills row

