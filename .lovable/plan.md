

# Unify M Trend as "Yearly" View Mode

## Problem
The "M Trend" button currently triggers `onQuarterChange(-1)`, which sets `quarter = -1` and causes a full state clear + data reload. This shows a separate UI row with PeriodNavigation, Q Trend/M Trend toggle, and Q1-Q4 exit buttons (lines 3523-3534). It also hides the dark navy summary strip.

## Solution
Convert M Trend into a fourth `viewMode` called `"yearly"` that works identically to Weekly, Monthly, and Quarterly -- instant switching with pre-loaded data, same UI layout (toggle bar + summary strip + Q1-Q4 pills).

### What "Yearly" shows
- 12 monthly columns for the selected year (Jan-Dec), plus Avg and Total summary columns
- Same data as current M Trend, but pre-loaded so switching is instant

## Technical Changes (single file: `ScorecardGrid.tsx`)

### 1. Extend viewMode to include "yearly"
Change the type from `"weekly" | "monthly" | "quarterly"` to `"weekly" | "monthly" | "quarterly" | "yearly"`.

### 2. Replace "M Trend" button with "Yearly" in the toggle bar
Change the M Trend button (line 3299-3306) from `onClick={() => onQuarterChange(-1)}` to `onClick={() => setViewMode("yearly")}`. Rename label to "Yearly".

### 3. Pre-load yearly data on quarter/department change
In the main `useEffect` (line 545), add a call to a new `loadYearlyViewData()` function that:
- Fetches all 12 months of monthly entries for the selected year (same query M Trend currently does)
- Fetches monthly targets for all 4 quarters of the year
- Computes yearly averages and totals
- Stores results in new state: `yearlyViewEntries`, `yearlyViewTargets`, `yearlyAveragesData`

### 4. Compute yearly periods
Use the existing `getMonthlyTrendPeriods(year)` function (or a simplified version) to generate the 12 month columns + Avg/Total summary columns. Wire this into `allPeriods` when `viewMode === "yearly"`.

### 5. Remove the trend pills row for M Trend
The separate UI row at lines 3523-3534 currently shows when `isQuarterTrendMode || isMonthlyTrendMode`. Since Q Trend is already removed and M Trend is becoming a viewMode, this row will only show for `isQuarterTrendMode` (which is now unreachable from the UI). It can be kept as dead code or removed entirely.

### 6. Show summary strip in yearly mode
The dark navy summary strip (line 3537) currently hides when `isMonthlyTrendMode`. Update the condition so "yearly" viewMode shows the strip with yearly-appropriate labels (e.g., "Year: 2026", "Months Entered: 8/12").

### 7. Render yearly columns in the table
Add rendering branches for `viewMode === "yearly"`:
- Header: 12 month columns (Jan '26, Feb '26, ...) + Avg + Total
- Body: monthly entry values from pre-loaded `yearlyViewEntries`
- Status colors computed against quarter-specific targets from `yearlyViewTargets`

### 8. Remove isMonthlyTrendMode dependencies
Since M Trend mode (quarter=-1) is no longer reachable:
- Remove `isMonthlyTrendMode` checks from `loadKPITargets`, `loadScorecardData`, `loadPrecedingQuartersData`, `calculateYearlyAverages`
- Remove the trend pills row UI (lines 3523-3534) or guard it with just `isQuarterTrendMode`
- Clean up auto-scroll logic for monthly trend (lines 759-780)

## Result
- The toggle bar becomes: **Weekly | Monthly | Quarterly | Yearly**
- All four views switch instantly with no loading spinner
- The UI is consistent across all views (same toggle bar, summary strip, year dropdown, Q1-Q4 pills)
- No separate "trend" navigation row appears

