
# Fix: Financial Summary Data Flickering for High-Volume Departments

## Problem Analysis
Steve Marshall Ford Service has 1,079+ financial entries for 2025 (due to Ford's YTD tracking and extensive sub-metrics). This creates several race conditions:

1. **Initial load flicker**: `loadFinancialData()` calls `setEntries({})` to clear data before loading, creating a visible gap where data disappears then reappears
2. **Async race conditions**: `loadPrecedingQuartersData()` is triggered on every realtime event. Multiple overlapping async requests can complete out of order, causing stale data to overwrite fresh data
3. **Realtime event storms**: Active imports trigger many INSERT/UPDATE events, each calling `loadPrecedingQuartersData()`

## Solution

### 1. Prevent Clearing Entries Before Load Completes
Instead of clearing entries immediately, only update with new data when the load completes successfully.

**File**: `src/components/financial/FinancialSummary.tsx`

**Change** (around line 1731-1736):
```text
Current code:
  setLoading(true);
  setEntries({});    // <-- This causes flicker
  setNotes({});

Fixed code:
  setLoading(true);
  // Don't clear entries here - wait until new data is loaded
  // This prevents UI flicker during async load
```

Then at line 1813, replace entries atomically:
```typescript
// Replace entries atomically only after successful load
setEntries(entriesMap);
setNotes(notesMap);
```

### 2. Add Request Tracking to Prevent Stale Data Overwrites
Use a request counter/timestamp to ensure only the latest request's data is applied.

**File**: `src/components/financial/FinancialSummary.tsx`

Add a ref to track request IDs:
```typescript
const loadRequestIdRef = useRef(0);
const precedingDataRequestIdRef = useRef(0);
```

In `loadFinancialData()`:
```typescript
const loadFinancialData = async () => {
  if (!departmentId) {
    setLoading(false);
    return;
  }

  const requestId = ++loadRequestIdRef.current;
  setLoading(true);
  
  // ... fetch data ...
  
  // Only apply if this is still the latest request
  if (requestId !== loadRequestIdRef.current) {
    console.log('[loadFinancialData] Stale request, discarding');
    return;
  }
  
  setEntries(entriesMap);
  setNotes(notesMap);
  setLoading(false);
};
```

In `loadPrecedingQuartersData()`:
```typescript
const loadPrecedingQuartersData = async () => {
  if (!departmentId) return;

  const requestId = ++precedingDataRequestIdRef.current;
  
  // ... fetch data ...
  
  // Only apply if this is still the latest request
  if (requestId !== precedingDataRequestIdRef.current) {
    console.log('[loadPrecedingQuartersData] Stale request, discarding');
    return;
  }
  
  setPrecedingQuartersData(averages);
};
```

### 3. Debounce Realtime-Triggered Reloads
Prevent rapid-fire reloads by debouncing the `loadPrecedingQuartersData()` call in the realtime handler.

**File**: `src/components/financial/FinancialSummary.tsx`

Add debounce ref:
```typescript
const precedingDataDebounceRef = useRef<NodeJS.Timeout | null>(null);
```

In the realtime handler (around line 748):
```typescript
// Debounce reload of quarter aggregates to prevent rapid-fire requests
if (precedingDataDebounceRef.current) {
  clearTimeout(precedingDataDebounceRef.current);
}
precedingDataDebounceRef.current = setTimeout(() => {
  loadPrecedingQuartersData();
}, 500); // Wait 500ms after last event before reloading
```

Clean up in effect cleanup:
```typescript
return () => {
  supabase.removeChannel(channel);
  if (precedingDataDebounceRef.current) {
    clearTimeout(precedingDataDebounceRef.current);
  }
};
```

## Summary of Changes

| File | Change |
|------|--------|
| `FinancialSummary.tsx` | Remove immediate `setEntries({})` clear on load start |
| `FinancialSummary.tsx` | Add request ID tracking to prevent stale data overwrites |
| `FinancialSummary.tsx` | Debounce realtime-triggered `loadPrecedingQuartersData()` calls |

## Expected Result
- Data will no longer flicker/disappear during loads
- Overlapping async requests won't cause data to appear/disappear randomly
- Rapid realtime events (like during imports) will be batched instead of triggering many individual reloads

## Technical Notes
- The request ID pattern ensures that if request A starts, then request B starts, and A finishes after B, A's stale data won't overwrite B's fresh data
- The 500ms debounce means during an import with many INSERT events, we'll only reload once after the batch completes rather than once per INSERT
- Removing the immediate `setEntries({})` means the UI shows the previous data during load, which is better UX than showing empty cells
