

## Fix: Support Universal Import Profiles (All Groups)

### Problem
The import system only looks for profiles with a `store_group_id` matching the importing store's group. Profiles configured as "All Groups" (where `store_group_id = NULL`) are never matched, so their mappings are ignored during import.

### Solution
Update the import profile lookup to:
1. First try to find a profile specific to the store's group
2. If none found, fall back to a universal profile (where `store_group_id IS NULL`)

---

### Technical Changes

**File: `src/components/scorecard/ScorecardImportPreviewDialog.tsx`**

Update lines 108-123 to handle universal profiles:

```typescript
// Current query (only matches specific group):
.eq("store_group_id", storeData.group_id)

// Fixed query (matches group OR universal):
// First try specific group, then fall back to universal
```

The query should fetch profiles that either:
- Match the store's `group_id` exactly, OR
- Have `store_group_id = NULL` (universal/all groups)

Then prioritize the specific one over the universal one if both exist.

**Updated Logic:**
```typescript
const { data: importProfile } = useQuery({
  queryKey: ["import-profile-for-store", storeData?.group_id],
  queryFn: async () => {
    // Fetch profiles matching this group OR universal (null)
    const { data, error } = await supabase
      .from("scorecard_import_profiles")
      .select("*")
      .eq("is_active", true)
      .or(`store_group_id.eq.${storeData.group_id},store_group_id.is.null`);
    
    if (error) throw error;
    if (!data || data.length === 0) return null;
    
    // Prioritize specific group match over universal
    const specificMatch = data.find(p => p.store_group_id === storeData.group_id);
    const universalMatch = data.find(p => p.store_group_id === null);
    
    return specificMatch || universalMatch || null;
  },
  enabled: open && !!storeData?.group_id,
});
```

---

### Changes Summary

| File | Change |
|------|--------|
| `ScorecardImportPreviewDialog.tsx` | Update import profile query to include universal profiles (`store_group_id IS NULL`) with fallback priority |

### Result
- Universal "CSR Productivity Report" profile (store_group_id = NULL) will be used for all stores that don't have a group-specific override
- Group-specific profiles still take precedence if they exist
- All mappings created in the Visual Mapper for the universal profile will apply to all stores

