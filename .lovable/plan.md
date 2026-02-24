

# Compact Org Chart Layout: Eliminate Excessive Horizontal Gaps

## Problem

The current subtree-width algorithm allocates horizontal space based on leaf descendant count. Denver Bugera has 3 detailer children, so he gets 3 "slots" wide in row 2 -- even though he's just one node. This creates a large empty gap in row 2 between the advisors on the left and Garret Moffat on the right.

## Solution

Switch to a **compact layout** that positions nodes with minimal spacing while preserving parent-child grouping. Instead of allocating space proportional to leaf count, each node gets a fixed-width slot, and parents are centered above their children group after children are positioned.

The algorithm works bottom-up:
1. Position leaf nodes (top row) tightly, left to right, grouped by parent
2. For each parent, compute the center of its children group and position the parent there
3. If a parent's position would overlap a previously placed sibling, shift the entire subtree right
4. This naturally produces compact rows with no wasted space

## Visual Result

```text
Before (leaf-count allocation):
[Advisor] [Advisor]          [Denver]                    [Garret]
              ^--- 3 empty slots of gap ---^

After (compact):
[Advisor] [Advisor] [Denver] [Garret]
                       |         |
              [Det] [Det] [Det] [Tech] [Tech] [Tech] [Tech]
```

Row 2 nodes are tightly packed. Lines still connect correctly because children remain grouped above their parent.

## Technical Details

### File: `src/components/team/ReverseOrgChart.tsx`

Replace the `calcSubtreeWidth` and `layoutTree` functions with a compact layout algorithm:

1. **Remove `calcSubtreeWidth`** -- no longer needed
2. **New `layoutTree` function**:
   - Collect nodes into levels via BFS (same as now)
   - Reverse levels so leaves are first
   - Position leaf level nodes with uniform spacing, grouped by parent
   - For each subsequent level (moving toward root), center each node over its children's span
   - Handle collision: if a node overlaps a previously placed node, shift it (and its subtree) right
   - Return positioned nodes per level and total width

3. **Adjust `NODE_SLOT_WIDTH`** to represent actual node width + gap (e.g., keep at 140 or tune slightly) rather than a "subtree slot"

4. **Keep the rendering logic mostly the same** -- it already uses absolute positioning with `left: x * NODE_SLOT_WIDTH`

### Files Changed
- `src/components/team/ReverseOrgChart.tsx` -- Replace layout algorithm with compact bottom-up positioning

