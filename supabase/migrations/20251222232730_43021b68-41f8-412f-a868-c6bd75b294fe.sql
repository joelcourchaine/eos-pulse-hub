-- Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Users can view answers" ON public.department_answers;

-- Create a more restrictive policy that limits access to store group
CREATE POLICY "Users can view answers in their store group"
ON public.department_answers
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR has_role(auth.uid(), 'store_gm'::app_role)
  OR department_id IN (
    SELECT d.id
    FROM departments d
    JOIN stores s ON d.store_id = s.id
    WHERE s.group_id = get_user_store_group(auth.uid())
  )
);