
## What's different

The weekly view cells use specific Tailwind color tokens (`bg-emerald-100 dark:bg-emerald-900/40`, `text-emerald-800 dark:text-emerald-200`) and `text-xs` font size. All other views use CSS variable-based classes (`bg-success/10`, `text-success`, etc.) and larger/default text sizes. This causes visible color and font inconsistency when switching modes.

## Fix — `src/components/scorecard/ScorecardGrid.tsx`

Replace all non-weekly status color classes to match the weekly pattern exactly. Four affected rendering blocks:

**1. Monthly view cells (lines ~4502–4521)**
- `bg-success/10` → `bg-emerald-100 dark:bg-emerald-900/40`
- `bg-warning/10` → `bg-amber-100 dark:bg-amber-900/40`
- `bg-destructive/10` → `bg-red-100 dark:bg-red-900/40`
- `text-success` → `text-emerald-800 dark:text-emerald-200`
- `text-warning` → `text-amber-800 dark:text-amber-200`
- `text-destructive` → `text-red-800 dark:text-red-200`
- Add `text-xs` to the display div

**2. Yearly view — previous year months (lines ~5020–5033)**
- Same color replacements above
- Add `text-xs` to the span

**3. Yearly view — previous year Q avg (lines ~5044–5096)**
- Same color replacements above

**4. Quarterly trend view cells (lines ~4691–4710) and Q view cells (lines ~4750–4769)**
- Same color replacements above
- Add `text-xs` to the value spans

Single file change, no logic touched.
