-- Remove overly permissive public read policies on questionnaire_tokens
DROP POLICY IF EXISTS "Allow public read access to questionnaire tokens" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "Anyone can read valid tokens" ON public.questionnaire_tokens;

-- Create a more restrictive policy: only allow token lookup by the exact token value
-- This is used by the questionnaire-submit edge function which validates server-side
-- No SELECT policy needed since the edge function uses service role key

-- Keep the authenticated user insert policy for creating tokens
-- The existing "Authenticated users can create tokens" policy is fine

-- Keep the update policy for marking tokens as used (edge function uses service role)
-- The existing "Allow service role to update questionnaire tokens" policy is fine