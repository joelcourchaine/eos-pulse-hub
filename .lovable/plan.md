

## Fix Missing Tooltips on Monthly Trend Cells

### Problem
The `TrendCellTooltip` component wraps **outside** the `TableCell` and `ContextMenu` components. This causes two issues:
1. `TooltipTrigger asChild` requires a single child that can accept a ref. The `ContextMenu` component (used for editable cells like Total Sales, GP Net, Sales Expense) does not forward refs, so the tooltip silently fails to attach.
2. Wrapping outside `TableCell` can break the expected `<tr>` > `<td>` DOM hierarchy.

Sub-metrics are rendered by `SubMetricsRow` which doesn't use `TrendCellTooltip` at all, so they also lack tooltips.

### Solution
Move the tooltip **inside** the table cells, wrapping the displayed content rather than the cell itself.

### Technical Changes

**File: `src/components/financial/FinancialSummary.tsx`**

1. **Refactor `TrendCellTooltip`** to be a content-level wrapper rather than a cell-level wrapper. It will wrap the inner `<span>` or `<div>` content instead of the `<TableCell>`. This means changing its usage from:
   ```text
   <TrendCellTooltip ...>
     <TableCell>...</TableCell>
   </TrendCellTooltip>
   ```
   to:
   ```text
   <TableCell>
     <TrendCellTooltip ...>
       <span>formatted value</span>
     </TrendCellTooltip>
   </TableCell>
   ```

2. **Calculated metric cells** (around line 3633): Move `TrendCellTooltip` from wrapping the `<TableCell>` to wrapping the inner `<span>` that displays the formatted value.

3. **Editable metric cells** (around line 3688): Move `TrendCellTooltip` from wrapping the `<ContextMenu>` to wrapping the display `<div>` inside the cell (the clickable value display around line 3723). This way the tooltip shows on hover over the displayed value, and the input/context menu functionality remains unaffected.

4. **Quarter trend cells** (around line 3963): Apply the same inside-the-cell pattern for `QuarterTrendCellTooltip`.

5. **Sub-metrics**: The `SubMetricsRow` component renders its own cells independently. To add tooltips there, pass `getForecastTarget` and `precedingQuartersData` (or a simpler lookup function) as props to `SubMetricsRow`, and wrap sub-metric cell values with the same tooltip pattern. Sub-metric forecast keys use the format `sub:{parentKey}:{orderIndex}:{name}` and LY keys use `sub:{parentKey}:{orderIndex}:{name}-M{month}-{prevYear}`.

### Scope
- Primary file: `src/components/financial/FinancialSummary.tsx` (restructure tooltip placement)
- Secondary file: `src/components/financial/SubMetricsRow.tsx` (add tooltip support for sub-metric cells in trend views)

