

# Scorecard Condensed Visual Fix

## Problem
The previous changes only partially applied the condensed styling. There are 45 remaining instances of `min-w-[125px]` in the file, and the owner header row week cells still use the old wide sizing. The table doesn't match the tight, spreadsheet-like density of the GO Scorecard reference.

## Changes (single file: `src/components/scorecard/ScorecardGrid.tsx`)

### 1. Fix owner header row week cell width
Line 3945: Change `min-w-[125px]` to `min-w-[90px]` in the owner header's weekly cells so they align with the data columns.

### 2. Bulk-update all remaining `min-w-[125px]` to `min-w-[90px]`
There are ~45 instances across monthly trend headers, quarter trend headers, monthly data cells, and previous-year month columns. All should be changed to `min-w-[90px]` and their corresponding `max-w-[125px]` to `max-w-[90px]` to create uniform, compact columns throughout all view modes.

### 3. Reduce row height and padding further
- Owner header rows: reduce `py-1` to `py-0.5`
- KPI name cells: tighten vertical padding
- Remove the status count badges from week headers (the 4 colored pills with counts) — these add visual noise and vertical height that the reference image doesn't have
- Reduce the header drop zone padding from `py-1` to `py-0.5`

### 4. Tighter KPI name column
Reduce from `w-[200px]` to `w-[170px]` to match the reference more closely and reclaim horizontal space for week columns.

### 5. Clean header styling
- Remove the colored status count badges from each week header (lines 3683-3697) — these don't exist in the reference and add ~15px of vertical height per header
- Make the "WK N" + date range more compact

## Technical Notes
- All changes are in `src/components/scorecard/ScorecardGrid.tsx`
- No database or dependency changes needed
- Dark mode variants will be preserved
- Monthly and trend views will also benefit from the width reduction
