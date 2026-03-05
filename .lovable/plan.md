
## What Needs to Change

Looking at the screenshot and user requests:

1. **Remove per-owner Σ Totals rows** — delete the per-owner "Σ Totals" row that appears after each technician's KPI group
2. **Add ONE overall weekly totals row at the bottom** — a single `Σ Totals` row after ALL owners, showing the sum of all values per week column + Q-Total (matching the UI's bottom totals strip)
3. **Remove the 30% Green Rate badge** from the navy header — just keep store/dept name, period, weeks entered
4. **Shrink the table** — reduce font size (9px from 11px), reduce cell padding to be more compact so more columns fit and the Q-Total column with technician names is visible
5. **Fix the legend** — replace `display: flex` with a table-based layout (email client incompatible), so the legend renders on one row without overlapping

### Specific Changes in `supabase/functions/send-scorecard-email/index.ts`

**Line 623** — `baseFontSize`: Change weekly mode font from `11px` to `9px` to shrink the table

**Lines 680-684** — Header badges: Remove the green rate `<td>` cell, keep only store/title and weeks entered

**Lines 719-788** — Weekly tbody loop:
- Remove the per-owner Σ Totals row block (lines 780-788)
- Instead accumulate into **global** week totals across all owners
- After the `forEach` loop closes (`Array.from(kpisByOwner.entries()).forEach`), add ONE overall Σ Totals row

**Lines 1386-1394** — Legend footer: Replace `display: flex` container with a `<table>` layout using inline cells

### Change summary
- `baseFontSize` for weekly: `"11px"` → `"9px"`
- Header: remove the green rate `<td>` (3rd column)
- tbody: accumulate global totals across all owners, remove per-owner totals, add single overall totals row at bottom
- Legend: fix with table layout
