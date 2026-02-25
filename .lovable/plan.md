
## Analysis of the Overlap Problem

Looking at the screenshot and the code, there are two overlap scenarios:

### Overlap Source 1: Clusters vs individual nodes at the same level
The `clusterLevelMap` is built so clusters land at the same level as the individual leaf nodes. But when a parent has BOTH clustered leaf children AND non-leaf children, the BFS level for leaves (reversed level 0) may collide with standalone leaf pills from different parents — because everything is `position: absolute` placed by X coordinate, and the cluster container can be **wider** than its allocated `CLUSTER_SLOT_WIDTH` of 130px once pills wrap.

### Overlap Source 2: Cluster width miscalculation  
The `BalloonCluster` width formula:
```typescript
width: Math.min(cluster.members.length, maxPerRow) * (pillSize + 3) + 14
```
With `maxPerRow = 4` and `pillSize = 34`, max width = 4 × 37 + 14 = **162px** but `CLUSTER_SLOT_WIDTH = 130px`. The allocated layout slot is 130px but the actual rendered cluster can be up to 162px → overflow and overlap into adjacent columns.

### Overlap Source 3: Mixed levels with different-depth subtrees
Looking at the screenshot, the `Jody` and `Chris` circles (advisors, left side) appear at the same rendered row as the technician balloon clusters (they're both "leaf level" BFS nodes), but their parents are at different depths. The layout's absolute positioning places them at the same `top: 0` within a shared row div, but the x-spacing doesn't account for the fact that a cluster from one branch may visually overlap an individual pill from another branch.

### Root Cause Summary

The core issue is **`CLUSTER_SLOT_WIDTH = 130px` is smaller than the actual rendered cluster width**, and there's **no minimum gap/margin** between adjacent clusters or between a cluster and an adjacent individual leaf.

### Fix Plan

**1. Increase `CLUSTER_SLOT_WIDTH` to match actual max render width**  
With 4 per row, pills of 34px, gap 3px: `4 × (34+3) - 3 + 2×7 = 4×37 - 3 + 14 = 159px` → set `CLUSTER_SLOT_WIDTH = 170` to give a comfortable margin.

**2. Add inter-item padding in the layout**  
Add a `SLOT_GAP = 8` constant added between every layout slot so adjacent items (cluster→cluster, cluster→leaf, leaf→leaf) always have breathing room.

**3. Fix `getSubtreeLeafWidth` to include gaps**  
Currently it sums slot widths with no gaps between them. Add `SLOT_GAP` between each slot unit:

```typescript
// Each child slot gets +SLOT_GAP except the last
total += (numSlots) * SLOT_GAP + widths;
```

**4. Fix `layoutSubtree` to offset by `SLOT_GAP` between items**  
In the loop that builds `offset`, add `+= SLOT_GAP` between each slot assignment.

**5. Increase `BalloonCluster` `maxPerRow` to 3 and adjust pill size**  
Fewer per row means a taller but narrower cluster — more "balloon bunch" shaped, and less likely to overflow its width slot. With `maxPerRow = 3`:
- Width = 3 × (34+3) - 3 + 14 = 122px → fits within 130px  
- But we're raising `CLUSTER_SLOT_WIDTH` to 170 anyway, so we can keep `maxPerRow = 4` and it fits fine.

Actually let me recalculate more carefully:
- pillSize = 34, gap = 3, maxPerRow = 4, padding = 7px each side
- Width = min(n, 4) × 34 + (min(n,4)-1) × 3 + 14
- For n≥4: 4×34 + 3×3 + 14 = 136 + 9 + 14 = **159px**

So `CLUSTER_SLOT_WIDTH = 160` covers this exactly. Add `SLOT_GAP = 12` to pad between all slots.

**6. Fix `layoutSubtree` offset sequencing**  
Currently the code lays out clusters first (sorted position keys), then non-leaf children. The gap must be applied consistently:

```typescript
// After placing each slot (cluster or individual leaf), add SLOT_GAP before next
offset += CLUSTER_SLOT_WIDTH + SLOT_GAP;
// OR
offset += LEAF_SLOT_WIDTH + SLOT_GAP;
```

And `getSubtreeLeafWidth` must return the same accounting:
```typescript
total += group.length >= 2 
  ? CLUSTER_SLOT_WIDTH + SLOT_GAP 
  : group.length * (LEAF_SLOT_WIDTH + SLOT_GAP);
```

This ensures the layout width allocated equals the layout width rendered.

**7. Fix the line endpoints**  
The line currently goes from parent bottom → cluster bottom (using `cRect.bottom`), but it should go parent bottom → cluster **top** (lines come *down* from parent to child, not child-to-child). Wait, looking at the code:

```typescript
y2: cRect.bottom - chartRect.top,  // ← This is the BOTTOM of the cluster
y1: parentY = pRect.top - chartRect.top,  // ← This is the TOP of the parent
```

The tree is rendered **leaves at top, roots at bottom** (reversed BFS). So lines should go from parent **top** (which is visually above in the DOM but at a higher Y value since roots are at the bottom of the chart) down to child **bottom**. Actually looking at `isLeafLevel` at top and roots at bottom, the layout renders leaf rows at the top of the flex column and root rows at the bottom. So the line should be:
- `y1 = parent top` (parent is lower in the page = higher Y = bottom of the column)  
- `y2 = child bottom` (child is higher in the page = lower Y = top of the column)

The current code uses `pRect.top` and `cRect.bottom`, which means line goes from parent's top edge down to child's bottom edge — visually wrong since child is above parent. It should be `pRect.top → cRect.bottom` since child (cluster/leaf) is rendered above the parent, so the cluster's bottom connects up to the parent's top. This looks correct actually.

Let me re-examine: `y1 = pRect.top - chartRect.top` = top of parent box. `y2 = cRect.bottom - chartRect.top` = bottom of child (cluster). Since the cluster is rendered ABOVE the parent (smaller Y on page), `cRect.bottom < pRect.top`, so the line goes from a higher Y (parent top) up to a lower Y (cluster bottom). That's correct visually.

**Summary of changes to `ReverseOrgChart.tsx`:**

1. `CLUSTER_SLOT_WIDTH = 160` (was 130) — matches actual rendered cluster width  
2. Add `SLOT_GAP = 12` constant — spacing between adjacent layout slots  
3. `getSubtreeLeafWidth`: add `SLOT_GAP` per slot in both cluster and leaf cases  
4. `layoutSubtree`: add `SLOT_GAP` when advancing `offset` between slots  
5. `BalloonCluster`: sync the `width` formula with `CLUSTER_SLOT_WIDTH` (use `CLUSTER_SLOT_WIDTH - 10` instead of recalculating manually, so they stay in sync)  
6. The row `height` calculation already uses `maxRows * 38 + 20` which should be fine

## File Changed
- `src/components/team/ReverseOrgChart.tsx`
