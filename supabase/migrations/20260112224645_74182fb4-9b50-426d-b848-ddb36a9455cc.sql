-- Update get_profiles_basic() to filter by specific store for all users
-- Everyone sees only profiles from their store (or stores they have access to)

CREATE OR REPLACE FUNCTION public.get_profiles_basic()
RETURNS TABLE (id uuid, full_name text, store_id uuid, store_group_id uuid, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.full_name, p.store_id, p.store_group_id, p.role::text
  FROM profiles p
  WHERE 
    -- User's own profile
    p.id = auth.uid()
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
    );
$$;