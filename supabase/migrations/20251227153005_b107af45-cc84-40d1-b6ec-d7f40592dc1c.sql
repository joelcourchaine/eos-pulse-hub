-- Add column to track who the questionnaire email was sent to
ALTER TABLE public.questionnaire_tokens 
ADD COLUMN sent_to_email text,
ADD COLUMN sent_by uuid REFERENCES public.profiles(id);

-- Allow authenticated users to view questionnaire tokens for their departments
CREATE POLICY "Users can view questionnaire tokens in their group" 
ON public.questionnaire_tokens 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role)
    OR department_id IN (
      SELECT d.id
      FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);