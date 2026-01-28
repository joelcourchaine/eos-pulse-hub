
# Fix: Routine Task Limit at 7 Items

## Problem Identified
The `AddRoutineItemInline` component receives `currentItems` as a prop from `RoutineChecklist`. When adding an item, it builds the new array using:
```javascript
const updatedItems = [...currentItems, newItem];
```

However, if the user adds items quickly or the refetch hasn't completed, `currentItems` contains stale data. This causes the update to overwrite newer items with old data, effectively capping the list.

## Root Cause
The `handleAdd` function uses `currentItems` prop directly instead of fetching the current state from the database. This creates a race condition:
1. User adds item 7 → DB now has 7 items
2. User clicks "Add" for item 8 before `refetchRoutine` completes
3. `currentItems` still shows 6 items (stale prop)
4. PATCH request sends `[...6 items, new item]` = 7 items
5. Database overwrites the 7th item with the new item

## Solution
Fetch the current routine items directly from the database in `handleAdd` before appending the new item. This ensures we always append to the latest state.

---

## Technical Changes

### File: `src/components/routines/AddRoutineItemInline.tsx`

**Current code (lines 47-63):**
```typescript
setSaving(true);
try {
  const newItem: RoutineItem = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    description: "",
    order: currentItems.length + 1,
  };

  const updatedItems = [...currentItems, newItem];

  const { error } = await supabase
    .from("department_routines")
    .update({ items: updatedItems as unknown as any })
    .eq("id", routineId);
```

**New code:**
```typescript
setSaving(true);
try {
  // Fetch current items from database to avoid stale state
  const { data: routineData, error: fetchError } = await supabase
    .from("department_routines")
    .select("items")
    .eq("id", routineId)
    .single();

  if (fetchError) throw fetchError;

  const existingItems: RoutineItem[] = Array.isArray(routineData?.items)
    ? (routineData.items as unknown as RoutineItem[])
    : [];

  const newItem: RoutineItem = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    description: "",
    order: existingItems.length + 1,
  };

  const updatedItems = [...existingItems, newItem];

  const { error } = await supabase
    .from("department_routines")
    .update({ items: updatedItems as unknown as any })
    .eq("id", routineId);
```

---

## Summary

| File | Change |
|------|--------|
| `src/components/routines/AddRoutineItemInline.tsx` | Fetch current items from DB before appending |

This ensures that no matter how quickly the user adds items, each addition always appends to the latest database state, preventing any overwrites or data loss.
