

# Add Store-Level Resource Filtering

## Overview
Extend the resources system to allow restricting resources to specific stores, in addition to the existing store group filtering. This provides finer-grained control over resource visibility.

## Current Setup
- Resources can be assigned to a **Store Group** (or left as "All Groups")
- Users see resources for their store group or global resources
- No ability to restrict a resource to just one specific store

## Proposed Access Hierarchy
```text
┌─────────────────────────────────────────────┐
│            Resource Visibility              │
├─────────────────────────────────────────────┤
│  store_group_id = NULL, store_id = NULL     │  → Everyone sees it
│  store_group_id = X,    store_id = NULL     │  → Group X users see it
│  store_group_id = X,    store_id = Y        │  → Only Store Y users see it
└─────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Database Changes

**Add `store_id` column to resources table:**
```sql
ALTER TABLE resources ADD COLUMN store_id uuid REFERENCES stores(id);
```

**Create a helper function for current user's store:**
```sql
CREATE OR REPLACE FUNCTION get_current_user_store()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM profiles WHERE id = auth.uid() LIMIT 1
$$;
```

**Update RLS Policy for store-level filtering:**
```sql
-- Drop and recreate the SELECT policy
DROP POLICY IF EXISTS "Users can view active resources" ON resources;

CREATE POLICY "Users can view active resources" ON resources
FOR SELECT USING (
  is_active = true
  AND (store_group_id IS NULL OR store_group_id = get_current_user_store_group())
  AND (store_id IS NULL OR store_id = get_current_user_store())
);
```

### 2. Update Admin Resources Page
- Fetch stores list alongside store groups
- Pass stores to the management dialog
- Add a "Store" filter column to the admin table

### 3. Update Resource Management Dialog
- Add a "Store" dropdown (shown when a Store Group is selected)
- Cascade: selecting a group filters the store dropdown to stores in that group
- Allow "All Stores" option to make resource group-wide

### 4. Update Resource Card Type
Add `store_id` and related store name to the Resource type interface.

## Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Add `store_id` column, helper function, update RLS |
| `src/components/resources/ResourceManagementDialog.tsx` | Add store selector with cascading logic |
| `src/pages/AdminResources.tsx` | Fetch stores, add Store column to table |
| `src/components/resources/ResourceCard.tsx` | Add store type to interface |

## Security Note
The RLS policy enforces both checks:
- User's store group must match (or resource is global)
- **AND** user's store must match (or resource is for all stores in group)

This ensures a resource marked for "River City Ram" won't be visible to users at "Titanium Ford" even though both are in the same store group.

