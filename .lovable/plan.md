

## Fix: Add Limit Override to Sub-Metric Discovery Query

### Problem
The `hasSubMetrics: true` flag was correctly added to the Stellantis metrics config, but the sub-metric discovery query in `src/pages/Enterprise.tsx` (line 564-566) still hits the default 1,000-row limit. Your 3 Stellantis departments have over 2,000 sub-metric rows, so the query silently truncates results and the "UNAPPLIED/VARIANCE LABOUR MECHNICAL" entry never makes it into the picker.

### Fix

**File: `src/pages/Enterprise.tsx`** (line 566)

Add `.limit(10000)` to the sub-metric discovery query:

```typescript
// Before:
.like("metric_name", "sub:%");

// After:
.like("metric_name", "sub:%")
.limit(10000);
```

This is a one-line change. The deduplication logic on lines 574-590 already collapses duplicate names, so fetching more rows has no downstream impact -- it just ensures all unique sub-metric names are discovered.

### No other changes needed
- The `hasSubMetrics: true` flags added in the last edit are correct
- The Dealer Comparison percentage synthesis logic already handles GP % sub-metrics
- No database changes required

