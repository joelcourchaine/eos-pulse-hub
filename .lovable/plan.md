
## Fix: Restrict Import Preview User Dropdown to Current Store Only

### Problem
The "Select user" dropdown in the Scorecard Import Preview dialog shows users from the entire store group instead of just the selected store. This is confusing because users should only be able to map advisors to users who work at that specific dealership.

### Solution
Modify the `storeUsers` query to only fetch users whose `store_id` matches the current import store, removing the store group fallback.

### Technical Changes

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

Update lines 93-113 to simplify the query:

```typescript
// Current (fetches store + group users):
const { data: storeUsers } = useQuery({
  queryKey: ["store-users-for-import", storeId, storeData?.group_id],
  queryFn: async () => {
    let query = supabase
      .from("profiles")
      .select("id, full_name, role, store_id, store_group_id")
      .order("full_name");

    if (storeData?.group_id) {
      query = query.or(`store_id.eq.${storeId},store_group_id.eq.${storeData.group_id}`);
    } else {
      query = query.eq("store_id", storeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  enabled: open && !!storeId,
});

// Fixed (fetches only current store users):
const { data: storeUsers } = useQuery({
  queryKey: ["store-users-for-import", storeId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, store_id, store_group_id")
      .eq("store_id", storeId)
      .order("full_name");
    if (error) throw error;
    return data;
  },
  enabled: open && !!storeId,
});
```

### Changes Summary
- Remove the store group fallback from the user query
- Simplify query key (no longer depends on `storeData?.group_id`)
- Users in the dropdown will now only be those directly assigned to the importing store

### Impact
- The dropdown will show fewer, more relevant users
- Advisors can only be mapped to users who actually work at that store
- No changes to the matching algorithm or alias creation logic
