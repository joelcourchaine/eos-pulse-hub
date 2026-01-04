-- Remove overly permissive service role policies (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "Allow service role to insert questionnaire tokens" ON questionnaire_tokens;
DROP POLICY IF EXISTS "Allow service role to update questionnaire tokens" ON questionnaire_tokens;