-- Drop and recreate INSERT policy with simplified logic
DROP POLICY IF EXISTS "Users can insert rock targets for accessible departments" ON public.rock_monthly_targets;

-- Create a simpler INSERT policy that checks if user can insert based on rock ownership
CREATE POLICY "Users can insert rock targets for accessible departments"
  ON public.rock_monthly_targets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM rocks r
      WHERE r.id = rock_id
      AND r.department_id IN (
        -- Department manager
        SELECT d.id FROM departments d WHERE d.manager_id = auth.uid()
        UNION
        -- User has department access
        SELECT department_id FROM user_department_access WHERE user_id = auth.uid()
        UNION
        -- User has store access to department's store
        SELECT d.id FROM departments d 
        JOIN user_store_access usa ON d.store_id = usa.store_id 
        WHERE usa.user_id = auth.uid()
      )
    )
  );