

## Plan: Reduce technician scorecard row height to match Totals rows

The regular KPI data cells contain a `div` with `h-8` (32px) inside each cell, which forces a taller row. The Totals rows skip this wrapper and render values directly with `py-0`, making them more compact.

### Change
**File:** `src/components/scorecard/ScorecardGrid.tsx`

Reduce the inner content height in the regular KPI data cells from `h-8` to `h-5` (20px). This applies to the `div` wrapper inside each weekly data cell (~line 4520) that contains the display value and input. This single change brings the technician KPI rows in line with the compact Totals row height while preserving all functionality (inputs, color coding, context menus).

The same adjustment applies to any other view mode cells (monthly, quarterly, yearly) that use the same `h-8` wrapper pattern.

