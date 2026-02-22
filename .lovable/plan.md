

# Lighten Support Buttons on Dark Right Rail

## Problem
The "Report Issue" and "Request Feature" popup buttons use `variant="secondary"`, which in the dark right rail context blends into the dark navy background and is hard to read.

## Solution
Add explicit light styling to those two buttons so they stand out against the dark sidebar background. Since the right rail is always dark navy (even in light mode), we can use fixed light colors rather than theme-aware classes.

## File Changes

### `src/components/support/FloatingSupportButton.tsx`

- **Line 59** (Report Issue button): Add `bg-white/90 text-slate-800 hover:bg-white` to the className, making the button light with dark text regardless of theme.
- **Line 68** (Request Feature button): Same treatment -- add `bg-white/90 text-slate-800 hover:bg-white`.

This ensures both buttons are clearly visible against the dark navy right rail while keeping the main floating circle button unchanged (it uses the primary color which already contrasts well).

