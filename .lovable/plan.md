
## The Problem

Each level row is a `<div>` with `position: relative` and a fixed `height`. The rows are stacked in a flex column with no gap between them — so rows with taller nodes (like manager pills at 62px) sit flush against rows with shorter nodes, causing the visual touching effect between names like Craig Hominick and Bryan Verhoski.

## The Fix

The level rows are returned from `layout.levels.map((level, li) => ...)` (around line 700). Each row is a `<div key={li} className="relative" style={{ width: ..., height: rowHeight }}>`.

The simplest fix is to add `marginBottom: 12` (or a consistent gap) to each row's style. This adds 12px of breathing room between every pair of adjacent rows without touching any layout calculations.

```tsx
<div
  key={li}
  className="relative"
  style={{ width: layout.totalWidth, height: rowHeight, marginBottom: 12 }}
>
```

This is a 1-line change. It will apply consistently to all rows (leaf rows, cluster rows, manager rows) giving uniform vertical spacing throughout the chart.

## Files Changed
- `src/components/team/ReverseOrgChart.tsx` — add `marginBottom: 12` to the level row div style (line 712)
