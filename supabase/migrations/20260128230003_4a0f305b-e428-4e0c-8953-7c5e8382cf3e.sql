-- Restrict announcements table to authenticated users only
-- SECURITY FIX: The announcements table contains sensitive business communications.
-- This migration restricts access to authenticated users only.

-- Revoke any grants to anon role
REVOKE ALL ON public.announcements FROM anon;
REVOKE ALL ON public.announcement_dismissals FROM anon;

-- Drop and recreate policies with explicit TO authenticated
DROP POLICY IF EXISTS "Users can view active announcements for their groups" ON public.announcements;
CREATE POLICY "Users can view active announcements for their groups"
ON public.announcements
FOR SELECT
TO authenticated
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

DROP POLICY IF EXISTS "Super admins can manage all announcements" ON public.announcements;
CREATE POLICY "Super admins can manage all announcements"
ON public.announcements
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- Dismissals policies
DROP POLICY IF EXISTS "Users can view their own dismissals" ON public.announcement_dismissals;
CREATE POLICY "Users can view their own dismissals"
ON public.announcement_dismissals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can dismiss announcements" ON public.announcement_dismissals;
CREATE POLICY "Users can dismiss announcements"
ON public.announcement_dismissals
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can manage all announcement dismissals" ON public.announcement_dismissals;
CREATE POLICY "Super admins can manage all announcement dismissals"
ON public.announcement_dismissals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));