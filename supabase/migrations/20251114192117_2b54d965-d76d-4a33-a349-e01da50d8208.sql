-- Add store_group_id to profiles table for multi-store access
ALTER TABLE public.profiles
ADD COLUMN store_group_id uuid REFERENCES public.store_groups(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_profiles_store_group_id ON public.profiles(store_group_id);

-- Update the get_user_store function to handle store groups
CREATE OR REPLACE FUNCTION public.get_user_stores(_user_id uuid)
RETURNS TABLE(store_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Return user's direct store
  SELECT profiles.store_id
  FROM public.profiles
  WHERE profiles.id = _user_id AND profiles.store_id IS NOT NULL
  
  UNION
  
  -- Return all stores in user's store group
  SELECT stores.id
  FROM public.profiles
  JOIN public.stores ON stores.group_id = profiles.store_group_id
  WHERE profiles.id = _user_id AND profiles.store_group_id IS NOT NULL
$$;

-- Update RLS policy for profiles to handle store groups
DROP POLICY IF EXISTS "Users can view profiles from their store" ON public.profiles;

CREATE POLICY "Users can view profiles from their store or group"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Super admins can see all profiles
    has_role(auth.uid(), 'super_admin'::app_role)
    OR
    -- Users can see profiles from their store
    (store_id IS NOT NULL AND store_id = get_user_store(auth.uid()))
    OR
    -- Users can see profiles from their store group
    (store_group_id IS NOT NULL AND store_group_id IN (
      SELECT store_group_id FROM public.profiles WHERE id = auth.uid()
    ))
    OR
    -- Users can see their own profile
    id = auth.uid()
  )
);