-- Create a junction table to track user access to multiple departments
CREATE TABLE public.user_department_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  granted_at timestamptz DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, department_id)
);

-- Enable RLS
ALTER TABLE public.user_department_access ENABLE ROW LEVEL SECURITY;

-- RLS policies for the junction table
CREATE POLICY "Users can view their own department access"
  ON public.user_department_access
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins and store GMs can manage department access"
  ON public.user_department_access
  FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin') OR 
    has_role(auth.uid(), 'store_gm')
  );

-- Create function to get all departments a user has access to
CREATE OR REPLACE FUNCTION public.get_user_departments(_user_id uuid)
RETURNS TABLE(department_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Return departments where user is the manager
  SELECT id FROM public.departments WHERE manager_id = _user_id
  
  UNION
  
  -- Return departments explicitly granted access
  SELECT department_id FROM public.user_department_access WHERE user_id = _user_id
$$;

-- Populate the junction table with existing manager assignments
INSERT INTO public.user_department_access (user_id, department_id)
SELECT manager_id, id 
FROM public.departments 
WHERE manager_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;