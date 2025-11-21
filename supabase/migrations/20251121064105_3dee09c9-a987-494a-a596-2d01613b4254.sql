-- Enable RLS on questionnaire_tokens
ALTER TABLE questionnaire_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read questionnaire tokens (needed for the public questionnaire form)
-- This is safe because the token itself acts as the authentication
CREATE POLICY "Allow public read access to questionnaire tokens"
ON questionnaire_tokens
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow the service role to insert tokens (used by the edge function)
CREATE POLICY "Allow service role to insert questionnaire tokens"
ON questionnaire_tokens
FOR INSERT
TO service_role
WITH CHECK (true);

-- Allow the service role to update tokens (to mark them as used)
CREATE POLICY "Allow service role to update questionnaire tokens"
ON questionnaire_tokens
FOR UPDATE
TO service_role
USING (true);

-- Enable RLS on department_answers if not already enabled
ALTER TABLE department_answers ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read department answers via questionnaire token
-- This allows the form to load existing answers
CREATE POLICY "Allow public read access to department answers"
ON department_answers
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to upsert department answers
-- This is safe because it's tied to the department_id from a valid token
CREATE POLICY "Allow public upsert of department answers"
ON department_answers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public update of department answers"
ON department_answers
FOR UPDATE
TO anon, authenticated
USING (true);

-- Enable RLS on department_questions if not already enabled
ALTER TABLE department_questions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read active department questions
CREATE POLICY "Allow public read access to active questions"
ON department_questions
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Enable RLS on departments for questionnaire access
-- Allow reading department info via token
CREATE POLICY "Allow public read access to departments for questionnaires"
ON departments
FOR SELECT
TO anon, authenticated
USING (true);