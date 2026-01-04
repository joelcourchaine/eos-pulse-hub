-- Drop existing vulnerable policy
DROP POLICY IF EXISTS "Users can view questionnaire tokens in their group" ON questionnaire_tokens;

-- Super admins get full access
CREATE POLICY "super_admin_full_access"
ON questionnaire_tokens
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

-- Users can view only tokens THEY sent
CREATE POLICY "sender_can_view_own_tokens"
ON questionnaire_tokens
FOR SELECT
USING (sent_by = auth.uid());

-- Users can insert tokens (needed when sending questionnaires)
CREATE POLICY "authenticated_users_can_insert_tokens"
ON questionnaire_tokens
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND sent_by = auth.uid());