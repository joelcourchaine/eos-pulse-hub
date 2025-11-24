-- Add entry_type column to kpi_targets to distinguish between weekly and monthly targets
ALTER TABLE kpi_targets ADD COLUMN entry_type text DEFAULT 'weekly';

-- Drop the existing unique constraint
ALTER TABLE kpi_targets DROP CONSTRAINT IF EXISTS kpi_targets_kpi_id_quarter_year_key;

-- Add new unique constraint that includes entry_type
ALTER TABLE kpi_targets ADD CONSTRAINT kpi_targets_kpi_id_quarter_year_entry_type_key 
  UNIQUE (kpi_id, quarter, year, entry_type);