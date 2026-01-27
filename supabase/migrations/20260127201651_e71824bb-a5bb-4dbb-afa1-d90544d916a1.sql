-- Fix todos SELECT RLS policy to also allow users to see todos assigned to them
DROP POLICY IF EXISTS "Users can view todos" ON public.todos;

CREATE POLICY "Users can view todos" ON public.todos
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Super admins can see all todos
    has_role(auth.uid(), 'super_admin'::app_role)
    -- Users can always see todos assigned to them
    OR assigned_to = auth.uid()
    -- Users can always see todos they created
    OR created_by = auth.uid()
    -- Group-level todos (no department) are visible to authenticated users
    OR department_id IS NULL
    -- Department todos are visible to users in the same store group
    OR department_id IN (
      SELECT d.id 
      FROM departments d 
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);