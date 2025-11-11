-- Create financial_targets table for department financial targets
CREATE TABLE financial_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  metric_name text NOT NULL,
  target_value numeric NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(department_id, metric_name)
);

-- Enable RLS
ALTER TABLE financial_targets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view financial targets"
  ON financial_targets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage their department financial targets"
  ON financial_targets FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'store_gm'::app_role) OR 
    (department_id = get_user_department(auth.uid()))
  );

-- Add trigger for updated_at
CREATE TRIGGER update_financial_targets_updated_at
  BEFORE UPDATE ON financial_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE financial_targets IS 'Target values for financial metrics per department';
