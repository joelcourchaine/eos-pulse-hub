-- Update the profiles SELECT policy to allow department managers to see users in their stores
DROP POLICY IF EXISTS "Profile SELECT - self and authorized admins" ON public.profiles;

CREATE POLICY "Profile SELECT - self and authorized admins" 
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (id = auth.uid()) 
  OR has_role(auth.uid(), 'super_admin'::app_role) 
  OR (has_role(auth.uid(), 'store_gm'::app_role) AND (store_group_id = get_current_user_store_group()))
  OR (
    -- Department managers can see profiles of users in stores they have department access to
    has_role(auth.uid(), 'department_manager'::app_role) 
    AND (
      -- User is in a store that belongs to the department manager's accessible stores
      store_id IN (
        SELECT DISTINCT d.store_id 
        FROM departments d
        INNER JOIN user_department_access uda ON d.id = uda.department_id
        WHERE uda.user_id = auth.uid()
      )
      OR 
      -- User has store access to a store that the department manager also has access to
      id IN (
        SELECT usa.user_id
        FROM user_store_access usa
        WHERE usa.store_id IN (
          SELECT DISTINCT d.store_id 
          FROM departments d
          INNER JOIN user_department_access uda ON d.id = uda.department_id
          WHERE uda.user_id = auth.uid()
        )
      )
    )
  )
  OR (
    -- Fixed ops managers can see profiles of users in stores they have department access to
    has_role(auth.uid(), 'fixed_ops_manager'::app_role) 
    AND (
      store_id IN (
        SELECT DISTINCT d.store_id 
        FROM departments d
        INNER JOIN user_department_access uda ON d.id = uda.department_id
        WHERE uda.user_id = auth.uid()
      )
      OR 
      id IN (
        SELECT usa.user_id
        FROM user_store_access usa
        WHERE usa.store_id IN (
          SELECT DISTINCT d.store_id 
          FROM departments d
          INNER JOIN user_department_access uda ON d.id = uda.department_id
          WHERE uda.user_id = auth.uid()
        )
      )
    )
  )
);