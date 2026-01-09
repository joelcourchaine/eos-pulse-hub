-- Fix announcements RLS to use the dedicated user_roles system via has_role()

-- Replace admin-manage policy
DROP POLICY IF EXISTS "Super admins can manage all announcements" ON public.announcements;
CREATE POLICY "Super admins can manage all announcements"
ON public.announcements
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Replace read policy (also allow super_admins to read everything)
DROP POLICY IF EXISTS "Users can view active announcements for their groups" ON public.announcements;
CREATE POLICY "Users can view active announcements for their groups"
ON public.announcements
FOR SELECT
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (
    is_active = true
    AND now() >= starts_at
    AND now() <= expires_at
    AND (
      store_group_id IS NULL
      OR store_group_id = public.get_user_store_group(auth.uid())
    )
  )
);

-- Fix announcement_dismissals policies if any rely on profiles.role (safety)
-- (No-op if these policies don't exist with these names)
DROP POLICY IF EXISTS "Super admins can manage all announcement dismissals" ON public.announcement_dismissals;
CREATE POLICY "Super admins can manage all announcement dismissals"
ON public.announcement_dismissals
FOR ALL
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));