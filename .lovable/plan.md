

# Fix Stale Closure in `calculateAnnualValues`

## Problem

The `calculateAnnualValues` function in `useForecastCalculations.ts` uses `entriesMap` to read stored forecast values, but the `useCallback` dependency array only includes `[months, METRIC_DEFINITIONS]`. This causes the function to use stale (outdated) data when entries update—for example, after saving a new sales expense percentage, the annual summary doesn't reflect the change until a page refresh.

## Solution

Add `entriesMap` to the dependency array so React recreates the callback with fresh data whenever entries change.

## File to Change

**`src/hooks/forecast/useForecastCalculations.ts`** (line 833)

**Current code:**
```typescript
return annualResults;
  }, [months, METRIC_DEFINITIONS]);
```

**Updated code:**
```typescript
return annualResults;
  }, [months, METRIC_DEFINITIONS, entriesMap]);
```

## Why This Fixes It

The callback was capturing a stale reference to `entriesMap`. When entries updated (e.g., after saving a new percentage), the callback still had the old map. Adding `entriesMap` to the dependency array ensures React recreates the callback with the current data, making annual values immediately reflect saved changes.

