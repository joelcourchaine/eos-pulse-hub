
## Fix: Yearly view owner header rows still too tall

**Root cause found:**

The owner header row has two cells that weren't updated in the previous pass:

1. **Line 4221** — Weekly view owner header sticky (target placeholder) cell: `py-1` → should be `py-0`
2. **Line 4251** — Non-weekly views (yearly, monthly, quarterly, trend) owner header colspan cell: `py-1` → should be `py-0`

These `py-1` values are what force the owner header row to be taller than Totals rows, which then makes every KPI row under that owner appear taller due to visual grouping.

The data cells for yearly KPI rows (`py-0` at lines 4323, 4358, 4466, 4524) are already correct — the height is coming purely from the header rows.

**Single file change — `src/components/scorecard/ScorecardGrid.tsx`:**

| Line | Current | Fix |
|---|---|---|
| 4221 | `py-1` (weekly owner header sticky cell) | `py-0` |
| 4251 | `py-1` (yearly/monthly/quarterly owner header colspan) | `py-0` |

That's it — two `py-1` → `py-0` swaps on the owner header filler cells.
