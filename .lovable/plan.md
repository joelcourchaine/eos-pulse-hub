
# Remove Auto-Scroll-to-Right on Financial Summary Load

## What Changes

Remove the `useLayoutEffect` (lines 700-730) that automatically scrolls the financial summary table to the far right when it loads in monthly trend mode. Also remove the companion `useEffect` (lines 732-737) that resets the scroll flag.

### File: `src/components/financial/FinancialSummary.tsx`

1. **Delete lines 700-737** -- the entire `useLayoutEffect` block that performs the scroll-to-right on load, and the `useEffect` that resets `hasInitialScrolled`.

2. **Clean up refs** -- remove `hasInitialScrolled` and `lastMonthlyColumnRef` if they are no longer used elsewhere (will verify during implementation).

The table will simply load at its natural scroll position (far left), letting users scroll manually to whichever month they want to see.
