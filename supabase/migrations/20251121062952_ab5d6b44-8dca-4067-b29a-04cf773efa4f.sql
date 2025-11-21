-- Create questionnaire tokens table for secure access
CREATE TABLE public.questionnaire_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.questionnaire_tokens ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read tokens (needed for public form access)
CREATE POLICY "Anyone can read valid tokens"
ON public.questionnaire_tokens
FOR SELECT
USING (expires_at > now());

-- Only authenticated users can create tokens
CREATE POLICY "Authenticated users can create tokens"
ON public.questionnaire_tokens
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for faster token lookups
CREATE INDEX idx_questionnaire_tokens_token ON public.questionnaire_tokens(token);
CREATE INDEX idx_questionnaire_tokens_expires ON public.questionnaire_tokens(expires_at);