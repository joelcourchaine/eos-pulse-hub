
## What the user wants

The screenshot shows the Headcount Only view with colored position tiles (e.g. "27 Technician", "5 Advisor", etc.) spread across multiple rows. The user wants to know where to display the **total headcount** — a single number summing all members.

## Best placement

Looking at the screenshot and the layout:
- The headcount tiles are rendered row by row (one row per org level)
- There's a toolbar at the top with the "Headcount Only" toggle

The best place is a **summary bar above the headcount tiles**, shown only when `headcountOnly` is true. It would display something like:

```
Total Headcount: 54
```

as a simple badge/pill in the chart area, or alternatively inline in the toolbar row next to the "Headcount Only" toggle label.

## Two options to present:

**Option A — Inline in the toolbar** (subtle, minimal):
Add `| Total: 54` right next to the "Headcount Only" label in the header controls area. Clean, doesn't take up chart space.

**Option B — Summary card above the tiles** (visible, prominent):
When `headcountOnly` is true, render a row above all the level tiles showing a single "Total" card in a neutral color (e.g. dark navy/charcoal) with the total count and label "Total Headcount". This matches the visual language of the other position tiles.

Option B is more visually prominent and consistent with the tile design. I'll go with that — a single "Total Headcount" card rendered before the level rows, styled like the other tiles but in a neutral dark color.

## Implementation

1. **Compute total**: Sum all members across all levels' `grouped` entries. Since each member appears at exactly one level (their BFS level), we can compute `members.length` directly — the simplest and most reliable approach.

2. **Render**: In the `headcountOnly` branch, before the `layout.levels.map(...)`, render a single summary row:

```tsx
{headcountOnly && (
  <div className="flex justify-center mb-2">
    <div className="flex flex-col items-center justify-center rounded-lg font-medium"
      style={{ backgroundColor: '#1e293b', color: '#fff', minWidth: 100, padding: "8px 20px" }}>
      <span className="font-bold" style={{ fontSize: 22 }}>{members.length}</span>
      <span className="opacity-70" style={{ fontSize: 11 }}>Total Headcount</span>
    </div>
  </div>
)}
```

This renders above all the level rows, visually at the bottom of the chart (since levels render top=leaves, bottom=roots, but in the DOM it appears as a flex column — the summary card would be at the DOM top, which is visually the top of the headcount view).

Wait — actually I need to think about where in the DOM it renders. The layout is:
- `flex-col` column: level[0] (leaves) at top, level[N] (roots) at bottom

So adding the total card BEFORE the levels loop puts it at the very top of the chart — which is the leaf row. That feels odd visually.

Better option: Add it **after** the levels loop (below the root) so it appears at the bottom, OR put it in the **toolbar** near the toggle.

Actually looking at the screenshot again — the org structure goes leaves (top row) → root (bottom row). A total at the bottom after the root would be nicely anchored. Or even simpler: put it in the toolbar controls row right next to the toggle switch, like `Headcount Only [toggle] | Total: 54`.

**Final decision**: Show total inline in the toolbar, to the right of the "Headcount Only" label, as a small badge. This is the least intrusive and most practical — you always see the total without it being a separate element in the chart.

```tsx
{headcountOnly && (
  <span className="text-xs font-semibold bg-slate-700 text-white rounded px-2 py-0.5 ml-1">
    {members.length} total
  </span>
)}
```

## Files changed
- `src/components/team/ReverseOrgChart.tsx` — add a `{headcountOnly && <span>...members.length...</span>}` badge next to the toggle label in the toolbar (lines ~623-625)
