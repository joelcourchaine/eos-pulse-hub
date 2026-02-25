
## What the user wants

The user wants leaf nodes that belong to the same parent to remain as **individual circles** (balloons), but grouped together visually as a tight **bunch** — like a cluster of balloons tied together. They don't want a card/box around them, just the individual pills packed close together with a single connector line going up to the parent, rather than N separate lines fanning out.

## Visual Concept

```text
BEFORE (9 techs spread wide under Foreman):
        [Foreman A]
  /  /  /  /  |  \  \  \  \
[T][T][T][T][T][T][T][T][T]   ← 9 × 48px = 432px wide, 9 connector lines

AFTER (9 techs bunched together like balloons):
        [Foreman A]
              |
       ╔══════╧══════╗   ← thin dashed border container, no fill
       ║ [T][T][T]   ║   ← individual colored balls, wrapping flexbox
       ║ [T][T][T]   ║   ← max ~3 per row within cluster
       ║ [T][T][T]   ║
       ╚═════════════╝
```

The "bunch" is a transparent/lightly-bordered wrapping flex container that holds the individual leaf pills (same circular style as today). Only ONE connector line goes from the parent down to the cluster container, not N individual lines.

## Key Design Decisions

1. **Cluster container**: a transparent rounded rectangle with a very subtle dashed border (role-colored, low opacity). No fill, just a gentle outline to suggest grouping.
2. **Individual pills inside**: the exact same 36px circular pills as today — same initials, same colors, same click handler, same tooltip.
3. **Pills wrap**: `flex flex-wrap gap-1 justify-center` inside the container, max ~3-4 per row so the bunch is roughly square-ish (balloon bunch shape).
4. **One line, not N lines**: The SVG connector line goes from the parent to the TOP CENTER of the cluster container, not to each individual pill. This requires the cluster container to have a `ref` for line calculation.
5. **Clustering condition**: Group leaf siblings sharing the same position under the same parent where there are ≥2 such members.
6. **Single-leaf case**: A single leaf with a unique position keeps the existing individual pill + individual line behavior.
7. **Layout width reduction**: A cluster of N same-position leaves under a parent counts as ONE layout slot of `CLUSTER_SLOT_WIDTH = 130px` instead of N × 48px. This is the key width reduction.

## Implementation Plan

### 1. Pre-process tree: identify clusters

After `buildTree`, run a `clusterize(roots)` pass that:
- For each non-leaf node, groups its leaf children by position
- Any position group with ≥2 leaf members becomes a "LeafCluster"
- Creates a `Map<string, LeafCluster>` keyed by a synthetic cluster ID like `"cluster_{parentId}_{position}"`

```typescript
interface LeafCluster {
  id: string;           // synthetic key e.g. "cluster_abc123_technician"
  parentId: string;
  position: string;
  members: TeamMember[];
}
```

### 2. Modify layout width calculation

Add a `clusterMap` parameter to `getSubtreeLeafWidth`. When a parent's leaf children for a given position form a cluster, count them as `CLUSTER_SLOT_WIDTH = 130` instead of N × 48.

```typescript
const CLUSTER_SLOT_WIDTH = 130;

function getSubtreeLeafWidthWithClusters(node: TreeNode, clusters: Map<string, LeafCluster>): number {
  if (node.children.length === 0) return LEAF_SLOT_WIDTH;
  
  // Group leaf children by position
  let total = 0;
  const leafByPos: Record<string, TreeNode[]> = {};
  const nonLeafChildren: TreeNode[] = [];
  
  node.children.forEach(child => {
    if (child.children.length === 0) {
      if (!leafByPos[child.member.position]) leafByPos[child.member.position] = [];
      leafByPos[child.member.position].push(child);
    } else {
      nonLeafChildren.push(child);
    }
  });
  
  // Each position group of 2+ leaf siblings = 1 cluster slot
  Object.values(leafByPos).forEach(group => {
    total += group.length >= 2 ? CLUSTER_SLOT_WIDTH : group.length * LEAF_SLOT_WIDTH;
  });
  
  // Non-leaf children recurse normally
  nonLeafChildren.forEach(child => {
    total += getSubtreeLeafWidthWithClusters(child, clusters);
  });
  
  return total;
}
```

### 3. Modify `layoutTree` to position clusters

The layout algorithm needs to assign an X position to clusters (not just individual leaf nodes). For each parent node, after grouping its leaf children, assign the cluster's X as the midpoint of the N slots it occupies.

The leaf children that belong to a cluster should NOT receive individual positions in `posMap` — instead the cluster ID gets a position. The SVG line will connect to the cluster ref.

### 4. New `BalloonCluster` component

```tsx
const BalloonCluster = ({ members, showNames, onSelect }) => {
  return (
    <div
      style={{
        border: `1.5px dashed ${colors.border}`, // role color, 40% opacity
        borderRadius: 12,
        padding: "6px 8px",
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        justifyContent: "center",
        maxWidth: CLUSTER_SLOT_WIDTH - 10,
        background: "transparent",  // no fill — just a border outline
      }}
    >
      {members.map(member => (
        // Existing individual 36px pill — same as today
        <IndividualLeafPill key={member.id} member={member} showNames={showNames} onSelect={onSelect} />
      ))}
    </div>
  );
};
```

### 5. Modify render: clusters vs individual leaves

In the level renderer, for nodes that are part of a cluster:
- Skip rendering them individually
- Instead render the `BalloonCluster` component once per cluster, centered at the cluster's X position
- The cluster container gets a `ref` registered under the cluster ID in `nodeRefs`

For the SVG lines: when building lines, check if a member's parent is in a cluster. The line goes from parent → cluster container top center (not individual pill).

### 6. Refactor `OrgNode` leaf path

Extract the leaf pill into its own `LeafPill` component so it can be reused both standalone and inside `BalloonCluster` without code duplication.

## Files Changed
- `src/components/team/ReverseOrgChart.tsx` (single file, significant restructure of layout + render)

## Summary of Changes

| Change | Impact |
|---|---|
| Pre-process clusters from tree | Groups same-position leaf siblings |
| Layout width uses `CLUSTER_SLOT_WIDTH` | Reduces row width by 60-70% for large teams |
| `BalloonCluster` component | Transparent dashed border wrapping individual pills |
| Extract `LeafPill` component | Reused in both standalone and cluster contexts |
| One line per cluster | Cleaner connector, less SVG clutter |
| Cluster ref registration | Lines connect to cluster container, not individuals |
