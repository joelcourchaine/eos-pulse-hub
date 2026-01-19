-- Create a helper function for controller role check
CREATE OR REPLACE FUNCTION public.is_controller(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'controller'::app_role
  )
$$;