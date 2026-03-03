
## Fix: Quarter average cells in Σ Totals monthly view

Two hardcoded `-` cells need to be replaced with computed values:

### Line 5822 — Previous year quarter average
Compute across `previousYearMonths` using the same avail/sold/productive logic as the per-month cells above it (lines 5798–5820).

### Line 5860 — Current quarter average
Compute across `months` (current quarter) using the same logic as lines 5828–5857.

Both use identical formula:
- **avail**: sum `availIds` across all months in the group
- **sold**: sum `soldIds` across all months in the group  
- **productive**: `(totalSold / totalAvail) * 100` with `calcProductiveStatus` color coding

Data source: `monthlyViewEntries[key] ?? entries[key]` keyed as `${id}-month-${mi}`.

### Files changed
- **`src/components/scorecard/ScorecardGrid.tsx`** — replace line 5822 and line 5860 with computed IIFE cells
