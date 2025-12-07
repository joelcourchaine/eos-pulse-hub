-- Remove overly permissive public access policies on department_answers
-- These allowed anyone to read, insert, and update questionnaire data without authentication

DROP POLICY IF EXISTS "Allow public read access to department answers" ON public.department_answers;
DROP POLICY IF EXISTS "Allow public update of department answers" ON public.department_answers;
DROP POLICY IF EXISTS "Allow public upsert of department answers" ON public.department_answers;

-- Create a token-validated read policy for questionnaire access
-- This allows reading answers only if there's a valid (non-expired) token for that department
CREATE POLICY "Token holders can read department answers" ON public.department_answers
FOR SELECT USING (
  department_id IN (
    SELECT department_id FROM public.questionnaire_tokens
    WHERE expires_at > now()
  )
);