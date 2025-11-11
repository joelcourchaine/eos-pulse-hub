-- Drop existing policy
DROP POLICY IF EXISTS "Managers can edit their department KPIs" ON kpi_definitions;

-- Create updated policy that allows department managers to edit all KPIs
CREATE POLICY "Department managers can edit KPIs"
ON kpi_definitions
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR has_role(auth.uid(), 'department_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR has_role(auth.uid(), 'department_manager'::app_role)
);