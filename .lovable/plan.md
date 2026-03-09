
## Problem

`isThreeColumnMode` (line 1927, `DealerComparison.tsx`) only activates when `datePeriodType === "month"`:

```ts
const isThreeColumnMode = (comparisonMode === "year_over_year" || ...) && datePeriodType === "month";
```

But QvQ now sends `datePeriodType = "custom_range"`, so this is always `false` — meaning the table collapses to a single value column with no current/comparison/diff split.

Additionally, year labels (`yoyCurrentYear`, `yoyPrevYear`) derive from `selectedMonth`, which is `undefined` in QvQ mode — so they fall back to the current calendar year regardless.

## Fix

### 1. Extend `isThreeColumnMode`

```ts
// Before:
const isThreeColumnMode = (...) && datePeriodType === "month";

// After:
const isThreeColumnMode = (...) && (
  datePeriodType === "month" ||
  (comparisonMode === "prev_year_quarter" && datePeriodType === "custom_range")
);
```

### 2. Fix year derivation

When in QvQ `custom_range` mode, `selectedMonth` is `undefined`. Derive the current year from `startMonth` instead:

```ts
// Before:
const yoyCurrentYear = selectedMonth ? parseInt(selectedMonth.split("-")[0]) : new Date().getFullYear();

// After:
const refMonthForYear = selectedMonth || startMonth;
const yoyCurrentYear = refMonthForYear ? parseInt(refMonthForYear.split("-")[0]) : new Date().getFullYear();
```

### 3. Update the column header labels

The sub-header row (line ~2255) currently shows raw `yoyCurrentYear` / `comparisonColumnLabel`. For QvQ `custom_range` mode, we should label them:

- Current column: `Q{selectedCurrentQuarter} {yoyCurrentYear}` (e.g. "Q1 2026")  
- Comparison column: `Q{selectedComparisonQuarter} {yoyPrevYear}` (e.g. "Q1 2025")

Note: `selectedCurrentQuarter` is already in `location.state` — it needs to be destructured (it's currently not pulled from state, only `selectedComparisonQuarter` is).

### 4. Pass `selectedCurrentQuarter` through navigation

In `Enterprise.tsx`, when navigating to `/dealer-comparison`, add `selectedCurrentQuarter` to the state object (it's currently missing):

```ts
navigate("/dealer-comparison", {
  state: {
    ...
    selectedComparisonQuarter,
    selectedCurrentQuarter,   // add this
    ...
  }
});
```

And destructure it in `DealerComparison.tsx`:

```ts
const { ..., selectedComparisonQuarter = 4, selectedCurrentQuarter = 1 } = location.state as { ... selectedCurrentQuarter?: number; ... };
```

## Summary of changes

| File | Change |
|------|--------|
| `src/pages/Enterprise.tsx` | Add `selectedCurrentQuarter` to the navigate state object |
| `src/pages/DealerComparison.tsx` | (1) Destructure `selectedCurrentQuarter` from state. (2) Fix `isThreeColumnMode` to include QvQ `custom_range`. (3) Fix year derivation from `startMonth`. (4) Update column header labels for QvQ mode to show quarter labels. |

Only two files. No data logic changes needed — the aggregation and comparison data already work correctly once the three-column layout is activated.
