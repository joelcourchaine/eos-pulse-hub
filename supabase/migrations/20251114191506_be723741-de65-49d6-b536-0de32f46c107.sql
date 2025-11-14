-- Drop the old policy that allows all authenticated users to view all profiles
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

-- Create new policy: Users can view profiles from their own store
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
    store_id IN (
      SELECT store_id 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);