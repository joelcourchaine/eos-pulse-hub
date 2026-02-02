
# Add Group-Specific Resource Support

## Overview
Enable super admins to assign resources to specific store groups, so only users within that group can see those resources. The database already supports this via the `store_group_id` column and RLS policy - we just need to expose it in the UI.

## Current State
- **Database**: `resources.store_group_id` column exists (nullable foreign key to `store_groups`)
- **RLS Policy**: Already filters resources by user's store group:
  - `store_group_id IS NULL` → visible to everyone
  - `store_group_id = get_current_user_store_group()` → visible only to that group's users
- **UI**: No way to set `store_group_id` when creating/editing resources

## Changes Required

### 1. Update Resource Interface
**File: `src/components/resources/ResourceCard.tsx`**

Add `store_group_id` and `store_groups` to the Resource interface:
```typescript
export interface Resource {
  // ... existing fields
  store_group_id: string | null;
  store_groups?: { name: string } | null;
}
```

### 2. Update ResourceManagementDialog
**File: `src/components/resources/ResourceManagementDialog.tsx`**

- Accept `storeGroups` prop (list of available groups)
- Add state for `storeGroupId`
- Add a "Store Group" dropdown selector (similar to Department selector)
- Include `store_group_id` in the save payload
- Pre-populate when editing existing resource

New UI element (placed after Department selector):
```
Store Group (optional)
[All Groups ▾]
```

### 3. Update Resources.tsx (User View)
**File: `src/pages/Resources.tsx`**

- Update the query to include `store_group_id` and join `store_groups`
- Display group badge on resource cards (optional enhancement)

### 4. Update AdminResources.tsx (Admin View)
**File: `src/pages/AdminResources.tsx`**

- Fetch store groups list
- Pass `storeGroups` prop to ResourceManagementDialog
- Add "Group" column to the admin table
- Update query to include `store_group_id` and join `store_groups`

## User Experience

### For Super Admins (Creating/Editing Resources):
1. Open resource management dialog
2. See new "Store Group" dropdown after Department
3. Select "All Groups" (default, visible to everyone) or a specific group
4. Save - resource is now group-restricted

### For Regular Users (Viewing Resources):
1. RLS policy automatically filters resources
2. See only resources where `store_group_id IS NULL` OR matches their group
3. Optionally see a badge indicating the resource is group-specific

## Technical Notes

1. **RLS Already Working**: The policy `(store_group_id IS NULL) OR (store_group_id = get_current_user_store_group())` handles filtering automatically
2. **No Database Changes**: The `store_group_id` column already exists
3. **Super Admin Bypass**: Super admins have a separate policy allowing full access to all resources
4. **Backward Compatible**: Existing resources have `store_group_id = NULL`, so they remain visible to all users

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/resources/ResourceCard.tsx` | Add `store_group_id` and `store_groups` to interface |
| `src/components/resources/ResourceManagementDialog.tsx` | Add store group selector and save logic |
| `src/pages/Resources.tsx` | Update query to include store group data |
| `src/pages/AdminResources.tsx` | Fetch groups, pass to dialog, add table column |
