
## Filter legend to only show positions used by this team

**The issue:** Line 726 in `ReverseOrgChart.tsx` renders a legend badge for *every* entry in `POSITION_LABELS` regardless of whether the team has anyone in that role.

**Fix:** Before rendering the legend, compute a `Set` of positions actually present in `members` (using both `position` and `position_secondary`), then filter `Object.entries(POSITION_LABELS)` to only those keys.

```ts
// Line 724-735 replacement
const usedPositions = useMemo(() => {
  const set = new Set<string>();
  members.forEach(m => {
    if (m.position) set.add(m.position);
    if (m.position_secondary) set.add(m.position_secondary);
  });
  return set;
}, [members]);
```

Then in the legend JSX:
```tsx
{Object.entries(POSITION_LABELS)
  .filter(([key]) => usedPositions.has(key))
  .map(([key, label]) => { ... })}
```

`useMemo` is already imported. Single file change: `src/components/team/ReverseOrgChart.tsx`, lines 725–735.
