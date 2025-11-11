-- Create financial_entries table for department financial data
CREATE TABLE financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE NOT NULL,
  month text NOT NULL,
  metric_name text NOT NULL,
  value numeric,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(department_id, month, metric_name)
);

-- Enable RLS
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view financial entries"
  ON financial_entries FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage their department financial entries"
  ON financial_entries FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    has_role(auth.uid(), 'store_gm'::app_role) OR 
    (department_id = get_user_department(auth.uid()))
  );

-- Add trigger for updated_at
CREATE TRIGGER update_financial_entries_updated_at
  BEFORE UPDATE ON financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_financial_entries_dept_month ON financial_entries(department_id, month);

-- Add comments
COMMENT ON TABLE financial_entries IS 'Monthly financial data for departments';
COMMENT ON COLUMN financial_entries.month IS 'Month identifier in YYYY-MM format';
COMMENT ON COLUMN financial_entries.metric_name IS 'Financial metric name (e.g., total_sales, gp_net, gp_percent)';
