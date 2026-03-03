
## Fix: Tooltip instability in Financial Summary cells

### Root Cause
Every tooltip in `FinancialSummary.tsx` wraps itself in its own `<TooltipProvider>`. Radix UI's `TooltipProvider` manages the open/close timing globally — when each cell creates its own provider, the shared "already-open" state is lost as the cursor moves between cells. This causes the tooltip to close and reopen (or just vanish) during cursor movement.

The fix is to:
1. Add a **single `<TooltipProvider>`** high up in the render tree (at the top of the returned JSX) with `disableHoverableContent={false}` and a short `delayDuration` so tooltips stay open while hovering.
2. Remove all the individual `<TooltipProvider>` wrappers from `TrendCellTooltip`, `QuarterTrendCellTooltip`, and the other inline tooltip spots — keep only the inner `<Tooltip>` + `<TooltipTrigger>` + `<TooltipContent>`.

### Affected spots (all in `FinancialSummary.tsx`)
- Lines 2394 + 2414 — `TrendCellTooltip`
- Lines 2449 + 2469 — `QuarterTrendCellTooltip`
- Lines 3658–3667 — trophy icon tooltip in month header
- Lines 3729–3833 — metric name tooltip
- Lines 3734–3748 — rock icon tooltip (nested)
- Lines 4929–5119 — cell value tooltip

### Change
- Strip `<TooltipProvider>` from all 6 locations above (keep only `<Tooltip>`, `<TooltipTrigger>`, `<TooltipContent>`)
- Find the outermost `return (` of the component and wrap it in a single `<TooltipProvider delayDuration={100}>` so all tooltips share one provider
