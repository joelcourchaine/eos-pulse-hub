-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Only super admins can manage roles" ON public.user_roles;

-- Create a new policy using the security definer function to avoid recursion
CREATE POLICY "Only super admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));