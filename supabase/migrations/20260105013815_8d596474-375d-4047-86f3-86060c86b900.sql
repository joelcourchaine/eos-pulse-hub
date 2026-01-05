-- Allow department managers to update departments they manage
CREATE POLICY "Department managers can update their own departments"
ON public.departments
FOR UPDATE
TO authenticated
USING (manager_id = auth.uid())
WITH CHECK (manager_id = auth.uid());