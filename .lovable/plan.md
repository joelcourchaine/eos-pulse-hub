

## Allow Direct Cell-to-KPI Mapping Without Pre-Selecting an Advisor

### Problem
Currently, you must click on an advisor row first to "select" them as the KPI owner before any data cells become clickable. This is unnecessary because the KPI mapping is always the same relative position from any advisor's row -- column X at offset Y always maps to the same KPI.

### Solution
Remove the requirement to select an advisor first. Make all data cells directly clickable. When you click a cell, the system will automatically determine which advisor "owns" that row (based on proximity to the nearest advisor row above it) and calculate the relative offset. The mapping dialog will open immediately.

### Changes

**1. `ExcelPreviewGrid.tsx` -- Make data cells always clickable**

- Remove the `canClickCells` guard so data cells are clickable regardless of whether an owner is pre-selected.
- The click handler will fire for any non-header, non-advisor, non-date cell.
- Add hover/cursor styles to indicate clickability.

**2. `ScorecardVisualMapper.tsx` -- Auto-resolve the owner on cell click**

- When `handleCellClick` fires, automatically determine the owning advisor from the clicked row's position (find the nearest advisor row above it).
- Look up that advisor's `userId` from `userMappings`.
- If the advisor is mapped to a user, auto-set `selectedKpiOwnerId` to that user and open the KPI mapping dialog.
- If the advisor is NOT yet mapped to a user, show a toast saying "Please map this advisor to a user first" and open the user mapping popover for that advisor row instead.
- Update `handleCellKpiMappingSave` to use the auto-resolved owner rather than requiring it to be pre-set.

**3. `CellKpiMappingPopover.tsx` -- Show the auto-resolved advisor name**

- The dialog already accepts an `advisorName` prop -- no structural changes needed here, just ensure the correct name is passed through.

**4. Pass `canClickCells={true}` always (or remove the prop)**

- In the `ExcelPreviewGrid` usage within `ScorecardVisualMapper.tsx`, change `canClickCells={!!selectedKpiOwnerId}` to `canClickCells={true}` so cells are always interactive.

### User Experience After This Change

1. Upload a report as usual.
2. Click any numeric cell in the grid -- the KPI mapping dialog opens immediately.
3. The system automatically knows which advisor owns that row and calculates the offset.
4. If the advisor hasn't been linked to a user yet, you'll be prompted to do that first.
5. Once mapped, the template applies to all advisors automatically (existing behavior preserved).

### Files Modified
- `src/components/admin/scorecard-mapper/ScorecardVisualMapper.tsx` -- Auto-resolve owner in `handleCellClick`, pass `canClickCells={true}`
- `src/components/admin/scorecard-mapper/ExcelPreviewGrid.tsx` -- Minor: add hover styles for always-clickable data cells

