
## Root cause

In `src/pages/Dashboard.tsx` line 97:

```ts
const [selectedQuarter, setSelectedQuarter] = useState(-1); // Default to Monthly Trend view
```

`quarter === -1` maps to `isMonthlyTrendMode = true` in `ScorecardGrid`. The "Weekly" button's active variant condition is:

```ts
variant={viewMode === "weekly" && !isQuarterTrendMode && !isMonthlyTrendMode ? "default" : "ghost"}
```

Since `isMonthlyTrendMode` is `true` on load, the Weekly button always renders as `"ghost"` (inactive) — it looks unselected even though `viewMode` is `"weekly"`.

## Fix

**`src/pages/Dashboard.tsx`, line 97** — change the initial `selectedQuarter` from `-1` to the actual current quarter:

```ts
// Before:
const [selectedQuarter, setSelectedQuarter] = useState(-1);

// After:
const getInitialQuarter = () => {
  const month = new Date().getMonth(); // 0-indexed
  return Math.floor(month / 3) + 1;
};
const [selectedQuarter, setSelectedQuarter] = useState(getInitialQuarter());
```

This ensures the scorecard starts in the current quarter with Weekly mode properly active. The existing `setScorecardViewMode("weekly")` reset on store change (line 168) already handles resets when switching stores.
