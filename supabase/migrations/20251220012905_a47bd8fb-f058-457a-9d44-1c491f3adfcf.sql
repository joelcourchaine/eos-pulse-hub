DROP POLICY IF EXISTS "Profiles readable by owner, direct manager, or super admin" ON public.profiles;

CREATE POLICY "Profiles readable by owner, direct manager, or super admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- super admins can see all profiles (no tenant restriction)
  has_role(auth.uid(), 'super_admin'::app_role)
  -- others must be in the same store group AND meet one of these conditions
  OR (
    store_group_id = get_current_user_store_group()
    AND (
      -- profile owner
      id = auth.uid()
      -- direct manager
      OR reports_to = auth.uid()
    )
  )
);