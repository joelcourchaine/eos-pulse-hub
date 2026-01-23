-- Add row_offset column to scorecard_column_templates
ALTER TABLE scorecard_column_templates 
ADD COLUMN row_offset integer NOT NULL DEFAULT 0;

-- Drop the old pay_type_filter column
ALTER TABLE scorecard_column_templates 
DROP COLUMN IF EXISTS pay_type_filter;

-- Drop old unique constraint if exists and create new one with row_offset
DROP INDEX IF EXISTS scorecard_column_templates_unique_profile_col_kpi;
CREATE UNIQUE INDEX scorecard_column_templates_unique_profile_offset_col_kpi 
ON scorecard_column_templates (import_profile_id, row_offset, col_index, kpi_name);