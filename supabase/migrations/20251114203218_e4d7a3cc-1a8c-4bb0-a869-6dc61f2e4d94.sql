-- ============================================
-- SECURITY FIX: Separate user roles from profiles table
-- ============================================

-- 1. Create user_roles table with proper security
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Migrate existing role data from profiles to user_roles
INSERT INTO public.user_roles (user_id, role, assigned_at)
SELECT id, role, created_at
FROM public.profiles
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Update has_role() function to query user_roles instead of profiles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. Create RLS policies for user_roles
CREATE POLICY "Only super admins can manage roles"
  ON public.user_roles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::app_role
    )
  );

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- 5. Update profiles table policies to prevent role modification
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- ============================================
-- SECURITY FIX: Fix scorecard_entries RLS policy
-- ============================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can manage scorecard entries" ON public.scorecard_entries;

-- Create properly restricted policy
CREATE POLICY "Managers can manage their department scorecard entries"
  ON public.scorecard_entries
  FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role) 
    OR EXISTS (
      SELECT 1 
      FROM kpi_definitions kpi 
      WHERE kpi.id = scorecard_entries.kpi_id 
      AND kpi.department_id = get_user_department(auth.uid())
    )
  )
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role) 
    OR EXISTS (
      SELECT 1 
      FROM kpi_definitions kpi 
      WHERE kpi.id = scorecard_entries.kpi_id 
      AND kpi.department_id = get_user_department(auth.uid())
    )
  );