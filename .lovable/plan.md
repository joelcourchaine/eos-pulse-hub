

# Fix Org Chart Layout: Align Children Above Their Parent

## Problem

Currently, each level in the reverse org chart sorts nodes alphabetically by position, then by name. This breaks the visual parent-child relationship -- for example, Denver Bugera's detailers are clustered on the far left while he sits in the middle of his level, making the reporting lines cross awkwardly.

## Solution

Replace the position-based sorting with a **parent-preserving layout order**. Nodes at each level will be ordered so that siblings (children of the same parent) are grouped together, and those groups appear in the same left-to-right order as their parents in the level below.

This is how standard org charts work -- children fan out directly above (or below) their manager.

## How It Will Look

- Denver Bugera's 3 detailers will cluster directly above him
- Garret Moffat's technicians will cluster directly above him
- Lines will run mostly vertically with minimal crossing

## Technical Details

### File: `src/components/team/ReverseOrgChart.tsx`

**Change the `getLevels` function** (lines 86-109):

Instead of flattening the tree by depth and then sorting by position, use a breadth-first traversal that preserves sibling order. Each parent's children are kept together in sequence, and within a parent's children, sort by position then name (for consistency).

```text
Current approach:
  1. Traverse tree, collect nodes by depth
  2. Sort each level by position alphabetically (breaks parent alignment)
  3. Reverse levels

New approach:
  1. Traverse tree breadth-first, so each level's nodes appear
     in the order dictated by their parent's position in the previous level
  2. Within each parent's children, sort by position then name
  3. Reverse levels (same as before)
```

The key change is removing the global `level.sort()` on lines 101-106 and instead ensuring the traversal itself produces the correct order by sorting each node's children before traversing them.

### Files Changed
- `src/components/team/ReverseOrgChart.tsx` -- Replace global level sort with parent-preserving child ordering

