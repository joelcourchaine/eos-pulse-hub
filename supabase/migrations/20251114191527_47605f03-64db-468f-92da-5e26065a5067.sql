-- Create a security definer function to get user's store
CREATE OR REPLACE FUNCTION public.get_user_store(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Drop and recreate the policy using the function
DROP POLICY IF EXISTS "Users can view profiles from their store" ON public.profiles;

CREATE POLICY "Users can view profiles from their store"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Super admins can see all profiles
    has_role(auth.uid(), 'super_admin'::app_role)
    OR
    -- Other users can only see profiles from their store
    (store_id IS NOT NULL AND store_id = get_user_store(auth.uid()))
    OR
    -- Users without a store can see their own profile
    (store_id IS NULL AND id = auth.uid())
  )
);