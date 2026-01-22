-- Fix SECURITY DEFINER view issue by using invoker privileges
ALTER VIEW public.profiles_view SET (security_invoker = true);

-- Fix "RLS enabled, no policy" on auth_tokens by restricting access to super admins only
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'auth_tokens'
      AND policyname = 'Auth tokens - super admin only'
  ) THEN
    CREATE POLICY "Auth tokens - super admin only"
    ON public.auth_tokens
    FOR ALL
    TO authenticated
    USING (has_role(auth.uid(), 'super_admin'::public.app_role))
    WITH CHECK (has_role(auth.uid(), 'super_admin'::public.app_role));
  END IF;
END $$;
