-- Create financial_cell_mappings table for Excel cell-to-metric mappings
CREATE TABLE public.financial_cell_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  department_name TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  cell_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(brand, department_name, metric_key)
);

-- Enable RLS
ALTER TABLE public.financial_cell_mappings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read mappings
CREATE POLICY "Authenticated users can view cell mappings"
ON public.financial_cell_mappings
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only super admins can manage mappings
CREATE POLICY "Super admins can manage cell mappings"
ON public.financial_cell_mappings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Seed Nissan Service Department mappings
INSERT INTO public.financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference) VALUES
('Nissan', 'Service Department', 'total_sales', 'Nissan3', 'D6'),
('Nissan', 'Service Department', 'gp_net', 'Nissan3', 'D7'),
('Nissan', 'Service Department', 'sales_expense', 'Nissan3', 'D20'),
('Nissan', 'Service Department', 'total_direct_expenses', 'Nissan3', 'D38'),
('Nissan', 'Service Department', 'total_fixed_expense', 'Nissan3', 'D61');

-- Seed Nissan Parts Department mappings
INSERT INTO public.financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference) VALUES
('Nissan', 'Parts Department', 'total_sales', 'Nissan3', 'H6'),
('Nissan', 'Parts Department', 'gp_net', 'Nissan3', 'H7'),
('Nissan', 'Parts Department', 'sales_expense', 'Nissan3', 'H20'),
('Nissan', 'Parts Department', 'total_direct_expenses', 'Nissan3', 'H38'),
('Nissan', 'Parts Department', 'total_fixed_expense', 'Nissan3', 'H61');