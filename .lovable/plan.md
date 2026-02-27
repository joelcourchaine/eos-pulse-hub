
## Plan: Match Financial Summary Visual Style to Scorecard

### Goal
Replace the Financial Summary's CSS-variable-based cell colors (`bg-success/10`, `text-success`) with the same explicit Tailwind color tokens used in the Scorecard (`bg-emerald-100`, `text-emerald-800`, etc.). Also update the "Q Target" column header to use the same dark navy as the scorecard.

### Changes to `src/components/financial/FinancialSummary.tsx`

**1. Cell background & text colors — replace ALL occurrences** (roughly 12–15 spots across monthly trend, quarter trend, standard view, and previous-year month columns):

| Old (CSS variable) | New (matches scorecard) |
|---|---|
| `bg-success/10` | `bg-emerald-100 dark:bg-emerald-900/40` |
| `bg-warning/10` | `bg-amber-100 dark:bg-amber-900/40` |
| `bg-destructive/10` | `bg-red-100 dark:bg-red-900/40` |
| `text-success font-medium` | `text-emerald-800 dark:text-emerald-200 font-medium` |
| `text-warning font-medium` | `text-amber-800 dark:text-amber-200 font-medium` |
| `text-destructive font-medium` | `text-red-800 dark:text-red-200 font-medium` |
| `text-success` (without `font-medium`) | `text-emerald-800 dark:text-emerald-200` |
| `text-warning` | `text-amber-800 dark:text-amber-200` |
| `text-destructive` | `text-red-800 dark:text-red-200` |

**2. Q Target column header** — change from `bg-primary/10 border-x-2 border-primary/30` to `bg-[hsl(var(--scorecard-navy))] text-primary-foreground border-x-2 border-[hsl(var(--scorecard-navy)/0.3)]` to match the scorecard's navy target column.

**3. Legend dots** — update the header legend dots from `bg-green-500 / bg-yellow-500` to `bg-emerald-500 / bg-amber-500` for consistency with scorecard legend (line 3438 & 3442).

**4. Font size on data cells** — scorecard uses `text-xs` on cell content; add `text-xs` to Financial Summary data cells to match. The scorecard cell font size is `text-xs` via the display div class.

All changes are in a single file: `src/components/financial/FinancialSummary.tsx`
