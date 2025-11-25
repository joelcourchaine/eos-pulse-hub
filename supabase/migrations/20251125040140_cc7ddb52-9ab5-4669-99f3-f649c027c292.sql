-- Add unique constraint to kpi_targets to support upsert operations
-- This allows updating targets for specific KPI, quarter, year, and entry type combinations

ALTER TABLE kpi_targets 
ADD CONSTRAINT kpi_targets_unique_key 
UNIQUE (kpi_id, quarter, year, entry_type);