-- Add assigned_to column to kpi_definitions for ownership
ALTER TABLE kpi_definitions 
ADD COLUMN assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Add comment for clarity
COMMENT ON COLUMN kpi_definitions.assigned_to IS 'The user/team member responsible for this KPI';
