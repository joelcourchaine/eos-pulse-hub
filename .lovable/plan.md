
## Feature: "Redistribute to Annual Totals" Button

### What This Does
A new button in the Forecast Drawer header that takes the **current annual totals** (already computed for each metric in the 2026 Annual column) and **redistributes them across the 12 months using the sales weightings** (the same weighted baseline distribution used for all other calculations). Any locked months remain unchanged; the redistribution only touches unlocked months.

### Why This Is Useful
After using the growth slider or manual annual edits, the monthly breakdown may be uneven or out of sync with the sales-weighted distribution. This button lets the user say "keep my annual totals but make the month-by-month split match our seasonal sales pattern."

---

## Implementation Plan

### 1. Add `handleRedistributeByWeights` function in `ForecastDrawer.tsx`

Logic:
- For each metric in the current `monthlyValues` map, compute the annual total (sum of all 12 unlocked months + locked month values)
- For each unlocked month, calculate: `monthValue = annualTotal × (monthWeight / sumOfUnlockedWeights)`
  - Where `monthWeight` = the `adjusted_weight` for that month from `weights` (or `calculatedWeights` as fallback)
  - And `sumOfUnlockedWeights` = sum of weights for only the unlocked months
  - Locked month values are subtracted from the annual total before redistribution
- Call `bulkUpdateEntries.mutateAsync(updates)` with all the redistributed values
- Show `toast.success('Redistributed to annual totals')`

### 2. Add the button to the header toolbar in `ForecastDrawer.tsx`

Place it alongside the existing Reset / Save / Email / Push to Targets buttons (around line 1555–1615).

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleRedistributeByWeights}
  disabled={!forecast || bulkUpdateEntries.isPending}
  title="Redistribute annual totals across months using sales weightings"
>
  <BarChart2 className="h-4 w-4 mr-1" />
  Redistribute
</Button>
```

### Files Changed
- `src/components/financial/ForecastDrawer.tsx` only — add the handler function and the button.
