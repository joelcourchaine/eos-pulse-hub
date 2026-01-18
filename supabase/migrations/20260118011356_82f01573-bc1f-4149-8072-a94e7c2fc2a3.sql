-- Create a helper function to check if user has elevated access (super_admin or consulting_scheduler)
CREATE OR REPLACE FUNCTION public.has_elevated_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id 
      AND role IN ('super_admin', 'consulting_scheduler')
  )
$$;

-- Update stores SELECT policy to include consulting_scheduler
DROP POLICY IF EXISTS "Users can view stores in their group" ON public.stores;
CREATE POLICY "Users can view stores in their group" 
ON public.stores FOR SELECT 
USING (
  has_elevated_access(auth.uid())
  OR group_id = get_user_store_group(auth.uid())
  OR id IN (SELECT store_id FROM get_user_stores_access(auth.uid()))
);

-- Update store_groups SELECT policy to include consulting_scheduler
DROP POLICY IF EXISTS "Users can view their store group" ON public.store_groups;
CREATE POLICY "Users can view their store group" 
ON public.store_groups FOR SELECT 
USING (
  has_elevated_access(auth.uid())
  OR id = get_user_store_group(auth.uid())
);

-- Update departments SELECT policy to include consulting_scheduler
DROP POLICY IF EXISTS "Users can view accessible departments" ON public.departments;
CREATE POLICY "Users can view accessible departments" 
ON public.departments FOR SELECT 
USING (
  has_elevated_access(auth.uid())
  OR store_id IN (SELECT store_id FROM get_user_stores(auth.uid()))
  OR id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

-- Update profiles SELECT policy to include consulting_scheduler
DROP POLICY IF EXISTS "Users can view accessible profiles" ON public.profiles;
CREATE POLICY "Users can view accessible profiles" 
ON public.profiles FOR SELECT 
USING (
  has_elevated_access(auth.uid())
  OR id = auth.uid()
  OR store_id IN (SELECT store_id FROM get_user_stores(auth.uid()))
  OR store_group_id = get_user_store_group(auth.uid())
  OR id IN (SELECT user_id FROM user_store_access WHERE store_id IN (SELECT store_id FROM get_user_stores(auth.uid())))
);