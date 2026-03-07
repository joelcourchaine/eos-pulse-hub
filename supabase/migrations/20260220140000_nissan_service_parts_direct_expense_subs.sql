-- Add total_direct_expenses sub-metrics for Nissan Service & Parts Departments
-- Nissan3 sheet: Service = Column D, Parts = Column H, Names = Column B
-- Rows 21-37 are the line items, row 38 is the total (already mapped as parent)

-- ============================================================
-- 1. Service Department sub-metrics (D21-D37, names B21-B37)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Service Department', 'total_direct_expenses_sub_1',  'Nissan3', 'D21', 'B21', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_2',  'Nissan3', 'D22', 'B22', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_3',  'Nissan3', 'D23', 'B23', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_4',  'Nissan3', 'D24', 'B24', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_5',  'Nissan3', 'D25', 'B25', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_6',  'Nissan3', 'D26', 'B26', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_7',  'Nissan3', 'D27', 'B27', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_8',  'Nissan3', 'D28', 'B28', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_9',  'Nissan3', 'D29', 'B29', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_10', 'Nissan3', 'D30', 'B30', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_11', 'Nissan3', 'D31', 'B31', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_12', 'Nissan3', 'D32', 'B32', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_13', 'Nissan3', 'D33', 'B33', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_14', 'Nissan3', 'D34', 'B34', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_15', 'Nissan3', 'D35', 'B35', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_16', 'Nissan3', 'D36', 'B36', 'total_direct_expenses', true),
('Nissan', 'Service Department', 'total_direct_expenses_sub_17', 'Nissan3', 'D37', 'B37', 'total_direct_expenses', true);

-- ============================================================
-- 2. Parts Department sub-metrics (H21-H37, names B21-B37)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Parts Department', 'total_direct_expenses_sub_1',  'Nissan3', 'H21', 'B21', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_2',  'Nissan3', 'H22', 'B22', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_3',  'Nissan3', 'H23', 'B23', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_4',  'Nissan3', 'H24', 'B24', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_5',  'Nissan3', 'H25', 'B25', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_6',  'Nissan3', 'H26', 'B26', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_7',  'Nissan3', 'H27', 'B27', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_8',  'Nissan3', 'H28', 'B28', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_9',  'Nissan3', 'H29', 'B29', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_10', 'Nissan3', 'H30', 'B30', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_11', 'Nissan3', 'H31', 'B31', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_12', 'Nissan3', 'H32', 'B32', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_13', 'Nissan3', 'H33', 'B33', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_14', 'Nissan3', 'H34', 'B34', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_15', 'Nissan3', 'H35', 'B35', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_16', 'Nissan3', 'H36', 'B36', 'total_direct_expenses', true),
('Nissan', 'Parts Department', 'total_direct_expenses_sub_17', 'Nissan3', 'H37', 'B37', 'total_direct_expenses', true);
