
## Root Cause

`handleRedistributeByWeights` has two problems:

1. **No try/catch** — if `bulkUpdateEntries.mutateAsync` throws (e.g. a DB error or NaN value), the async function crashes silently but `bulkUpdateEntries.isPending` stays `true` forever, causing the "Saving..." and "Locking..." spinners to be permanently stuck.

2. **Includes percentage metrics** — `metricDefinitions` contains `sales_expense_percent` (and possibly `gp_percent`). These are ratios, not dollar amounts — redistributing them by sales weighting produces garbage values and likely causes the mutation to error.

## Fix (single file: `src/components/financial/ForecastDrawer.tsx`)

### Change 1 — Wrap `handleRedistributeByWeights` in try/catch (lines 392–446)

```ts
const handleRedistributeByWeights = async () => {
  if (!forecast) return;
  try {
    // ... existing logic ...
    if (updates.length > 0) {
      await bulkUpdateEntries.mutateAsync(updates);
      toast.success('Redistributed to annual totals');
    }
  } catch (error) {
    console.error('[handleRedistributeByWeights] error:', error);
    toast.error('Failed to redistribute. Please try again.');
  }
};
```

### Change 2 — Skip percentage/ratio metrics in the redistribute loop (lines 409–440)

Filter out metrics where `metric.format === 'percent'` or `metric.isCalculated` (or by key: `sales_expense_percent`, `gp_percent`) so only dollar-value metrics are redistributed:

```ts
metricDefinitions.forEach((metric) => {
  // Skip percentage/ratio metrics — they can't be meaningfully redistributed by weight
  if (metric.format === 'percent' || metric.key.includes('percent')) return;
  // ... rest of existing logic ...
});
```

This prevents NaN/Infinity values from being submitted to the DB and crashing the mutation.
