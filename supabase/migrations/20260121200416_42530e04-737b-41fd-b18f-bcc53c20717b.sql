-- Make scorecard_cell_mappings position-independent (advisor-relative)
-- Mappings will be stored per-user by column index only, not absolute row

-- First, drop the existing unique constraint that includes row_index
ALTER TABLE scorecard_cell_mappings 
  DROP CONSTRAINT IF EXISTS scorecard_cell_mappings_import_profile_id_row_index_col_ind_key;

-- Add a flag to distinguish relative vs legacy absolute mappings
ALTER TABLE scorecard_cell_mappings 
  ADD COLUMN IF NOT EXISTS is_relative boolean NOT NULL DEFAULT true;

-- Make row_index nullable for relative mappings (not needed when is_relative = true)
ALTER TABLE scorecard_cell_mappings 
  ALTER COLUMN row_index DROP NOT NULL;

-- Add new unique constraint for relative mappings: (import_profile_id, user_id, col_index)
-- This ensures one KPI mapping per column per user per profile
ALTER TABLE scorecard_cell_mappings 
  ADD CONSTRAINT scorecard_cell_mappings_relative_unique 
  UNIQUE (import_profile_id, user_id, col_index);

-- Add comment explaining the schema
COMMENT ON TABLE scorecard_cell_mappings IS 'Maps Excel columns to KPIs per user. When is_relative=true, row_index is ignored and the system dynamically detects advisor rows during import.';