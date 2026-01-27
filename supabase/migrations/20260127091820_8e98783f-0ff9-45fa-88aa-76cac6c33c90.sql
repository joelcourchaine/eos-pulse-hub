-- Verify and document profiles_view security configuration
-- 
-- SECURITY MODEL:
-- - profiles_view has security_invoker = true (set in migration 20260122143436)
-- - This means the view respects the RLS policies on the underlying 'profiles' table
-- - The 'profiles' table has RLS enabled with "Users can view accessible profiles" policy
--
-- This migration ensures the security configuration is explicitly set (idempotent)

-- Ensure security_invoker is enabled on profiles_view
-- This causes the view to respect RLS policies on the underlying profiles table
ALTER VIEW public.profiles_view SET (security_invoker = true);

-- Verify RLS is enabled on the base profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add explicit comment documenting the security model
COMMENT ON VIEW public.profiles_view IS 
'Secure view that masks sensitive profile fields (email, birthday, start date, last_sign_in) for non-managers. 
Security is enforced via:
1. security_invoker = true: queries run as the calling user, not view owner
2. RLS on profiles table: restricts which rows users can see based on their access level
3. Column masking: sensitive columns are NULL for non-managers viewing others profiles';