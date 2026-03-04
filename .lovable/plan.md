
## Fix: Add missing Q-Total spacer cells to weekly owner header rows

**Root cause:**

When we removed the Trend column, the column count in weekly view data rows is:
- Header row: KPI + Target + 13 weeks + Q Total = **16 columns**
- Owner header row (line 4215-4232): KPI + Target + 13 weeks = **15 columns** (missing Q-Total spacer)
- Totals owner header row (line 5452-5459): KPI + Target + 13 weeks = **15 columns** (missing Q-Total spacer)

This colSpan mismatch causes the HTML table to misalign cells in the weekly view, pushing data cells into wrong visual columns or making them appear blank/hidden.

**Fix — `src/components/scorecard/ScorecardGrid.tsx`:**

| Location | Change |
|---|---|
| ~Line 4231 (inside weekly owner header `<>` block, after `weeks.map`) | Add a `<TableCell className="bg-muted/50 py-0 min-w-[80px]" />` Q-Total spacer |
| ~Line 5457 (inside weekly Totals owner header `<>` block, after `weeks.map`) | Add a `<TableCell className="bg-[hsl(222,47%,18%)] dark:bg-[hsl(222,47%,22%)] py-1 min-w-[80px]" />` Q-Total spacer |

Two `<TableCell>` additions — that's it.
