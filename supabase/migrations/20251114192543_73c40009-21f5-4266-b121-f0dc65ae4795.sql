-- Create a security definer function to get user's store_group_id
CREATE OR REPLACE FUNCTION public.get_user_store_group(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_group_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Drop and recreate the policy without recursion
DROP POLICY IF EXISTS "Users can view profiles from their store or group" ON public.profiles;

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
    (store_group_id IS NOT NULL AND store_group_id = get_user_store_group(auth.uid()))
    OR
    -- Users can see their own profile
    id = auth.uid()
  )
);