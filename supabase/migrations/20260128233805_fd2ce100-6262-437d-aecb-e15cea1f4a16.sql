-- Add password_set_at column to track actual password setup completion
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.password_set_at IS 
'Timestamp when user successfully set their password. Used to determine invite vs reset flow.';