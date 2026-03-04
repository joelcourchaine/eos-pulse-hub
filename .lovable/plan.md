
## Filter vacant positions to only those used by active members

**The issue:** `vacantPositions` currently shows all unique positions across vacant members. But if someone added a vacant "Porter" to a team that has no other Porters, it still shows. The user wants the vacant position labels to only reflect positions that are "part of this department" — i.e., positions that also have at least one filled (active) member.

**Fix:** Before building `vacantPositions`, collect the set of positions used by active members. Then filter vacant members to only those whose `position` exists in that active set.

```ts
const activePositions = new Set(
  members
    .filter(m => m.name && m.name !== "Vacant" && (m as any).status !== "vacant")
    .map(m => m.position)
);

const vacantPositions = [
  ...new Set(
    vacantMembers
      .filter(m => activePositions.has(m.position))
      .map(m => POSITION_LABEL[m.position] || m.position)
  )
];
```

This means: if this store has active Advisors and Technicians, vacant slots for those roles will show. A vacant "Porter" slot won't appear unless there's also an active Porter on the team.

**Single line change** in `src/pages/MyTeam.tsx`, replace line 169.
