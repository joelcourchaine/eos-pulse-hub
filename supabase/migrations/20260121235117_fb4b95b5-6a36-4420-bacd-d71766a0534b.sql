-- Create auth_tokens table for long-lived custom tokens
CREATE TABLE public.auth_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL CHECK (token_type IN ('invite', 'password_reset')),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast token lookups
CREATE INDEX idx_auth_tokens_token ON public.auth_tokens(token);
CREATE INDEX idx_auth_tokens_user_id ON public.auth_tokens(user_id);

-- Enable RLS with no policies = only service role can access
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

-- Function to generate secure random token (256-bit hex)
CREATE OR REPLACE FUNCTION public.generate_auth_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Function to create an auth token with auto-invalidation of previous tokens
CREATE OR REPLACE FUNCTION public.create_auth_token(
  _token_type TEXT,
  _user_id UUID,
  _email TEXT,
  _created_by UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
BEGIN
  -- Invalidate any existing unused tokens of the same type for this user
  UPDATE public.auth_tokens
  SET used_at = now()
  WHERE user_id = _user_id
    AND token_type = _token_type
    AND used_at IS NULL;
  
  -- Generate new token
  new_token := public.generate_auth_token();
  
  -- Insert new token with 7-day expiry
  INSERT INTO public.auth_tokens (token, token_type, user_id, email, expires_at, created_by)
  VALUES (new_token, _token_type, _user_id, _email, now() + interval '7 days', _created_by);
  
  RETURN new_token;
END;
$$;