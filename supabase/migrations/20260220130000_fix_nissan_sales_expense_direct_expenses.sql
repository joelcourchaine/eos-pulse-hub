-- Fix Nissan New/Used Vehicle: Sales Expense and Total Direct Expenses mappings
-- Sales Expense: parent moves from row 13 to row 20, subs move from rows 9-12 to rows 15-19
-- Total Direct Expenses: remove rows 15-19 (now under sales_expense), keep rows 21-37 only

-- ============================================================
-- 1. Update Sales Expense parent cell references
-- ============================================================
UPDATE public.financial_cell_mappings
SET cell_reference = 'H20'
WHERE brand = 'Nissan' AND department_name = 'New Vehicles'
  AND metric_key = 'sales_expense' AND cell_reference = 'H13';

UPDATE public.financial_cell_mappings
SET cell_reference = 'L20'
WHERE brand = 'Nissan' AND department_name = 'Used Vehicles'
  AND metric_key = 'sales_expense' AND cell_reference = 'L13';

-- ============================================================
-- 2. Delete old Sales Expense subs (rows 9-12) and re-insert (rows 15-19)
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND is_sub_metric = true
  AND parent_metric_key = 'sales_expense'
  AND department_name IN ('New Vehicles', 'Used Vehicles');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'sales_expense_sub_1', 'Nissan2', 'H15', 'B15', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_2', 'Nissan2', 'H16', 'B16', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_3', 'Nissan2', 'H17', 'B17', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_4', 'Nissan2', 'H18', 'B18', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_5', 'Nissan2', 'H19', 'B19', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_1', 'Nissan2', 'L15', 'B15', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_2', 'Nissan2', 'L16', 'B16', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_3', 'Nissan2', 'L17', 'B17', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_4', 'Nissan2', 'L18', 'B18', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_5', 'Nissan2', 'L19', 'B19', 'sales_expense', true);

-- ============================================================
-- 3. Delete old Total Direct Expenses subs and re-insert (rows 21-37 only)
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND is_sub_metric = true
  AND parent_metric_key = 'total_direct_expenses'
  AND department_name IN ('New Vehicles', 'Used Vehicles');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_1', 'Nissan2', 'H21', 'B21', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_2', 'Nissan2', 'H22', 'B22', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_3', 'Nissan2', 'H23', 'B23', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_4', 'Nissan2', 'H24', 'B24', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_5', 'Nissan2', 'H25', 'B25', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_6', 'Nissan2', 'H26', 'B26', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_7', 'Nissan2', 'H27', 'B27', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_8', 'Nissan2', 'H28', 'B28', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_9', 'Nissan2', 'H29', 'B29', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_10', 'Nissan2', 'H30', 'B30', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_11', 'Nissan2', 'H31', 'B31', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_12', 'Nissan2', 'H32', 'B32', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_13', 'Nissan2', 'H33', 'B33', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_14', 'Nissan2', 'H34', 'B34', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_15', 'Nissan2', 'H35', 'B35', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_16', 'Nissan2', 'H36', 'B36', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_17', 'Nissan2', 'H37', 'B37', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_1', 'Nissan2', 'L21', 'B21', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_2', 'Nissan2', 'L22', 'B22', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_3', 'Nissan2', 'L23', 'B23', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_4', 'Nissan2', 'L24', 'B24', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_5', 'Nissan2', 'L25', 'B25', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_6', 'Nissan2', 'L26', 'B26', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_7', 'Nissan2', 'L27', 'B27', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_8', 'Nissan2', 'L28', 'B28', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_9', 'Nissan2', 'L29', 'B29', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_10', 'Nissan2', 'L30', 'B30', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_11', 'Nissan2', 'L31', 'B31', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_12', 'Nissan2', 'L32', 'B32', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_13', 'Nissan2', 'L33', 'B33', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_14', 'Nissan2', 'L34', 'B34', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_15', 'Nissan2', 'L35', 'B35', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_16', 'Nissan2', 'L36', 'B36', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_17', 'Nissan2', 'L37', 'B37', 'total_direct_expenses', true);
