-- Update RLS policies to support multi-department access
-- Drop old policies that use get_user_department()
DROP POLICY IF EXISTS "Managers can manage their department answers" ON department_answers;
DROP POLICY IF EXISTS "Managers can manage their department financial entries" ON financial_entries;
DROP POLICY IF EXISTS "Managers can manage their department issues" ON issues;
DROP POLICY IF EXISTS "Managers can manage their department rocks" ON rocks;
DROP POLICY IF EXISTS "Managers can manage their department todos" ON todos;
DROP POLICY IF EXISTS "Managers can manage their department scorecard entries" ON scorecard_entries;

-- Create new policies using get_user_departments() for multi-department support
CREATE POLICY "Managers can manage their department answers"
ON department_answers
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

CREATE POLICY "Managers can manage their department financial entries"
ON financial_entries
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

CREATE POLICY "Managers can manage their department issues"
ON issues
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

CREATE POLICY "Managers can manage their department rocks"
ON rocks
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

CREATE POLICY "Managers can manage their department todos"
ON todos
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

CREATE POLICY "Managers can manage their department scorecard entries"
ON scorecard_entries
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR EXISTS (
    SELECT 1 
    FROM kpi_definitions kpi 
    WHERE kpi.id = scorecard_entries.kpi_id 
    AND kpi.department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR EXISTS (
    SELECT 1 
    FROM kpi_definitions kpi 
    WHERE kpi.id = scorecard_entries.kpi_id 
    AND kpi.department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
  )
);