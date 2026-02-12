

## Fix Cell Height Shifting in the Excel Preview Grid

### Problem
When a cell has a KPI mapping, it displays two lines (the value + the mapping label like "-> CP Hours (+2)"). Unmapped cells in the same row only show one line. This causes cells to visually shift as the row height adjusts to accommodate the tallest cell.

### Solution
Give all data cells a consistent minimum height so they don't change size when mapping labels appear or disappear. This is a CSS-only fix in `ExcelPreviewGrid.tsx`.

### Changes

**File: `src/components/admin/scorecard-mapper/ExcelPreviewGrid.tsx`**

1. Add a fixed `min-h-[44px]` to all non-advisor data cells (the `<div>` at line ~381) so every cell reserves space for two lines regardless of content.

2. For the plain text rendering (unmapped cells, line ~462), wrap in a `flex flex-col min-w-0` container matching the mapped cells' structure, so all cells use the same vertical layout.

This ensures every data cell has the same height whether or not it has a mapping label beneath the value.

### Technical Detail

The cell `<div>` around line 381 currently has `p-2 border-r text-sm relative`. We add `min-h-[44px]` to it. The unmapped cell render path (line 461-466) changes from a bare `<span>` to a `<div className="flex flex-col min-w-0">` wrapper for consistency.

