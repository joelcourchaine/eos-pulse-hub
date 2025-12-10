-- Add columns to track which cell an issue was created from
ALTER TABLE public.issues 
ADD COLUMN source_type text,
ADD COLUMN source_kpi_id uuid,
ADD COLUMN source_metric_name text,
ADD COLUMN source_period text;

-- Add index for efficient lookups
CREATE INDEX idx_issues_source_kpi ON public.issues(source_kpi_id) WHERE source_kpi_id IS NOT NULL;
CREATE INDEX idx_issues_source_metric ON public.issues(source_metric_name, source_period) WHERE source_metric_name IS NOT NULL;