-- Add quarter and year to financial_targets
ALTER TABLE financial_targets
ADD COLUMN quarter INTEGER NOT NULL DEFAULT 1,
ADD COLUMN year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

-- Drop the old unique constraint and create a new one with quarter and year
ALTER TABLE financial_targets
DROP CONSTRAINT IF EXISTS financial_targets_department_id_metric_name_key;

ALTER TABLE financial_targets
ADD CONSTRAINT financial_targets_department_id_metric_name_quarter_year_key 
UNIQUE (department_id, metric_name, quarter, year);

-- Create kpi_targets table for quarterly KPI targets
CREATE TABLE IF NOT EXISTS kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES kpi_definitions(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  target_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(kpi_id, quarter, year)
);

-- Enable RLS on kpi_targets
ALTER TABLE kpi_targets ENABLE ROW LEVEL SECURITY;

-- Allow users to view KPI targets
CREATE POLICY "Users can view KPI targets"
ON kpi_targets FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Allow managers to manage KPI targets
CREATE POLICY "Managers can manage KPI targets"
ON kpi_targets FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'store_gm') OR 
  has_role(auth.uid(), 'department_manager')
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'store_gm') OR 
  has_role(auth.uid(), 'department_manager')
);

-- Add trigger for updated_at
CREATE TRIGGER update_kpi_targets_updated_at
BEFORE UPDATE ON kpi_targets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();