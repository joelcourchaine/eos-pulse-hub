-- Remove overly permissive public read policy on departments
DROP POLICY IF EXISTS "Allow public read access to departments for questionnaires" ON public.departments;

-- Remove the weak INSERT policy on questionnaire_tokens that allows any authenticated user
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.questionnaire_tokens;

-- Remove public read policy on department_questions (questions should only be served via edge function)
DROP POLICY IF EXISTS "Allow public read access to active questions" ON public.department_questions;

-- Remove token-based read policy on department_answers (answers should only be served via edge function)
DROP POLICY IF EXISTS "Token holders can read department answers" ON public.department_answers;