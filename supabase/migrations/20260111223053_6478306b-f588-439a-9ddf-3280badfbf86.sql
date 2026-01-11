-- Drop all existing profile policies to start fresh
DROP POLICY IF EXISTS "Full profile access - self or super admin only" ON public.profiles;
DROP POLICY IF EXISTS "Profile update - self or admin" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- SELECT: Users can only see their own profile, super_admins and store_gms can see profiles in their scope
CREATE POLICY "Profile SELECT - self and authorized admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()  -- Self
  OR has_role(auth.uid(), 'super_admin'::app_role)  -- Super admins see all
  OR (
    has_role(auth.uid(), 'store_gm'::app_role) 
    AND store_group_id = get_current_user_store_group()  -- Store GMs see their group only
  )
);

-- INSERT: Block all client inserts (profiles created by auth trigger)
CREATE POLICY "Profile INSERT - blocked"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: Self or privileged admins only
CREATE POLICY "Profile UPDATE - self and authorized admins"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'store_gm'::app_role) AND store_group_id = get_current_user_store_group())
)
WITH CHECK (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'store_gm'::app_role) AND store_group_id = get_current_user_store_group())
);

-- DELETE: Super admins only
CREATE POLICY "Profile DELETE - super admin only"
ON public.profiles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));