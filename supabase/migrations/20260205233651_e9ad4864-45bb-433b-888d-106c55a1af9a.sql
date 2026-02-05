-- Security fix: Block all client-side access to auth_tokens table
-- This table contains sensitive authentication data and should only be accessed
-- by Edge Functions using the service_role key (which bypasses RLS)

-- Drop the existing super_admin policy that allows direct access
DROP POLICY IF EXISTS "Auth tokens - super admin only" ON public.auth_tokens;

-- Create a deny-all policy for the authenticated role
-- Edge Functions use service_role which bypasses RLS, so they're unaffected
CREATE POLICY "Auth tokens - no direct access"
ON public.auth_tokens
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Also block anon access (should already be blocked but being explicit)
CREATE POLICY "Auth tokens - no anon access"
ON public.auth_tokens
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Add a comment explaining the security model
COMMENT ON TABLE public.auth_tokens IS 'Sensitive authentication tokens. Access blocked for all client roles. Only accessible via Edge Functions using service_role key.';