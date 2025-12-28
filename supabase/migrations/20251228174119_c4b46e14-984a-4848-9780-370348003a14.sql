-- Add new columns to financial_cell_mappings for sub-metric support
ALTER TABLE public.financial_cell_mappings
ADD COLUMN IF NOT EXISTS name_cell_reference text,
ADD COLUMN IF NOT EXISTS parent_metric_key text,
ADD COLUMN IF NOT EXISTS is_sub_metric boolean DEFAULT false;

-- Insert sub-metric mappings for Nissan Service Total Sales
-- These map to Nissan5 sheet where column G has names and column C has values
INSERT INTO public.financial_cell_mappings 
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Service Department', 'total_sales_sub_1', 'Nissan5', 'C34', 'G34', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_2', 'Nissan5', 'C35', 'G35', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_3', 'Nissan5', 'C36', 'G36', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_4', 'Nissan5', 'C37', 'G37', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_5', 'Nissan5', 'C39', 'G39', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_6', 'Nissan5', 'C40', 'G40', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_7', 'Nissan5', 'C41', 'G41', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_8', 'Nissan5', 'C42', 'G42', 'total_sales', true),
('Nissan', 'Service Department', 'total_sales_sub_9', 'Nissan5', 'C43', 'G43', 'total_sales', true);