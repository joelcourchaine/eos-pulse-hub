

## Fix: Remove Stellantis Sub-Metric Math.abs() Normalization

### What happened
A blanket `Math.abs()` was added to force all Stellantis sub-metric values positive during import. However, the E-code parser (`parseStellantisExcel.ts`) already normalizes its own values at the source — so this extra step only affects cell-mapped stores like Morden, where it incorrectly flips legitimate negatives (e.g., Unapplied Time from -8774 to +8774).

### Why it's safe to remove
- The E-code parser already applies `Math.abs()` internally (lines 384 and 413 of `parseStellantisExcel.ts`) — no double-dipping needed
- The database has many correctly-stored negative sub-metrics across all prior months for Stellantis stores, proving the system handles negatives fine
- Only January 2026 imports were affected by this code

### Change

**File: `src/utils/parseFinancialExcel.ts` (lines 674-681)**

Remove the Stellantis-specific `Math.abs()` check and use the value directly:

```
Before:
  const isStellantis = brand?.toLowerCase() === 'stellantis';
  for (const subMetric of processedSubMetrics) {
    const normalizedValue = isStellantis && subMetric.value !== null
      ? Math.abs(subMetric.value)
      : subMetric.value;

After:
  for (const subMetric of processedSubMetrics) {
    const normalizedValue = subMetric.value;
```

### After deploying
Re-import Morden's January 2026 Service statement so the Unapplied Time value is corrected from +8774 to -8774 in the database.

