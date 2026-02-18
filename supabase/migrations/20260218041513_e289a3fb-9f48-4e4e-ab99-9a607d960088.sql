
-- Drop both existing UPDATE policies
DROP POLICY IF EXISTS "Managers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile UPDATE - self and authorized admins" ON public.profiles;

-- Recreate as a single unified UPDATE policy
CREATE POLICY "Profile UPDATE - self and authorized admins"
ON public.profiles FOR UPDATE
USING (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'store_gm')
      AND store_group_id = get_current_user_store_group())
  OR (
    (has_role(auth.uid(), 'department_manager')
     OR has_role(auth.uid(), 'fixed_ops_manager'))
    AND store_id IN (SELECT get_user_store_ids_via_departments(auth.uid()))
  )
)
WITH CHECK (
  id = auth.uid()
  OR has_role(auth.uid(), 'super_admin')
  OR (has_role(auth.uid(), 'store_gm')
      AND store_group_id = get_current_user_store_group())
  OR (
    (has_role(auth.uid(), 'department_manager')
     OR has_role(auth.uid(), 'fixed_ops_manager'))
    AND store_id IN (SELECT get_user_store_ids_via_departments(auth.uid()))
  )
);
