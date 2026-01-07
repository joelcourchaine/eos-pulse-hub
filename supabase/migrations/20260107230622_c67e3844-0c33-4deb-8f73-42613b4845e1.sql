-- Fix questionnaire_tokens security: Remove SELECT access, keep INSERT-only
-- Tokens should only be validated via edge functions using service role

DROP POLICY IF EXISTS "sender_can_view_own_tokens" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "super_admin_full_access" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "authenticated_users_can_insert_tokens" ON public.questionnaire_tokens;
DROP POLICY IF EXISTS "Authenticated users can create tokens" ON public.questionnaire_tokens;

-- Recreate INSERT-only policy
CREATE POLICY "Authenticated users can create tokens"
ON public.questionnaire_tokens
FOR INSERT
TO authenticated
WITH CHECK (sent_by = auth.uid());