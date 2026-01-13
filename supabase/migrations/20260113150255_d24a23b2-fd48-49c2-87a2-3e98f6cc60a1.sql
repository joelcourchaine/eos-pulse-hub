
-- Fix get_profiles_basic to return role from user_roles table instead of profiles.role
CREATE OR REPLACE FUNCTION public.get_profiles_basic()
RETURNS TABLE (
  id uuid,
  full_name text,
  store_id uuid,
  store_group_id uuid,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT 
    p.id, 
    p.full_name, 
    p.store_id, 
    p.store_group_id, 
    COALESCE(ur.role::text, p.role::text) as role
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE 
    -- Super admins can see all profiles
    EXISTS (SELECT 1 FROM profiles admin WHERE admin.id = auth.uid() AND admin.role = 'super_admin')
    -- User's own profile
    OR p.id = auth.uid()
    -- Profiles in the same store as the current user
    OR p.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    -- Profiles that have access to the current user's store via user_store_access
    OR p.id IN (
      SELECT usa.user_id 
      FROM user_store_access usa 
      WHERE usa.store_id = (SELECT store_id FROM profiles WHERE id = auth.uid())
    )
    -- Current user's stores via user_store_access (for users with multi-store access)
    OR p.store_id IN (
      SELECT usa.store_id 
      FROM user_store_access usa 
      WHERE usa.user_id = auth.uid()
    )
    -- Store GMs can see all profiles in their store group
    OR (
      EXISTS (SELECT 1 FROM profiles gm WHERE gm.id = auth.uid() AND gm.role = 'store_gm')
      AND p.store_group_id = (SELECT store_group_id FROM profiles WHERE id = auth.uid())
    );
$$;
