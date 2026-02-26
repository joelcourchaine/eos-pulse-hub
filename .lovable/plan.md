
## Plan

The fix is simple: when `scorecardViewMode === "yearly"`, pass `quarter={-1}` to `FinancialSummary` so it renders the monthly trend view matching the scorecard.

Currently in `Dashboard.tsx` line 1542, `FinancialSummary` always gets `quarter={selectedQuarter}`. But `selectedQuarter` is controlled by the `PeriodNavigation` component, not by the scorecard's internal view mode toggle.

The `scorecardViewMode` state (line 111) is already tracked in Dashboard — it's set via `onViewModeChange` prop from `ScorecardGrid`. We just need to derive the effective quarter for `FinancialSummary`:

- If `scorecardViewMode === "yearly"` → pass `quarter={-1}` (monthly trend mode)
- Otherwise → pass `quarter={selectedQuarter}` (existing behavior)

### Changes

**`src/pages/Dashboard.tsx`** — 1 line change at line 1542:
```tsx
// Before:
quarter={selectedQuarter}

// After:
quarter={scorecardViewMode === "yearly" ? -1 : selectedQuarter}
```

Also update the `key` prop on line 1539 to include `scorecardViewMode` so it re-mounts when the view changes:
```tsx
key={`financial-${selectedDepartment}-${selectedYear}-${selectedQuarter}-${scorecardViewMode}`}
```

That's it — 2 small changes in one file.
