

# Match Target Column Blue to Right Rail Navy

## Problem
The target column in the scorecard grid uses `bg-primary` which resolves to `hsl(217, 91%, 20%)` -- a brighter, more saturated blue. The right side rail uses `hsl(222, 47%, 16%)` -- a darker, desaturated navy. The user wants these to be the same color.

## Solution
Introduce a CSS custom variable `--scorecard-navy` set to the same HSL value used by the right rail (`222 47% 16%`), then replace all target-column `bg-primary` references in `ScorecardGrid.tsx` with this navy color. This keeps the app-wide `--primary` untouched for buttons and other UI elements.

## File Changes

### 1. `src/index.css`
Add a new custom property under `:root` and `.dark`:
- `:root` -- `--scorecard-navy: 222 47% 16%;`
- `.dark` -- `--scorecard-navy: 222 47% 20%;` (slightly lighter for dark mode, matching the rail's dark-mode value)

### 2. `src/components/scorecard/ScorecardGrid.tsx`
Replace all target-column styling that uses `bg-primary` with `bg-[hsl(var(--scorecard-navy))]`, and corresponding border/text classes:

Affected locations (approximately 10-12 instances):
- **Weekly view target header** (~line 3733): `bg-primary` to `bg-[hsl(var(--scorecard-navy))]`
- **Quarterly trend target header** (~line 3772): same swap
- **Yearly view year-avg/year-total headers** (~lines 3786-3787): `bg-primary/10` to `bg-[hsl(var(--scorecard-navy))]/10`, borders similarly
- **Monthly trend selected header** (~line 3856): same pattern
- **Current week highlight** (~line 3891): keep `bg-primary` here since this is a week highlight, not a target column
- **Quarter target/avg headers** (~lines 3998, 4047): `bg-primary/10` to navy equivalent
- **Weekly view target data cells** (~lines 4141, 4199, 4278): `bg-primary` to navy
- **Border colors**: `border-primary/30` to `border-[hsl(var(--scorecard-navy))]/30`
- **Text colors**: `text-primary-foreground` stays as-is (white text works on both blues)

Non-target uses of `bg-primary` (drag-over highlights, current-week highlights, buttons) will remain unchanged.
