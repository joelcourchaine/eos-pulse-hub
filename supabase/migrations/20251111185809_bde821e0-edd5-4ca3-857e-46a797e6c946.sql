-- Fix RLS policy for scorecard_entries to allow authenticated users to manage entries
-- The current policy is too restrictive

-- Drop the existing policy
DROP POLICY IF EXISTS "Managers can edit their scorecard entries" ON scorecard_entries;

-- Create a more permissive policy that allows authenticated users to manage entries
-- for KPIs in departments they have access to
CREATE POLICY "Authenticated users can manage scorecard entries"
  ON scorecard_entries FOR ALL
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR 
      has_role(auth.uid(), 'store_gm'::app_role) OR
      has_role(auth.uid(), 'department_manager'::app_role) OR
      EXISTS (
        SELECT 1
        FROM kpi_definitions kpi
        WHERE kpi.id = scorecard_entries.kpi_id
      )
    )
  );

-- Add comment
COMMENT ON POLICY "Authenticated users can manage scorecard entries" ON scorecard_entries IS 
  'Allow authenticated users to manage scorecard entries for accessible KPIs';
