
# Group Same-Role Team Members Together in Org Chart

## Problem

When multiple team members share the same role (e.g., Technician), they can appear scattered across a level row because nodes are added in tree-traversal order, not grouped by position.

## Solution

Sort each level's nodes by position before rendering. This ensures all Technicians appear next to each other, all Advisors together, etc.

## Technical Detail

In `src/components/team/ReverseOrgChart.tsx`, after the `getLevels` function builds the level arrays, sort each level by `member.position` (and secondarily by `member.name` for consistency within a group).

The change is a single addition inside the `getLevels` function -- after collecting all nodes into levels and before returning, sort each level:

```typescript
levels.forEach(level => {
  level.sort((a, b) => {
    const posCmp = a.member.position.localeCompare(b.member.position);
    if (posCmp !== 0) return posCmp;
    return a.member.name.localeCompare(b.member.name);
  });
});
```

This keeps all same-role members adjacent, with alphabetical ordering within each group.

## Files to Update

- `src/components/team/ReverseOrgChart.tsx` -- add sorting logic inside `getLevels`
