-- Allow super admins and store GMs to view all user store access records
CREATE POLICY "Admins can view all store access"
ON public.user_store_access
FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role)
);