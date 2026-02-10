

## Refresh Financial Summary Visual Cues on Forecast Drawer Close

### Problem
When the forecast drawer is closed after making changes, the Financial Summary's color-coded performance indicators (green/red/yellow) don't update because the forecast targets data isn't re-fetched.

### Solution
The `useForecastTargets` hook already exposes a `refetch` function. The `ForecastDrawer` component's `onOpenChange` callback fires when the drawer closes. We just need to trigger `refetch` when the drawer closes.

### File to Modify

**`src/components/financial/FinancialSummary.tsx`**

Replace the simple `setForecastDrawerOpen` passed to `ForecastDrawer`'s `onOpenChange` with a wrapper that also calls `refetch` from `useForecastTargets` when the drawer is closing (i.e., `open === false`).

```text
// Current (line ~4883):
onOpenChange={setForecastDrawerOpen}

// New:
onOpenChange={(open) => {
  setForecastDrawerOpen(open);
  if (!open) {
    refetch();  // from useForecastTargets destructuring
  }
}}
```

The `refetch` is already returned from `useForecastTargets` (line ~429) but currently only called on initial mount. We need to ensure it's destructured -- checking current destructuring at that line to confirm `refetch` is included, and adding it if not.

### Scope
- Single file change, ~5 lines modified
- No new dependencies or hooks needed
