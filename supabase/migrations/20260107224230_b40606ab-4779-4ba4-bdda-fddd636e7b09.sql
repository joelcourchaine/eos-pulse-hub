-- Create a SECURITY DEFINER function to bypass RLS for basic profile data
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
  SELECT id, full_name, store_id, store_group_id, role::text
  FROM profiles;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profiles_basic() TO authenticated;

-- Drop old permissive policy
DROP POLICY IF EXISTS "Profiles readable by owner, same store group, or super admin" ON public.profiles;

-- Create restrictive policy for full profile data (sensitive fields like birthday, email)
CREATE POLICY "Profiles readable by self or manager or super admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (has_role(auth.uid(), 'store_gm'::app_role) AND store_group_id = get_current_user_store_group())
  OR reports_to = auth.uid()
);