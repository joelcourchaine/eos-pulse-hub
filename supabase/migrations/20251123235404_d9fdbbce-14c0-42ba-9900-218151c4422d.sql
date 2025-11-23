-- Fix circular dependency between stores and profiles policies
-- The issue: stores policy → get_user_store_group → profiles table → profiles policy → stores table → loop

-- First, let's create separate security definer functions that will NOT trigger RLS
CREATE OR REPLACE FUNCTION public.get_user_store_group_no_rls(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This bypasses RLS completely by using SECURITY DEFINER
  SELECT store_group_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_store_no_rls(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This bypasses RLS completely by using SECURITY DEFINER
  SELECT store_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Now recreate the stores policy using the new function
DROP POLICY IF EXISTS "Users can view stores in their group" ON public.stores;
DROP POLICY IF EXISTS "Super admins can manage stores" ON public.stores;

-- Super admins can manage all stores
CREATE POLICY "Super admins can manage stores"
ON public.stores
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Users can view stores in their group
CREATE POLICY "Users can view stores in their group"
ON public.stores
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    group_id = get_user_store_group_no_rls(auth.uid()) OR
    id = get_user_store_no_rls(auth.uid())
  )
);

-- Also update profiles policy to NOT query stores (remove the circular reference)
DROP POLICY IF EXISTS "Users can view profiles in same store group" ON public.profiles;

CREATE POLICY "Users can view profiles in same store group"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User's own profile
    id = auth.uid() 
    OR
    -- Profiles with same store_group_id (direct comparison, no store lookup)
    (
      store_group_id IS NOT NULL AND
      store_group_id = get_current_user_store_group()
    )
  )
);