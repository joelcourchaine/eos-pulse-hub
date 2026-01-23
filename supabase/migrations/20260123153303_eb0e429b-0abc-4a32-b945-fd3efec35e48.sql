-- Drop old unique constraint that only allows one KPI per column per user
ALTER TABLE scorecard_cell_mappings DROP CONSTRAINT IF EXISTS scorecard_cell_mappings_relative_unique;

-- Create new unique constraint that allows multiple KPIs per column (distinguished by kpi_id)
CREATE UNIQUE INDEX scorecard_cell_mappings_user_col_kpi_unique 
ON scorecard_cell_mappings (import_profile_id, user_id, col_index, kpi_id);