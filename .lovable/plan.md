

# Allow Users to Add Resources to Their Own Store

## Overview
Enable regular users to add, edit, and delete their own resources, restricted to their assigned store. This empowers users to share helpful materials with their colleagues while maintaining proper security boundaries.

## Current State
- Only super admins can create/edit/delete resources
- Regular users can only view resources
- No "Add Resource" button exists on the My Resources page
- The `resources` table already has a `created_by` column tracking who created each resource

## Proposed User Experience

### My Resources Page Changes
- Add an "Add Resource" button in the header (visible to all authenticated users)
- Users can create resources that are automatically assigned to their store
- Users see an edit/delete button only on resources they created
- Super admins retain full access to all resources

### Resource Ownership Rules
| User Type | Can Create | Can Edit/Delete | Can View |
|-----------|------------|-----------------|----------|
| Regular User | ✅ Own store only | ✅ Own resources only | ✅ Their store/group resources |
| Super Admin | ✅ Any store | ✅ Any resource | ✅ All resources |

## Technical Implementation

### 1. Database Changes

**Update RLS Policies:**
```sql
-- Allow users to INSERT resources for their own store
CREATE POLICY "Users can create resources for their store" ON resources
FOR INSERT WITH CHECK (
  store_id = get_current_user_store() 
  AND store_group_id = get_current_user_store_group()
  AND created_by = auth.uid()
);

-- Allow users to UPDATE their own resources
CREATE POLICY "Users can update their own resources" ON resources
FOR UPDATE USING (
  created_by = auth.uid()
);

-- Allow users to DELETE their own resources
CREATE POLICY "Users can delete their own resources" ON resources
FOR DELETE USING (
  created_by = auth.uid()
);
```

### 2. Frontend Changes

**Resources.tsx:**
- Add "Add Resource" button in the header
- Fetch current user's store info to pass to the dialog
- Update `canEdit` logic to include resource ownership check
- Track current user ID to compare with resource `created_by`

**ResourceCard.tsx:**
- Accept additional prop for `currentUserId`
- Show edit button if user is super admin OR if `created_by === currentUserId`

**ResourceManagementDialog.tsx:**
- When a regular user opens the dialog, pre-fill and lock the store/group to their assigned store
- Only super admins can select different stores
- Ensure `created_by` is set on insert

### 3. Resource Type Update
Add `created_by` to the Resource interface for ownership checks:
```typescript
export interface Resource {
  // ... existing fields
  created_by: string | null;
}
```

## Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Add INSERT/UPDATE/DELETE policies for user-owned resources |
| `src/pages/Resources.tsx` | Add "Add Resource" button, fetch user store, update edit logic |
| `src/components/resources/ResourceCard.tsx` | Show edit button for resource owner |
| `src/components/resources/ResourceManagementDialog.tsx` | Lock store selection for regular users |
| `src/components/resources/ResourceGrid.tsx` | Pass through `currentUserId` prop |

## Security Enforcement

The RLS policies ensure:
1. Users can only create resources assigned to their own store
2. Users can only edit/delete resources they created
3. The `created_by` field must match the current user on insert
4. Super admins retain full access through the existing "Super admins can manage resources" policy

