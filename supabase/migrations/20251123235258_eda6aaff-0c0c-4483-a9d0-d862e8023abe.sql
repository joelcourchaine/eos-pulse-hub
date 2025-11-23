-- Create a security definer function to get current user's store_group_id
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_store_group()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_group_id uuid;
BEGIN
  -- Bypass RLS by using security definer
  SELECT store_group_id INTO v_store_group_id
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  RETURN v_store_group_id;
END;
$$;

-- Recreate profiles policies using the new function
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles in same store group" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Super admins can see all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'super_admin')
);

-- Users can view profiles in their own store group (using security definer function)
CREATE POLICY "Users can view profiles in same store group"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- User's own profile
    id = auth.uid() 
    OR
    -- Profiles with same store_group_id (both not null)
    (
      store_group_id IS NOT NULL AND
      store_group_id = get_current_user_store_group()
    )
    OR
    -- Profiles in stores within the same group
    (
      store_id IS NOT NULL AND
      store_id IN (
        SELECT s.id 
        FROM public.stores s
        WHERE s.group_id = get_current_user_store_group()
      )
    )
  )
);

-- Store GMs and super admins can update profiles
CREATE POLICY "Managers can update profiles"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'store_gm')
  )
);

-- Users can update their own profile (but not role)
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);