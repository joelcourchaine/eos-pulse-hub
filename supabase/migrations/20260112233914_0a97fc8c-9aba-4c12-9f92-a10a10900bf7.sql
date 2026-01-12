-- Drop the overly permissive fixed ops manager policy
DROP POLICY IF EXISTS "fixed_ops_manager_view_financial_entries" ON public.financial_entries;

-- Create a more restrictive policy that limits fixed ops managers to only:
-- 1. Departments they're explicitly assigned to via user_department_access
-- 2. Departments where they are the manager
CREATE POLICY "fixed_ops_manager_view_financial_entries"
ON public.financial_entries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'fixed_ops_manager'::app_role)
  AND (
    -- Departments they're explicitly assigned to via user_department_access
    department_id IN (
      SELECT department_id FROM public.user_department_access 
      WHERE user_id = auth.uid()
    )
    OR
    -- Departments where they are the manager
    department_id IN (
      SELECT id FROM public.departments 
      WHERE manager_id = auth.uid()
    )
  )
);