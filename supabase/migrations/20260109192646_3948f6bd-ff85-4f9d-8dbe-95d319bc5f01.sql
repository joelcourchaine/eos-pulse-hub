-- Update the RLS policy to include WITH CHECK clause for INSERT/UPDATE operations
DROP POLICY IF EXISTS "Managers can manage their department answers" ON public.department_answers;

CREATE POLICY "Managers can manage their department answers"
ON public.department_answers
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR (department_id IN (SELECT department_id FROM get_user_departments(auth.uid())))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR (department_id IN (SELECT department_id FROM get_user_departments(auth.uid())))
);