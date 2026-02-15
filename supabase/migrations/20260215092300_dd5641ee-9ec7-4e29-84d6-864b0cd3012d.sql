-- Drop the overly permissive policy that exposes all profiles in a store group
DROP POLICY IF EXISTS "Users can view accessible profiles" ON public.profiles;

-- Drop the current restrictive policy so we can recreate it with multi-store support
DROP POLICY IF EXISTS "Users can view profiles in authorized scope" ON public.profiles;

-- Recreate with proper scope: own profile, direct reports, same store,
-- AND multi-store access (for users with explicit store access grants)
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
    -- Same store (uses existing helper function)
    (
      store_id IS NOT NULL AND
      store_id = get_current_user_store_id()
    )
    OR
    -- Users with explicit multi-store access can see profiles in those stores
    (
      store_id IN (
        SELECT usa.store_id FROM public.user_store_access usa WHERE usa.user_id = auth.uid()
      )
    )
  )
);