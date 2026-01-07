-- Remove all SELECT policies from questionnaire_tokens to prevent client-side token interception
-- Tokens will only be validated server-side via edge functions using service role key

-- Drop existing SELECT policies on questionnaire_tokens
DROP POLICY IF EXISTS "Users can view tokens they sent" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "Super admins can view all tokens" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "Store GMs can view tokens for their stores" ON public.questionnaire_tokens;

-- Keep only INSERT policy for creating tokens (if it exists, recreate it to be sure)
DROP POLICY IF EXISTS "Users can create tokens" ON public.questionnaire_tokens;

CREATE POLICY "Authenticated users can create tokens"
ON public.questionnaire_tokens
FOR INSERT
TO authenticated
WITH CHECK (sent_by = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE public.questionnaire_tokens ENABLE ROW LEVEL SECURITY;