-- Add missing sales_expense parent mapping for Genesis brand
INSERT INTO financial_cell_mappings (brand, department_name, sheet_name, metric_key, cell_reference, is_sub_metric)
VALUES 
  ('Genesis', 'Parts', 'Page3', 'sales_expense', 'H30', false),
  ('Genesis', 'Service', 'Page3', 'sales_expense', 'N30', false);