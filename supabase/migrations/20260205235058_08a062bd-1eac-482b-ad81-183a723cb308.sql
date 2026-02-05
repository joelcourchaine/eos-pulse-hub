-- Security hardening: Tighten profiles table RLS policies
-- 
-- PROBLEM: Current "Users can view profiles in same store group" policy allows
-- any authenticated user to see ALL profiles in their store group, including
-- sensitive data like email, birthday, start_date via direct table access.
--
-- SOLUTION: 
-- 1. Restrict direct profiles table access to more limited scope
-- 2. App should use profiles_view (which masks sensitive fields) for non-managers
-- 3. Only managers+ and profile owners get full access to profiles table

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles in same store group" ON public.profiles;

-- Create a more restrictive policy:
-- Users can only see:
-- 1. Their own profile
-- 2. Their direct reports (reports_to = current_user)
-- 3. Profiles in their same store (same store_id) - needed for store-level features
CREATE POLICY "Users can view profiles in authorized scope"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    -- Own profile
    id = auth.uid()
    OR
    -- Direct reports
    reports_to = auth.uid()
    OR
    -- Same store (needed for store-level dropdowns, assignments, etc.)
    (
      store_id IS NOT NULL AND
      store_id = (SELECT p.store_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

-- Note: "Super admins can view all profiles" policy remains
-- Note: "Profile SELECT - self and authorized admins" policy for managers remains
-- These are appropriately scoped for elevated roles

-- Add comment documenting the security model
COMMENT ON TABLE public.profiles IS 
'Employee profiles with sensitive HR data. Direct table access is restricted by RLS:
- Regular users: own profile, direct reports, same store only
- Managers+: broader access via separate policy
- App should use profiles_view for general profile display (masks sensitive fields)
- Sensitive columns: email, birthday_day, birthday_month, start_month, start_year, last_sign_in_at';