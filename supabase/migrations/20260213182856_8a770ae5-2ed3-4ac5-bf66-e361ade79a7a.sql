-- Add source_column_header to scorecard_cell_mappings
-- This stores the Excel column header name at the time of mapping,
-- enabling header-based re-mapping when column indices shift
ALTER TABLE public.scorecard_cell_mappings
ADD COLUMN source_column_header text;

-- Also add to column templates for completeness
ALTER TABLE public.scorecard_column_templates
ADD COLUMN source_column_header text;