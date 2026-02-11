

## Fix: Negative Sub-Metric Values from Stellantis Imports

### Problem
When importing a Stellantis financial file where raw values follow accounting conventions (all negative), the sub-metric values get stored as negative numbers even though the parent metrics are correctly positive.

**What's happening in the database for May 2025 Parts:**
- Parent `total_sales` = 158,414 (correct, positive)
- Sub-metric `sub:total_sales:001:CUSTOMER REPAIRS...` = -243,511 (wrong, should be positive)
- All fixed expense sub-metrics are also negative

**Why June and other months are fine:** Those files happened to have sub-metric source values already positive. The May file used a different accounting convention where everything is negative.

### Root Cause
There are two parsers involved, and neither corrects the sign on sub-metrics:

1. **Data dump parser** (`parseStellantisExcel.ts`): Correctly negates `SALES*` codes for parent metrics (line 344), but stores fixed expense sub-metrics as raw values without correction (lines 384 and 413).

2. **Cell mapping parser** (`parseFinancialExcel.ts`): Reads sub-metric values directly from Chrysler5 sheet cells (line 337) and stores them as-is with no sign correction. These are the source of the `total_sales` and `gp_net` sub-metrics.

### Fix (3 locations across 2 files)

#### 1. `parseStellantisExcel.ts` -- Fix fixed expense sub-metrics from E-code format (~line 384)
Apply `Math.abs()` to the value when storing fixed expense sub-metrics:

```typescript
// Before:
value: value,

// After:
value: Math.abs(value),
```

#### 2. `parseStellantisExcel.ts` -- Fix fixed expense sub-metrics from EXP format (~line 413)
Same fix for the alternative data dump format extraction path:

```typescript
// Before:
value: value,

// After:
value: Math.abs(value),
```

#### 3. `parseFinancialExcel.ts` -- Fix cell-mapped sub-metrics for Stellantis (~line 664-674)
In `importFinancialData`, normalize Stellantis sub-metric values to positive when building the entries array. This is the correct place because the cell mapping parser is generic and used by all brands -- the sign correction should only apply to Stellantis.

```typescript
// Inside the sub-metric entries loop, before pushing to subMetricEntries:
const isStellantis = brand?.toLowerCase() === 'stellantis';

for (const subMetric of processedSubMetrics) {
  const metricName = `sub:${subMetric.parentMetricKey}:${String(subMetric.orderIndex).padStart(3, '0')}:${subMetric.name}`;
  
  // Stellantis files may store values as negative (accounting credits).
  // Normalize to positive since our system always displays sub-metrics as positive.
  const normalizedValue = isStellantis && subMetric.value !== null
    ? Math.abs(subMetric.value)
    : subMetric.value;
  
  subMetricEntries.push({
    department_id: departmentId,
    month: monthIdentifier,
    metric_name: metricName,
    value: normalizedValue,
    created_by: userId,
  });
}
```

### Data Fix
After deploying the code fix, re-import the May 2025 file for River City Ram. This will overwrite the negative sub-metric values with correct positive values.

### Why This Is Safe
- June and other months already have positive sub-metrics -- `Math.abs()` is a no-op on positive values
- Percentage sub-metrics (gp_percent) are always positive, so `Math.abs()` is safe
- Parent metrics are unaffected (they already have their own sign correction)
- No other brands are impacted by the Stellantis-specific normalization in `importFinancialData`; the data dump parser fix uses `Math.abs()` which is also safe for all values

