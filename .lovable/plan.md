

# Scorecard Visual Refresh — Inspired by GO Scorecard

## Overview
Restyle the existing weekly scorecard view to match the denser, more colorful aesthetic shown in the reference image. The current scorecard already has all the required functionality — this is purely a visual/styling update.

## Phase 1: Cell Color Saturation and Density (Highest Impact)

### Stronger cell background colors
Currently cells use light tints like `bg-success/10`, `bg-warning/10`, `bg-destructive/10`. Update to more saturated fills:
- Green (at/above target): `bg-emerald-100 dark:bg-emerald-900/40` with `text-emerald-800 dark:text-emerald-200`
- Yellow/Orange (within 10%): `bg-amber-100 dark:bg-amber-900/40` with `text-amber-800 dark:text-amber-200`
- Red (below target): `bg-red-100 dark:bg-red-900/40` with `text-red-800 dark:text-red-200`

### Compact cell sizing
- Reduce `min-w-[125px]` to `min-w-[90px]` for week columns
- Reduce cell padding from `px-1 py-0.5` to `px-0.5 py-0`
- Make input fields more compact (`h-7` instead of `h-8`)

**File:** `src/components/scorecard/ScorecardGrid.tsx` — update cell className strings in the weekly view rendering block (around lines 4350-4500)

## Phase 2: Week Header Labels

### Change from date-only to "WK N" format
Currently headers show `1/5-1/11`. Update to show:
- **Line 1:** `WK 1`, `WK 2`, ... `WK 13`
- **Line 2:** `1/5-1/11` (date range, smaller text)

**File:** `src/components/scorecard/ScorecardGrid.tsx` — update the week header rendering block (around lines 3560-3638). Add week index to the `getWeekDates` return and display `WK {index}` above the date range.

## Phase 3: Quarter Summary Stats Bar

### Add a summary row above the grid
Display key aggregate stats for the selected quarter:
- Quarter label and date range (e.g., "Q1 2026 · 13 weeks · Mon-Sun")
- A primary KPI target total (e.g., "Parts and Labour Target: $X")
- Actual total entered so far
- Progress vs target %
- Current week indicator

This requires:
- Calculating aggregate values from existing `entries` and `kpiTargets` state
- Rendering a new stats bar component between the period navigation and the table

**File:** `src/components/scorecard/ScorecardGrid.tsx` — add a summary stats section before the `<Table>` element (around line 3440)

## Phase 4: Quarter Tab Pills

### Replace period navigation with quarter pills
Currently uses chevron-based `PeriodNavigation`. Add quarter tab pills (Q1-Q4) with date ranges below each, styled as outlined/filled buttons. The active quarter gets a filled style.

**File:** `src/components/scorecard/ScorecardGrid.tsx` — add quarter pill buttons above the grid when in weekly view mode (around lines 3430-3445)

## Phase 5: Q TOTAL Column

### Add an aggregated total column
Add a final "Q TOTAL" column after WK 13 that shows:
- For sum-type KPIs: sum of all 13 weeks
- For average-type KPIs: average of weeks with data
- Styled with a distinct background (e.g., slightly darker)

**File:** `src/components/scorecard/ScorecardGrid.tsx` — add a column after the last week in both the header and data rows

## Technical Details

All changes are in a single file: `src/components/scorecard/ScorecardGrid.tsx` (5,269 lines).

### Approach
Each phase modifies different sections of the file:
- **Phase 1:** Cell rendering (~lines 4350-4500 for weekly cells)
- **Phase 2:** Week header rendering (~lines 3560-3638)
- **Phase 3:** New JSX block before `<Table>` (~line 3440)
- **Phase 4:** New JSX block for quarter pills (~line 3430)
- **Phase 5:** Additional column in header + data rows

### Compatibility
- All changes respect the existing dark mode toggle (using Tailwind dark: variants)
- Monthly view and trend views remain unchanged
- No database changes required
- No new dependencies needed

## Suggested Order
Start with Phases 1 and 2 (color saturation + week headers) for the biggest visual impact with the least risk, then layer on Phases 3-5.

