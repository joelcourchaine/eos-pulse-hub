
## Root Cause

In `Dashboard.tsx`, `scorecardViewMode` (line 115) is initialized to `"weekly"` but **never reset when switching stores or departments**. The `ScorecardGrid` itself resets to `"weekly"` on remount (via `key={scorecard-${selectedDepartment}}`), but the Dashboard parent's `scorecardViewMode` state persists the last selected mode across store switches. Any UI in Dashboard driven by `scorecardViewMode` (e.g. the KPI status summary strip) would reflect the stale mode.

## Fix

Add a `useEffect` in `Dashboard.tsx` that resets `scorecardViewMode` to `"weekly"` whenever `selectedStore` changes.

```ts
// In Dashboard.tsx — add alongside the existing store-switching effects
useEffect(() => {
  setScorecardViewMode("weekly");
}, [selectedStore]);
```

**Single file:** `src/pages/Dashboard.tsx`
