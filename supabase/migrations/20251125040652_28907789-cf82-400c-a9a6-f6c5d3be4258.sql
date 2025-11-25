-- Drop existing constraint if it exists
ALTER TABLE kpi_targets DROP CONSTRAINT IF EXISTS kpi_targets_unique_key;

-- Create unique constraint for upsert operations
ALTER TABLE kpi_targets 
ADD CONSTRAINT kpi_targets_unique_key 
UNIQUE (kpi_id, quarter, year, entry_type);