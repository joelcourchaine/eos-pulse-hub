-- Add is_system_user column to profiles table
-- System users have full access but are hidden from user management lists
ALTER TABLE public.profiles 
ADD COLUMN is_system_user boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_system_user IS 'System users (e.g., IT support) are hidden from store user lists but have full access';