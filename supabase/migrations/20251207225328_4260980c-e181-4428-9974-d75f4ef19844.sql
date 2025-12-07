-- Make department_id nullable to allow group-level tasks
ALTER TABLE public.todos ALTER COLUMN department_id DROP NOT NULL;

-- Update RLS policies to allow super_admins to manage all todos including group-level ones
DROP POLICY IF EXISTS "Managers can manage their department todos" ON public.todos;
DROP POLICY IF EXISTS "Users can view todos in their group" ON public.todos;

-- Super admins can manage all todos, others can manage their department todos
CREATE POLICY "Users can manage todos" 
ON public.todos 
FOR ALL 
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR (department_id IS NOT NULL AND department_id IN (
    SELECT department_id FROM get_user_departments(auth.uid())
  ))
);

-- Users can view todos in their group or group-level todos
CREATE POLICY "Users can view todos" 
ON public.todos 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR (department_id IS NULL) -- Group-level todos visible to authenticated users
    OR (department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    ))
  )
);