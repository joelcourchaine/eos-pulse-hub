
## Group Advisor variants into one balloon cluster

### What's changing

`advisor`, `express_advisor`, and `internal_advisor` currently each form separate clusters. The request is to group them into a single balloon cluster under the same parent, while each pill inside still renders its own distinct position color.

### How the current system works

`buildClusterMap` groups leaf children strictly by `member.position` key → one cluster per position. The `LeafCluster` has a single `position` field used only for the balloon border color. Each `LeafPill` inside uses `member.position` directly, so individual pill colors are unaffected by the cluster's `position` field.

### Plan

**1. Define an "advisor" position group**

Add a small constant:
```ts
const ADVISOR_GROUP = ["advisor", "express_advisor", "internal_advisor"];
```

**2. Add a `getClusterGroupKey(position)` helper**

```ts
function getClusterGroupKey(pos: string): string {
  if (ADVISOR_GROUP.includes(pos)) return "advisor_group";
  return pos;
}
```

**3. Update `buildClusterMap`** to use `getClusterGroupKey` when bucketing leaf children:
- Replace `leafByPos[child.member.position]` with `leafByPos[getClusterGroupKey(child.member.position)]`
- The cluster `id` uses the group key, cluster `position` = `"advisor"` (for border color)
- Threshold for clustering stays at `>= 2` members

**4. Update layout functions** that reference `cluster_${node.member.id}_${pos}` to also use `getClusterGroupKey(pos)` so the cluster ID matches

This is a **pure logic change** — no visual change to individual pills, only the balloon border color comes from `POSITION_COLORS["advisor"]` (teal/blue). Each pill inside still shows its own color.

### Files changed
- `src/components/team/ReverseOrgChart.tsx` only — `buildClusterMap`, `getSubtreeLeafWidth`, `layoutSubtree` (cluster ID generation lines)
