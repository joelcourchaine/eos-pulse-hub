-- Drop the current SELECT policy that fails when store_group_id is NULL
DROP POLICY IF EXISTS "Profiles readable by owner, direct manager, or super admin" ON public.profiles;

-- Create a new policy that handles NULL store_group_id correctly
-- Users can always read their own profile
-- Super admins can read all profiles
-- Users within the same store group can read profiles of colleagues (including self and direct reports)
-- Uses COALESCE and OR logic to handle NULL store_group_id gracefully
CREATE POLICY "Profiles readable by owner, same store group, or super admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- User can always read their own profile
  id = auth.uid()
  -- Super admins can read all profiles
  OR has_role(auth.uid(), 'super_admin'::app_role)
  -- Store GMs can read profiles in their store group
  OR (
    has_role(auth.uid(), 'store_gm'::app_role)
    AND (
      -- If both have store_group_id set, compare them
      (store_group_id IS NOT NULL AND store_group_id = get_current_user_store_group())
      -- Or use derived store group comparison
      OR get_user_store_group_no_rls(id) = get_current_user_store_group()
    )
  )
  -- Direct reports can be read by their manager
  OR reports_to = auth.uid()
);