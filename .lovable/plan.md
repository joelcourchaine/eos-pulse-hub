

# Allow Department Managers to Edit User Profiles

## Problem
Jon Ford (department_manager) cannot edit Mike Fischer's email because the database UPDATE policy on the `profiles` table only permits `super_admin` and `store_gm` roles to update other users' records.

## Solution
Replace the two existing UPDATE policies on the `profiles` table with a single unified policy that also grants `department_manager` and `fixed_ops_manager` roles the ability to edit profiles of users in stores where they manage departments.

No application code changes are needed -- this is a database-only fix.

## Technical Details

**Database migration (single SQL file):**

```sql
-- Drop both existing UPDATE policies
DROP POLICY IF EXISTS "Managers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile UPDATE - self and authorized admins" ON public.profiles;

-- Recreate as a single unified UPDATE policy
CREATE POLICY "Profile UPDATE - self and authorized admins"
ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'store_gm')
      AND store_group_id = get_current_user_store_group())
  OR (
    (has_role(auth.uid(), 'department_manager')
     OR has_role(auth.uid(), 'fixed_ops_manager'))
    AND store_id IN (SELECT get_user_store_ids_via_departments(auth.uid()))
  )
)
WITH CHECK (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'store_gm')
      AND store_group_id = get_current_user_store_group())
  OR (
    (has_role(auth.uid(), 'department_manager')
     OR has_role(auth.uid(), 'fixed_ops_manager'))
    AND store_id IN (SELECT get_user_store_ids_via_departments(auth.uid()))
  )
);
```

**How it works:**
- Uses the existing `get_user_store_ids_via_departments()` function which returns store IDs for departments a user manages (either directly or via `user_department_access`)
- Department managers can only edit users in stores where they have department responsibility -- no cross-store access
- Super admins and store GMs retain their existing broader access
- All users can still edit their own profile

