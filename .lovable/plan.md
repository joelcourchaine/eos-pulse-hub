
## Root Cause

`ScorecardGrid` in `Dashboard.tsx` is keyed only on `selectedDepartment`:

```tsx
key={`scorecard-${selectedDepartment}`}
```

When the user switches stores, the department often stays the same (e.g., "Service Department"). Because the `key` doesn't change, React keeps the component mounted and its internal `viewMode` state (line 380 of `ScorecardGrid.tsx`) is preserved at whatever the user last set it to — not reset to `"weekly"`.

Dashboard does have a `useEffect` at line 167–169 that resets its own `scorecardViewMode` state to `"weekly"` on store change, but that value is never passed into `ScorecardGrid` as a prop — the grid manages `viewMode` entirely internally.

## Fix — `src/pages/Dashboard.tsx`, line 1551

Change the `key` prop on `ScorecardGrid` to include `selectedStore`:

```tsx
// BEFORE
key={`scorecard-${selectedDepartment}`}

// AFTER  
key={`scorecard-${selectedDepartment}-${selectedStore}`}
```

This forces the grid to fully remount on store switch, resetting `viewMode` back to its default of `"weekly"` (line 380 of `ScorecardGrid.tsx`).

## Files Changed
- `src/pages/Dashboard.tsx` only — one character change to the `key` prop on `ScorecardGrid`.
