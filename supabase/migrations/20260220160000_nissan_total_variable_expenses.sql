-- Add Total Variable Expenses metric for Nissan New/Used Vehicles
-- Nissan2 sheet: New = Col H, Used = Col L
-- Parent totals: H13 (New), L13 (Used)
-- Sub-metrics: rows 9-12, names from Col B

-- ============================================================
-- Parent metrics
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_variable_expenses', 'Nissan2', 'H13', false),
('Nissan', 'Used Vehicles', 'total_variable_expenses', 'Nissan2', 'L13', false);

-- ============================================================
-- New Vehicle sub-metrics (H9-H12, names B9-B12)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_variable_expenses_sub_1', 'Nissan2', 'H9',  'B9',  'total_variable_expenses', true),
('Nissan', 'New Vehicles', 'total_variable_expenses_sub_2', 'Nissan2', 'H10', 'B10', 'total_variable_expenses', true),
('Nissan', 'New Vehicles', 'total_variable_expenses_sub_3', 'Nissan2', 'H11', 'B11', 'total_variable_expenses', true),
('Nissan', 'New Vehicles', 'total_variable_expenses_sub_4', 'Nissan2', 'H12', 'B12', 'total_variable_expenses', true);

-- ============================================================
-- Used Vehicle sub-metrics (L9-L12, names B9-B12)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'total_variable_expenses_sub_1', 'Nissan2', 'L9',  'B9',  'total_variable_expenses', true),
('Nissan', 'Used Vehicles', 'total_variable_expenses_sub_2', 'Nissan2', 'L10', 'B10', 'total_variable_expenses', true),
('Nissan', 'Used Vehicles', 'total_variable_expenses_sub_3', 'Nissan2', 'L11', 'B11', 'total_variable_expenses', true),
('Nissan', 'Used Vehicles', 'total_variable_expenses_sub_4', 'Nissan2', 'L12', 'B12', 'total_variable_expenses', true);
