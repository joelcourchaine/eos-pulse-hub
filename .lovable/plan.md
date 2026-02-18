

# Dynamic Node Sizing for Org Chart Rows

## What Changes

Each row of the org chart will automatically shrink its nodes so that everyone reporting to the same person fits on a single row without scrolling. Fewer people = bigger, more readable cards. Many people = compact cards that still fit.

## How It Works

- Calculate the largest level (row) in the chart
- Based on the container width and the number of nodes in the widest row, compute a scale factor
- Pass that scale factor down to each `OrgNode` so it adjusts its `minWidth`, padding, and font sizes proportionally
- Remove `min-w-fit` from the inner chart container so the chart stays within the visible area instead of forcing horizontal scroll

## Technical Details

**File: `src/components/team/ReverseOrgChart.tsx`**

1. **Compute max level size** -- find the largest number of nodes in any single level:
   ```tsx
   const maxLevelSize = Math.max(...levels.map(l => l.length), 1);
   ```

2. **Compute a compact scale** based on a target of fitting within ~1200px of usable width:
   ```tsx
   // Base node width is 120px + 12px gap = 132px per node
   // If maxLevelSize * 132 > available width, shrink proportionally
   const BASE_NODE_WIDTH = 132;
   const AVAILABLE_WIDTH = 1200;
   const nodeScale = Math.min(1, AVAILABLE_WIDTH / (maxLevelSize * BASE_NODE_WIDTH));
   // Clamp to a minimum of 0.45 so nodes don't become unreadable
   const clampedScale = Math.max(0.45, nodeScale);
   ```

3. **Pass `nodeScale` to `OrgNode`** as a new prop and apply it to sizing:
   - `minWidth`: scale from 120px down (e.g., `120 * nodeScale`)
   - `padding`: scale px/py proportionally
   - `font-size`: use smaller text at lower scales
   - Name truncation `max-width`: scale down proportionally

4. **Headcount-only nodes** get the same treatment (scale their `minWidth` from 80/60px).

5. **Remove `min-w-fit`** from the inner chart `div` (line 271) so the chart respects the container width and nodes shrink instead of overflowing.

6. **Remove `maxHeight: "60vh"`** from the outer container (line 270) to give more vertical room since the chart will now be more compact horizontally.

This approach keeps the chart readable down to about 25 nodes on one row (each node shrinks to roughly 45% of normal size), and beyond that, the existing `flex-wrap` will kick in as a fallback.
