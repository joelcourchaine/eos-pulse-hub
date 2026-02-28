
## Problem
`handleProgressCommit` calls `loadRocks()` after saving, which re-fetches all rocks from the database ordered by `created_at DESC`. This full re-render causes rocks to visually jump/reorder because React reconciles the new list from scratch.

## Fix: Update local state instead of re-fetching

Replace `loadRocks()` in `handleProgressCommit` with a local state update that patches just the `progress_percentage` of the affected rock in place — no refetch, no reorder.

```ts
const handleProgressCommit = async (rockId: string, value: number) => {
  setUpdatingRockId(rockId);
  await supabase.from("rocks").update({ progress_percentage: value }).eq("id", rockId);
  setUpdatingRockId(null);
  setPendingProgress(p => { const n = {...p}; delete n[rockId]; return n; });
  // Patch local state instead of full refetch
  setRocks(prev => prev.map(r => r.id === rockId ? { ...r, progress_percentage: value } : r));
};
```

**Single file:** `src/components/rocks/RocksPanel.tsx` — line 279: replace `loadRocks()` with `setRocks(prev => prev.map(r => r.id === rockId ? { ...r, progress_percentage: value } : r))`
