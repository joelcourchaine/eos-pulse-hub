
## Goal
When a user moves the growth slider, show a confirmation dialog warning them that it will overwrite all manually-entered forecast cells. Only proceed if they confirm.

## How the slider currently works
- `ForecastDriverInputs` calls `onGrowthChange(v)` on every slider drag value change
- `ForecastDrawer` handles this inline at line 1880–1884: sets `userChangedDrivers.current = true`, calls `setGrowth(v)`, and calls `markDirty()` which triggers the auto-save effect
- The auto-save effect (line 854–858) has a guard: if `userChangedDrivers.current = false`, it skips overwriting manual cells. When the user moves the slider, `userChangedDrivers.current = true` and all unlocked cells get recalculated and overwritten.

So the "reset" behaviour already exists — the slider genuinely does overwrite everything. The warning just needs to gate the first slider interaction when manual edits already exist.

## When to show the warning
Only when `hasTotalSalesManualEdits` is `true` (i.e. the user previously typed in cell values). If no manual edits exist, the slider should work silently as before.

## Plan

### 1. Add confirmation state to `ForecastDrawer.tsx`
Add a `pendingGrowthValue` state (`number | null`). When the user touches the slider AND `hasTotalSalesManualEdits` is true, instead of applying the growth immediately, store the value in `pendingGrowthValue` to trigger the dialog.

### 2. Add a confirmation `AlertDialog` in `ForecastDrawer.tsx`
Inside the JSX, add an `AlertDialog` (already imported as a component) that:
- Opens when `pendingGrowthValue !== null`
- Title: "Overwrite Manual Forecasts?"
- Description: "Moving the growth slider will recalculate all unlocked cells and overwrite any values you've entered manually. This cannot be undone."
- Cancel: sets `pendingGrowthValue = null`, keeps current growth unchanged
- Confirm ("Apply Growth"): applies `pendingGrowthValue` to `growth`, sets `userChangedDrivers.current = true`, calls `markDirty()`, then clears `pendingGrowthValue`

### 3. Update the `onGrowthChange` handler in `ForecastDrawer.tsx`
```ts
onGrowthChange={(v) => {
  if (hasTotalSalesManualEdits && !userChangedDrivers.current) {
    // First time touching slider when manual edits exist — show warning
    setPendingGrowthValue(v);
  } else {
    // No manual edits, or user already confirmed in this session — apply directly
    markDirty();
    userChangedDrivers.current = true;
    setGrowth(v);
    setSaveTrigger(c => c + 1);
  }
}}
```

Note: once the user confirms once (`userChangedDrivers.current = true`), subsequent slider drags in the same session apply immediately without re-prompting — the cells have already been wiped.

### 4. Pass `pendingGrowthValue` visual hint back to `ForecastDriverInputs`
Add an optional `isPendingConfirm` prop to `ForecastDriverInputs` so the slider can visually show a subtle warning state (yellow ring / warning icon) while a confirmation is pending. This is optional polish but worth including.

### Files to change
- `src/components/financial/ForecastDrawer.tsx` — add `pendingGrowthValue` state, update `onGrowthChange` handler, add `AlertDialog`
- `src/components/financial/forecast/ForecastDriverInputs.tsx` — add optional `hasManualEdits` prop to show a small warning hint below the slider ("Moving this slider will overwrite manual entries"), and accept `isPendingConfirm` for visual feedback
