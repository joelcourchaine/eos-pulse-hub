
## The Problem

In "Headcount Only" mode, the code groups nodes from `level` (lines 667–684). But clustered leaf members (e.g. technicians, porters grouped into balloon clusters) are stored separately in `layout.clusterLevelMap` — they never appear in `level`. This means every position that was clustered simply doesn't show up in headcount view.

The fix is to also count members from clusters at each level when building the grouped headcount.

## The Fix

In the `headcountOnly` branch of the level renderer (lines 666–687), after building `grouped` from `level`, we also loop over `layout.clusterLevelMap.get(li)` and add each cluster's members into the same `grouped` accumulator by position.

```typescript
// After grouping from level nodes, also fold in cluster members
const clustersAtLevel = layout.clusterLevelMap.get(li) || [];
clustersAtLevel.forEach((pc) => {
  const pos = pc.cluster.position;
  if (!grouped[pos]) grouped[pos] = [];
  // Push synthetic entries (just need .length to count)
  pc.cluster.members.forEach((m) => grouped[pos].push({ node: { member: m, children: [] }, x: 0 }));
});
```

This ensures all positions — both individually rendered AND clustered — appear in the headcount grid.

## Files Changed
- `src/components/team/ReverseOrgChart.tsx` — one small addition inside the `headcountOnly` branch (~5 lines)
