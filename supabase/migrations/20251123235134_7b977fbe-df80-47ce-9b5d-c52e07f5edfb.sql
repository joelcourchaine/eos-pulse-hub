-- Fix infinite recursion by simplifying profiles RLS policy
-- The profiles table should NOT call get_user_store_group since that function queries profiles
-- This creates: stores policy → get_user_store_group → profiles policy → get_user_store_group → infinite loop

-- Drop existing policies on profiles
DROP POLICY IF EXISTS "Users can view profiles from their store group only" ON public.profiles;
DROP POLICY IF EXISTS "Managers can update user details" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Super admins can see all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  has_role(auth.uid(), 'super_admin')
);

-- Users can view profiles in their own store group (direct check, no function call)
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
      store_group_id = (SELECT p.store_group_id FROM public.profiles p WHERE p.id = auth.uid())
    )
    OR
    -- Profiles in stores within the same group
    (
      store_id IS NOT NULL AND
      store_id IN (
        SELECT s.id 
        FROM public.stores s
        WHERE s.group_id = (SELECT p.store_group_id FROM public.profiles p WHERE p.id = auth.uid())
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