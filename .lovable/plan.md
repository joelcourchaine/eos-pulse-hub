
## Problem

The target column edit UX is clunky for two reasons:

1. **No `onBlur` save** — clicking/tabbing away from the input discards the value. Users expect click-away to commit.
2. **`✓` confirm button steals focus** — when Enter is pressed, focus can transfer to the button instead of firing the save, making Enter feel unreliable.
3. **Extra click required** — the button adds visual noise and an extra action when Enter should be sufficient.

## Fix

**Remove the `✓` button entirely** from both the weekly target input and the monthly/trend target input. Replace with `onBlur` save so clicking away commits the value. Enter and Escape still work as before.

This affects two input blocks in `ScorecardGrid.tsx`:

### Weekly target (lines 4312–4334)
```tsx
// BEFORE - has ✓ Button next to input
<div className="flex items-center justify-center gap-1">
  <Input ... onKeyDown={Enter→save, Escape→cancel} />
  <Button onClick={save}>✓</Button>
</div>

// AFTER - input only, onBlur saves
<Input
  ...
  onKeyDown={(e) => {
    if (e.key === "Enter") { e.preventDefault(); handleTargetSave(kpi.id); }
    if (e.key === "Escape") setEditingTarget(null);
  }}
  onBlur={() => handleTargetSave(kpi.id)}
  className="w-20 h-7 text-center text-foreground"
  autoFocus
/>
```

### Monthly/trend target (lines 4381–4404)
Same treatment — remove the `✓` Button, add `onBlur`.

### One subtlety to guard against double-save
`handleTargetSave` and `handleTrendTargetSave` are `async` — when Enter is pressed, it triggers the save AND then blur fires immediately after, causing a double save. Fix: track a `savingRef` or simply set `setEditingTarget(null)` synchronously before awaiting the DB call so the blur fires after `editingTarget` is already `null` and the handler early-exits.

The simplest approach: at the top of each save handler, null out the editing state first, then proceed with the DB write.

```typescript
const handleTargetSave = async (kpiId: string) => {
  setEditingTarget(null); // close immediately — prevents double-fire on blur
  const trimmedValue = targetEditValue.trim();
  // ... rest of save logic
};
```

## Files to change

- `src/components/scorecard/ScorecardGrid.tsx`:
  - `handleTargetSave` (~line 2309): move `setEditingTarget(null)` to top
  - `handleTrendTargetSave` (~line 2468): move `setEditingTrendTarget(null)` to top  
  - Weekly target input (~line 4312): remove `<Button>✓</Button>`, add `onBlur`, add `e.preventDefault()` on Enter
  - Monthly/trend target input (~line 4381): same — remove button, add `onBlur`, add `e.preventDefault()` on Enter
