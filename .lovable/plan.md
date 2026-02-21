

# Unified Quarterly View with 5-Quarter Rolling Window

## What You'll Get
When you click "Quarterly", the scorecard will instantly show 5 quarter columns -- the 4 previous quarters on the left and the selected quarter on the far right. Switching between Weekly, Monthly, and Quarterly will be instant with no loading spinner, because all the data is pre-loaded.

## How It Works

The quarterly view displays averaged monthly data per quarter. Since monthly entries are already being pre-loaded for the current quarter, we extend this to also pre-load monthly data for the 4 preceding quarters. When you click "Quarterly", we simply compute averages from the already-loaded monthly data -- no new database calls.

## Technical Changes

### File: `src/components/scorecard/ScorecardGrid.tsx`

### 1. Add "quarterly" as a third viewMode
Extend the viewMode state from `"weekly" | "monthly"` to `"weekly" | "monthly" | "quarterly"`. The Quarterly button will call `setViewMode("quarterly")` instead of `onQuarterChange(0)`, so it stays on the same quarter and triggers no data reload.

### 2. Pre-load monthly data for 5 quarters
In `loadScorecardData`, when loading monthly entries, extend the month range to cover not just the current quarter's 3 months but also the 4 preceding quarters' months (15 months total). This data is used to compute quarterly averages on the client side.

Similarly in `loadKPITargets`, fetch monthly targets for all 5 quarters so quarterly target averages can be computed.

### 3. Compute quarterly averages client-side
Add a `useMemo` that derives `quarterlyEntries` from the pre-loaded monthly entries:
- For each KPI and each of the 5 quarters, average the monthly values for that quarter's 3 months
- Store as `{ [kpiId]-Q[q]-[year]: ScorecardEntry }` keyed entries
- These are recomputed instantly when monthlyEntries changes

### 4. Derive active entries/periods from viewMode
Update the `allPeriods` computation:
- `viewMode === "weekly"` -> 13 week columns
- `viewMode === "monthly"` -> 3 month columns (+ previous year months)
- `viewMode === "quarterly"` -> 5 quarter columns (4 preceding + selected)

The selected quarter appears on the far right. The 4 preceding quarters appear to its left, wrapping across year boundaries (e.g., Q2 2026 selected shows Q2 2025, Q3 2025, Q4 2025, Q1 2026, Q2 2026).

### 5. Update the Quarterly button behavior
Change the Quarterly pill from `onClick={() => onQuarterChange(0)}` to `onClick={() => setViewMode("quarterly")}`. If currently in trend mode (quarter=0 or -1), first call `onQuarterChange(1)` to exit trend mode, then set viewMode.

### 6. Keep Q1-Q4 pills and summary strip visible in quarterly mode
The Q1-Q4 pill row and dark navy summary strip will remain visible when in quarterly mode (they currently hide when `isQuarterTrendMode`). Clicking a different quarter pill changes which 5-quarter window is shown.

### 7. Keep Q Trend and M Trend accessible
Move the existing trend mode access (Q Trend, M Trend) into the trend pills row that appears when `isQuarterTrendMode || isMonthlyTrendMode`. Users can still reach these via the trend pills row buttons.

### 8. Summary strip adjustments for quarterly mode
When `viewMode === "quarterly"`, the summary strip shows:
- "Quarters Shown" instead of "Weeks Entered" (showing 5 quarters)
- Progress and status tallies computed from quarterly averages

### 9. Table column rendering for quarterly mode
Add a rendering branch for `viewMode === "quarterly"` in the table header and body:
- Column headers show "Q1 2025", "Q2 2025", etc.
- Cell values show the computed quarterly averages
- Target column shows the averaged monthly target for the selected quarter
- Status colors computed against quarterly targets

## Result
- Switching between Weekly, Monthly, and Quarterly is instant (zero network requests)
- Quarterly shows a 5-quarter rolling window with the selected quarter on the far right
- All three views share the same Q1-Q4 pills, summary strip, and action buttons
- Q Trend and M Trend remain accessible for multi-period trend analysis
