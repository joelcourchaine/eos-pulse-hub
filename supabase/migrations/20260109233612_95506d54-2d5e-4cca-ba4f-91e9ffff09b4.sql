-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view active announcements for their groups" ON public.announcements;

-- Create a new policy that includes super_admins
CREATE POLICY "Users can view active announcements for their groups"
ON public.announcements
FOR SELECT
USING (
  -- Super admins can see all announcements
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'super_admin'::app_role
  )
  OR
  -- Regular users can see active, non-expired announcements for their store group
  (
    is_active = true 
    AND now() >= starts_at 
    AND now() <= expires_at 
    AND (
      store_group_id IS NULL 
      OR store_group_id = public.get_user_store_group(auth.uid())
    )
  )
);