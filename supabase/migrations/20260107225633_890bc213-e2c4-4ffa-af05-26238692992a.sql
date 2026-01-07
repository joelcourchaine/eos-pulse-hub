-- Stricter RLS: Only self or super_admin see full profile
-- Managers/GMs can use get_profiles_basic() for basic info they need

DROP POLICY IF EXISTS "Profiles readable by self or manager or super admin" ON public.profiles;

CREATE POLICY "Full profile access - self or super admin only"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
);