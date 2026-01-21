-- Create helper function to check if user is manager or above
-- Returns true for: super_admin, store_gm, department_manager, fixed_ops_manager
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('super_admin', 'store_gm', 'department_manager', 'fixed_ops_manager')
  )
$$;

-- Create a secure view that masks sensitive columns for non-managers
-- Regular employees see: id, full_name, role, store_id, store_group_id, reports_to
-- Managers+ see: email, birthday, start date, last_sign_in_at
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT 
  id,
  full_name,
  role,
  store_id,
  store_group_id,
  reports_to,
  is_system_user,
  created_at,
  updated_at,
  invited_at,
  -- Sensitive fields: only visible to managers+ or the profile owner
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN email 
    ELSE NULL 
  END AS email,
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN birthday_day 
    ELSE NULL 
  END AS birthday_day,
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN birthday_month 
    ELSE NULL 
  END AS birthday_month,
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN start_month 
    ELSE NULL 
  END AS start_month,
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN start_year 
    ELSE NULL 
  END AS start_year,
  CASE 
    WHEN public.is_manager_or_above(auth.uid()) OR id = auth.uid()
    THEN last_sign_in_at 
    ELSE NULL 
  END AS last_sign_in_at
FROM public.profiles;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.profiles_view TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.profiles_view IS 
'Secure view that masks sensitive profile fields (email, birthday, start date, last_sign_in) for non-managers. Regular employees can only see basic fields needed for UI functionality.';