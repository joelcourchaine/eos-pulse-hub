
## Root Cause

The `loadData()` function (which fetches recipients AND `top_10_lists`) lives inside the Dialog's `onOpenChange` callback. When the "Email Report" button calls `setPrintDialogOpen(true)` directly, Radix **does not call `onOpenChange`** — it only fires `onOpenChange` in response to user interactions like Escape or overlay click. So `availableTop10Lists` is never populated.

This is why the Top 10 lists don't appear — `loadData()` simply never runs when the dialog opens via the button.

Also, the "Technician" SelectItem still needs to be added to the scorecard role filter dropdown as previously planned but not yet fully implemented.

## Fix

**In `src/pages/Dashboard.tsx`:**

**1. Extract `loadData` into a `useEffect` that watches `printDialogOpen`**

Replace the inline `loadData()` call inside `onOpenChange` with a `useEffect`:

```typescript
useEffect(() => {
  if (!printDialogOpen) return;
  const loadData = async () => {
    // ... existing load logic (recipients + top_10_lists)
  };
  loadData();
}, [printDialogOpen, selectedDepartment]);
```

This way, whenever `printDialogOpen` becomes `true` (regardless of how it was set), the data loads. The `onOpenChange` handler just needs to call `setPrintDialogOpen(open)` without the data loading logic.

**2. Add "Technician" to the role filter dropdown**

Add one `<SelectItem value="technician">Technician</SelectItem>` after the `service_advisor` entry in the Custom Report scorecard role selector.

## Files Changed

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Move `loadData` from `onOpenChange` to a `useEffect` watching `printDialogOpen`; add Technician option to role filter |
