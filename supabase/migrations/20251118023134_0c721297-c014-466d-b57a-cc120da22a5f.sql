-- Drop the existing policy for managing meeting notes
DROP POLICY IF EXISTS "Managers can manage their department meeting notes" ON public.meeting_notes;

-- Create a more permissive policy that allows users to manage notes for departments in their store
CREATE POLICY "Users can manage meeting notes in their store"
ON public.meeting_notes
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role)
  OR (
    department_id IN (
      SELECT d.id
      FROM public.departments d
      INNER JOIN public.profiles p ON p.store_id = d.store_id
      WHERE p.id = auth.uid()
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role)
  OR (
    department_id IN (
      SELECT d.id
      FROM public.departments d
      INNER JOIN public.profiles p ON p.store_id = d.store_id
      WHERE p.id = auth.uid()
    )
  )
);