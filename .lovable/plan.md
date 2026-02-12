

## Fix: Clear Session Storage on First New Selection

### Problem
When you navigate back from the Dealer Comparison report to the Enterprise page, the previous store/brand/group selections are restored from session storage. When you then start picking new stores, the old selections remain, causing the report to show a mix of old and new selections (e.g., 6 stores instead of 3).

### Solution
Track whether the user has made a "fresh" selection since the page loaded. On the **first** toggle action (store, brand, or group checkbox click), clear all existing selections before applying the new one. Subsequent toggles within the same session behave normally (add/remove).

### Technical Details

**File: `src/pages/Enterprise.tsx`**

1. Add a `useRef` flag to track if selections have been touched since mount:

```typescript
const hasStartedNewSelection = useRef(false);
```

2. Update `toggleStoreSelection`, `toggleBrandSelection`, and `toggleGroupSelection` to clear stale selections on the first click:

```typescript
const toggleStoreSelection = (storeId: string) => {
  if (!hasStartedNewSelection.current) {
    hasStartedNewSelection.current = true;
    // Clear all prior selections and start fresh with just this store
    setSelectedStoreIds([storeId]);
    setSelectedBrandIds([]);
    setSelectedGroupIds([]);
    setSelectedDepartmentNames([]);
    setSelectedMetrics([]);
    return;
  }
  setSelectedStoreIds(prev =>
    prev.includes(storeId)
      ? prev.filter(id => id !== storeId)
      : [...prev, storeId]
  );
};
```

Same pattern for `toggleBrandSelection` and `toggleGroupSelection` -- on first click, reset everything and start with just the clicked item.

3. Also clear departments and metrics on first selection since those are tied to the store context and should be re-chosen for the new set of stores.

4. When a saved filter is loaded via `loadFilter()`, set `hasStartedNewSelection.current = true` so that loading a saved filter doesn't trigger the reset behavior on the next click.

### What This Fixes
- First click in the filter panel after returning from a report clears all stale selections
- No more "6 stores" showing when you only picked 3
- Subsequent clicks add/remove normally within the new selection session

### What Stays the Same
- Session storage persistence still works for page refreshes mid-selection
- Saved filters load correctly
- Trend reports and other views are unaffected
