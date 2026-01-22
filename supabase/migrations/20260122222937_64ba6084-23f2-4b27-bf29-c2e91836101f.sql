-- Create a security definer function to check if a user is a store_gm for a given store
CREATE OR REPLACE FUNCTION public.is_store_gm_for_user(_caller_id uuid, _target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN profiles caller_profile ON caller_profile.id = _caller_id
    JOIN profiles target_profile ON target_profile.id = _target_user_id
    WHERE ur.user_id = _caller_id
      AND ur.role = 'store_gm'
      AND (
        -- Same store
        caller_profile.store_id = target_profile.store_id
        -- Or same store group
        OR caller_profile.store_group_id = target_profile.store_group_id
      )
  )
$$;

-- Add policy allowing Store GMs to manage roles for users in their store/group
CREATE POLICY "Store GMs can manage roles for their users"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.is_store_gm_for_user(auth.uid(), user_id)
)
WITH CHECK (
  public.is_store_gm_for_user(auth.uid(), user_id)
  -- Prevent Store GMs from assigning super_admin role
  AND role != 'super_admin'
);