

# Fix: Detailers Hidden Behind Technicians Due to Overlapping Positions

## Problem

The compact bottom-up layout algorithm has a critical overlap bug. It positions all leaf nodes first (detailers at slots 0-2, technicians at slots 3-7), then when centering parents, Denver needs to shift right (to avoid colliding with Scott Bennie). This shifts Denver's 3 detailers from 0,1,2 to 3,4,5 -- but Garret's technicians are already at 3,4,5,6,7. The detailers render at the same coordinates as the technicians, making them invisible.

## Solution

Replace the bottom-up "position all leaves, then center parents" algorithm with a **recursive subtree layout** that naturally prevents overlaps. Each subtree is positioned as a contiguous block, so siblings' subtrees never overlap.

```text
layoutSubtree(node, startX):
  if no children: place node at startX, return width = 1
  offset = startX
  for each child:
    childWidth = layoutSubtree(child, offset)
    offset += childWidth
  node.x = midpoint of first and last child
  return total width used (offset - startX)
```

This guarantees Denver's detailers occupy slots 4-6 and Garret's technicians occupy slots 7-11 (for example) -- never overlapping.

## Visual Result

```text
Before (broken overlap):
Row 1: [Tech][Tech][Tech][Tech][Tech]  <-- detailers hidden underneath!

After (fixed):
Row 1: [Det][Det][Det] [Tech][Tech][Tech][Tech][Tech]
Row 2: ... [Denver] ... [Garret] ...
```

## Technical Details

### File: `src/components/team/ReverseOrgChart.tsx`

Replace the `layoutTree` function (lines 100-165) with a recursive approach:

1. **Recursive `layoutSubtree(node, startX)` function**: Positions a node and all its descendants starting at `startX`. Leaf nodes get placed at `startX` with width 1. Non-leaf nodes recursively layout children left-to-right, then center themselves over their children's span.

2. **`layoutTree` wraps the recursion**: Calls `layoutSubtree` for each root, accumulating the offset. Then collects all nodes into levels (via BFS) with their assigned positions.

3. **Level collection remains the same**: BFS to group nodes by depth, reversed for rendering (leaves on top).

### Files Changed
- `src/components/team/ReverseOrgChart.tsx` -- Replace layout algorithm with recursive subtree positioning

