-- Fix get_profiles_basic() to filter by store group
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
  SELECT p.id, p.full_name, p.store_id, p.store_group_id, p.role::text
  FROM profiles p
  WHERE 
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR p.store_group_id = public.get_current_user_store_group()
    OR p.id = auth.uid();
$$;