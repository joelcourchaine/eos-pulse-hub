
## Two fixes: Target delete + target column visual polish

### Fix 1 — Deleting a target doesn't work (line 2309-2317)

**Current behavior**: When the user clears the input and saves (Enter/blur), `handleTargetSave` checks `trimmedValue === ""` and just closes the edit mode without touching the DB. The old value stays in `kpi_targets` and `kpiTargets` state.

**Fix**: When `trimmedValue === ""`, delete the row from `kpi_targets` instead of doing nothing, then remove the key from `kpiTargets` state so the cell immediately shows `—`.

```typescript
// handleTargetSave - empty means DELETE
if (trimmedValue === "") {
  await supabase
    .from("kpi_targets")
    .delete()
    .eq("kpi_id", kpiId)
    .eq("quarter", quarter)
    .eq("year", year)
    .eq("entry_type", dbEntryType);

  setKpiTargets(prev => {
    const next = { ...prev };
    delete next[kpiId];
    return next;
  });
  setEditingTarget(null);
  setTargetEditValue("");
  return;
}
```

Same fix applies to `handleTrendTargetSave` for monthly/yearly views.

### Fix 2 — Target column visual polish

**Current issues from the screenshot**:
- The navy `bg-[hsl(var(--scorecard-navy))]` header and cells look stark/heavy when most rows just show `—`
- The `—` dash in navy cells is hard to read
- No visual affordance that cells are clickable/editable

**Proposed improvements**:

**Header**: Keep navy background but add a subtle "pencil/edit" icon hint and soften with slightly lighter text opacity on year sub-label. Already reasonable — minor tweak only.

**Data cells (line ~4276-4316)**: When value is `—` (no target), render the dash with reduced opacity (`opacity-40`) so it's clearly "empty" vs a real value. When a target exists, show the value in bold with a subtle edit affordance (pencil icon on hover via `group-hover`).

```tsx
// Target cell — no target set
<span className="opacity-40 text-sm">—</span>

// Target cell — target exists
<span className="font-semibold text-sm cursor-pointer group-hover:underline">
  {formatTarget(...)}
</span>
```

**Also for the monthly/quarterly target cell** (line ~5119-5180): same treatment — the current design uses `text-muted-foreground` which looks washed out against the light background; change to normal foreground with the same empty/present distinction.

### Files to change

- `src/components/scorecard/ScorecardGrid.tsx`:
  - `handleTargetSave` (~line 2312): add DB delete + state cleanup for empty input
  - `handleTrendTargetSave` (similar function): same empty-input delete logic
  - Weekly target cell display (~line 4308-4315): differentiate empty vs set target visually
  - Monthly/quarterly target cell display (~line 5145-5158): same visual treatment
