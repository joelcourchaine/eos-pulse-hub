
## Plan: Draggable Progress Bar on Rocks

Replace the static `<Progress>` bar with an interactive drag-to-update slider directly on the rock card. Clicking/dragging anywhere on the bar updates `progress_percentage` immediately and persists to the database.

### Changes to `src/components/rocks/RocksPanel.tsx`

1. **Add drag state** — add `updatingRockId` state to track which rock is being saved (for loading indicator).

2. **Add `handleProgressChange` function** — takes `rockId` and new `value`, calls `supabase.from("rocks").update({ progress_percentage: value })`, then calls `loadRocks()`.

3. **Replace the progress bar UI** (~lines 493–500) — swap `<Progress>` for a `<Slider>` from `@/components/ui/slider` with:
   - `value={[rock.progress_percentage]}`
   - `onValueChange` for live preview (local state update)
   - `onValueCommit` to persist to DB (fires on mouse-up/drag-end)
   - `min={0}` `max={100}` `step={1}`
   - `className="h-2 cursor-pointer"`
   - Keep the `{rock.progress_percentage}%` label updating live as user drags

4. **Local optimistic update** — maintain a `pendingProgress` map `{ [rockId]: number }` so the displayed % updates instantly while dragging, without waiting for DB round-trip.

### Implementation detail

```tsx
// State additions
const [pendingProgress, setPendingProgress] = useState<{[id: string]: number}>({});
const [updatingRockId, setUpdatingRockId] = useState<string | null>(null);

// Handler
const handleProgressCommit = async (rockId: string, value: number) => {
  setUpdatingRockId(rockId);
  await supabase.from("rocks").update({ progress_percentage: value }).eq("id", rockId);
  setUpdatingRockId(null);
  loadRocks();
};

// UI swap (lines ~493-500)
<div className="flex items-center justify-between text-sm">
  <span className="text-muted-foreground">Progress</span>
  <span className="font-medium">{pendingProgress[rock.id] ?? rock.progress_percentage}%</span>
</div>
<Slider
  value={[pendingProgress[rock.id] ?? rock.progress_percentage]}
  min={0} max={100} step={1}
  onValueChange={([v]) => setPendingProgress(p => ({...p, [rock.id]: v}))}
  onValueCommit={([v]) => handleProgressCommit(rock.id, v)}
  className="cursor-pointer"
/>
```

Single file: `src/components/rocks/RocksPanel.tsx`
