-- Hyundai New & Used Vehicles Financial Cell Mappings
-- ============================================================
-- Page4: Vehicle sales/GP sub-metrics by model (New) and category (Used)
--   New Vehicles: rows 7-43, parent totals at row 44
--     Units col A, Sales col B, GP col E, Names col J
--     SKIP subtotal rows: 16 (cars), 28 (trucks), 38 (EV), 40 (total retail)
--     SKIP empty placeholders: 11-15 (cars), 26-27 (trucks), 36-37 (EV)
--     SKIP TBD rows: 25, 35
--   Used Vehicles: rows 46-56, parent totals at row 57
--     SKIP subtotal row 52 (total used retail)
--     EXCLUDE rental/leasing rows 58-62
--
-- Page2: Expenses (3 parents per department)
--   New Vehicles = column M, Used Vehicles = column S
--   sales_expense (Vehicle Selling): total row 21, subs rows 10-19
--   total_direct_expenses (Direct): total row 49, subs rows 23-29 + 31-45 (skip 30 subtotal)
--   total_fixed_expense (Indirect): total row 72, subs rows 54-59 + 61-67 (skip 60 subtotal)
--   Names col B
-- ============================================================

-- ============================================================
-- PAGE 4: NEW VEHICLE PARENT METRICS (row 44)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, unit_cell_reference, is_sub_metric)
VALUES
('Hyundai', 'New Vehicles', 'total_sales', 'Page4', 'B44', 'A44', false),
('Hyundai', 'New Vehicles', 'gp_net',      'Page4', 'E44', 'A44', false);

-- ============================================================
-- PAGE 4: NEW VEHICLE TOTAL SALES SUB-METRICS (col B values, col J names, col A units)
-- Rows 7-10, 17-24, 29-34, 39, 41-43 (skip subtotals, placeholders, TBD)
-- ============================================================It initially shows up with everything hidden. You have to click on the little tab there that says "10 hidden" to reveal the percentages. 
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Hyundai Cars (rows 7-10; skip 11-15 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:total_sales:00', 'Page4', 'B7',  'J7',  'A7',  'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:01', 'Page4', 'B8',  'J8',  'A8',  'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:02', 'Page4', 'B9',  'J9',  'A9',  'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:03', 'Page4', 'B10', 'J10', 'A10', 'total_sales', true),
-- Hyundai Trucks (rows 17-24; skip 25 TBD, 26-27 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:total_sales:04', 'Page4', 'B17', 'J17', 'A17', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:05', 'Page4', 'B18', 'J18', 'A18', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:06', 'Page4', 'B19', 'J19', 'A19', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:07', 'Page4', 'B20', 'J20', 'A20', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:08', 'Page4', 'B21', 'J21', 'A21', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:09', 'Page4', 'B22', 'J22', 'A22', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:10', 'Page4', 'B23', 'J23', 'A23', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:11', 'Page4', 'B24', 'J24', 'A24', 'total_sales', true),
-- Hyundai EV (rows 29-34; skip 35 TBD, 36-37 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:total_sales:12', 'Page4', 'B29', 'J29', 'A29', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:13', 'Page4', 'B30', 'J30', 'A30', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:14', 'Page4', 'B31', 'J31', 'A31', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:15', 'Page4', 'B32', 'J32', 'A32', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:16', 'Page4', 'B33', 'J33', 'A33', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:17', 'Page4', 'B34', 'J34', 'A34', 'total_sales', true),
-- Discontinued + Other (rows 39, 41-43)
('Hyundai', 'New Vehicles', 'sub:total_sales:18', 'Page4', 'B39', 'J39', 'A39', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:19', 'Page4', 'B41', 'J41', NULL,  'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:20', 'Page4', 'B42', 'J42', 'A42', 'total_sales', true),
('Hyundai', 'New Vehicles', 'sub:total_sales:21', 'Page4', 'B43', 'J43', 'A43', 'total_sales', true);

-- ============================================================
-- PAGE 4: NEW VEHICLE GP NET SUB-METRICS (col E values, col J names, col A units — same rows)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Hyundai Cars (rows 7-10; skip 11-15 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:gp_net:00', 'Page4', 'E7',  'J7',  'A7',  'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:01', 'Page4', 'E8',  'J8',  'A8',  'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:02', 'Page4', 'E9',  'J9',  'A9',  'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:03', 'Page4', 'E10', 'J10', 'A10', 'gp_net', true),
-- Hyundai Trucks (rows 17-24; skip 25 TBD, 26-27 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:gp_net:04', 'Page4', 'E17', 'J17', 'A17', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:05', 'Page4', 'E18', 'J18', 'A18', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:06', 'Page4', 'E19', 'J19', 'A19', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:07', 'Page4', 'E20', 'J20', 'A20', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:08', 'Page4', 'E21', 'J21', 'A21', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:09', 'Page4', 'E22', 'J22', 'A22', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:10', 'Page4', 'E23', 'J23', 'A23', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:11', 'Page4', 'E24', 'J24', 'A24', 'gp_net', true),
-- Hyundai EV (rows 29-34; skip 35 TBD, 36-37 empty placeholders)
('Hyundai', 'New Vehicles', 'sub:gp_net:12', 'Page4', 'E29', 'J29', 'A29', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:13', 'Page4', 'E30', 'J30', 'A30', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:14', 'Page4', 'E31', 'J31', 'A31', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:15', 'Page4', 'E32', 'J32', 'A32', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:16', 'Page4', 'E33', 'J33', 'A33', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:17', 'Page4', 'E34', 'J34', 'A34', 'gp_net', true),
-- Discontinued + Other (rows 39, 41-43)
('Hyundai', 'New Vehicles', 'sub:gp_net:18', 'Page4', 'E39', 'J39', 'A39', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:19', 'Page4', 'E41', 'J41', NULL,  'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:20', 'Page4', 'E42', 'J42', 'A42', 'gp_net', true),
('Hyundai', 'New Vehicles', 'sub:gp_net:21', 'Page4', 'E43', 'J43', 'A43', 'gp_net', true);

-- ============================================================
-- PAGE 4: USED VEHICLE PARENT METRICS (row 57)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, unit_cell_reference, is_sub_metric)
VALUES
('Hyundai', 'Used Vehicles', 'total_sales', 'Page4', 'B57', 'A57', false),
('Hyundai', 'Used Vehicles', 'gp_net',      'Page4', 'E57', 'A57', false);

-- ============================================================
-- PAGE 4: USED VEHICLE TOTAL SALES SUB-METRICS (col B values, col J names, col A units)
-- Rows 46-51, 53-56 (skip subtotal row 52)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Hyundai', 'Used Vehicles', 'sub:total_sales:00', 'Page4', 'B46', 'J46', 'A46', 'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:01', 'Page4', 'B47', 'J47', NULL,  'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:02', 'Page4', 'B48', 'J48', 'A48', 'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:03', 'Page4', 'B49', 'J49', NULL,  'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:04', 'Page4', 'B50', 'J50', 'A50', 'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:05', 'Page4', 'B51', 'J51', NULL,  'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:06', 'Page4', 'B53', 'J53', 'A53', 'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:07', 'Page4', 'B54', 'J54', 'A54', 'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:08', 'Page4', 'B55', 'J55', NULL,  'total_sales', true),
('Hyundai', 'Used Vehicles', 'sub:total_sales:09', 'Page4', 'B56', 'J56', NULL,  'total_sales', true);

-- ============================================================
-- PAGE 4: USED VEHICLE GP NET SUB-METRICS (col E values, col J names, col A units — same rows)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Hyundai', 'Used Vehicles', 'sub:gp_net:00', 'Page4', 'E46', 'J46', 'A46', 'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:01', 'Page4', 'E47', 'J47', NULL,  'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:02', 'Page4', 'E48', 'J48', 'A48', 'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:03', 'Page4', 'E49', 'J49', NULL,  'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:04', 'Page4', 'E50', 'J50', 'A50', 'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:05', 'Page4', 'E51', 'J51', NULL,  'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:06', 'Page4', 'E53', 'J53', 'A53', 'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:07', 'Page4', 'E54', 'J54', 'A54', 'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:08', 'Page4', 'E55', 'J55', NULL,  'gp_net', true),
('Hyundai', 'Used Vehicles', 'sub:gp_net:09', 'Page4', 'E56', 'J56', NULL,  'gp_net', true);

-- ============================================================
-- PAGE 2: NEW VEHICLE EXPENSE PARENT METRICS (column M)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Hyundai', 'New Vehicles', 'sales_expense',       'Page2', 'M21', false),
('Hyundai', 'New Vehicles', 'total_direct_expenses',  'Page2', 'M49', false),
('Hyundai', 'New Vehicles', 'total_fixed_expense', 'Page2', 'M72', false);

-- ============================================================
-- PAGE 2: NEW VEHICLE SALES EXPENSE SUB-METRICS (Vehicle Selling, rows 10-19, col M)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Hyundai', 'New Vehicles', 'sales_expense_sub_0', 'Page2', 'M10', 'B10', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_1', 'Page2', 'M11', 'B11', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_2', 'Page2', 'M12', 'B12', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_3', 'Page2', 'M13', 'B13', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_4', 'Page2', 'M14', 'B14', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_5', 'Page2', 'M15', 'B15', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_6', 'Page2', 'M16', 'B16', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_7', 'Page2', 'M17', 'B17', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_8', 'Page2', 'M18', 'B18', 'sales_expense', true),
('Hyundai', 'New Vehicles', 'sales_expense_sub_9', 'Page2', 'M19', 'B19', 'sales_expense', true);

-- ============================================================
-- PAGE 2: NEW VEHICLE SEMI-FIXED EXPENSE SUB-METRICS (Direct Expenses, rows 23-29 + 31-45, col M)
-- Skip row 30 (employment sub-total)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Employment items (rows 23-29)
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_0',  'Page2', 'M23', 'B23', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_1',  'Page2', 'M24', 'B24', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_2',  'Page2', 'M25', 'B25', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_3',  'Page2', 'M26', 'B26', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_4',  'Page2', 'M27', 'B27', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_5',  'Page2', 'M28', 'B28', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_6',  'Page2', 'M29', 'B29', 'total_direct_expenses', true),
-- Operating items (rows 31-45)
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_7',  'Page2', 'M31', 'B31', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_8',  'Page2', 'M32', 'B32', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_9',  'Page2', 'M33', 'B33', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_10', 'Page2', 'M34', 'B34', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_11', 'Page2', 'M35', 'B35', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_12', 'Page2', 'M36', 'B36', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_13', 'Page2', 'M37', 'B37', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_14', 'Page2', 'M38', 'B38', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_15', 'Page2', 'M39', 'B39', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_16', 'Page2', 'M40', 'B40', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_17', 'Page2', 'M41', 'B41', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_18', 'Page2', 'M42', 'B42', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_19', 'Page2', 'M43', 'B43', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_20', 'Page2', 'M44', 'B44', 'total_direct_expenses', true),
('Hyundai', 'New Vehicles', 'total_direct_expenses_sub_21', 'Page2', 'M45', 'B45', 'total_direct_expenses', true);

-- ============================================================
-- PAGE 2: NEW VEHICLE TOTAL FIXED EXPENSE SUB-METRICS (Indirect, rows 54-59 + 61-67, col M)
-- Skip row 60 (rent factor sub-total)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Rent factor items (rows 54-59)
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_0',  'Page2', 'M54', 'B54', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_1',  'Page2', 'M55', 'B55', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_2',  'Page2', 'M56', 'B56', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_3',  'Page2', 'M57', 'B57', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_4',  'Page2', 'M58', 'B58', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_5',  'Page2', 'M59', 'B59', 'total_fixed_expense', true),
-- Other indirect items (rows 61-67)
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_6',  'Page2', 'M61', 'B61', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_7',  'Page2', 'M62', 'B62', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_8',  'Page2', 'M63', 'B63', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_9',  'Page2', 'M64', 'B64', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_10', 'Page2', 'M65', 'B65', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_11', 'Page2', 'M66', 'B66', 'total_fixed_expense', true),
('Hyundai', 'New Vehicles', 'total_fixed_expense_sub_12', 'Page2', 'M67', 'B67', 'total_fixed_expense', true);

-- ============================================================
-- PAGE 2: USED VEHICLE EXPENSE PARENT METRICS (column S)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Hyundai', 'Used Vehicles', 'sales_expense',       'Page2', 'S21', false),
('Hyundai', 'Used Vehicles', 'total_direct_expenses',  'Page2', 'S49', false),
('Hyundai', 'Used Vehicles', 'total_fixed_expense', 'Page2', 'S72', false);

-- ============================================================
-- PAGE 2: USED VEHICLE SALES EXPENSE SUB-METRICS (Vehicle Selling, rows 10-19, col S)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Hyundai', 'Used Vehicles', 'sales_expense_sub_0', 'Page2', 'S10', 'B10', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_1', 'Page2', 'S11', 'B11', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_2', 'Page2', 'S12', 'B12', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_3', 'Page2', 'S13', 'B13', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_4', 'Page2', 'S14', 'B14', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_5', 'Page2', 'S15', 'B15', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_6', 'Page2', 'S16', 'B16', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_7', 'Page2', 'S17', 'B17', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_8', 'Page2', 'S18', 'B18', 'sales_expense', true),
('Hyundai', 'Used Vehicles', 'sales_expense_sub_9', 'Page2', 'S19', 'B19', 'sales_expense', true);

-- ============================================================
-- PAGE 2: USED VEHICLE SEMI-FIXED EXPENSE SUB-METRICS (Direct Expenses, rows 23-29 + 31-45, col S)
-- Skip row 30 (employment sub-total)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Employment items (rows 23-29)
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_0',  'Page2', 'S23', 'B23', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_1',  'Page2', 'S24', 'B24', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_2',  'Page2', 'S25', 'B25', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_3',  'Page2', 'S26', 'B26', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_4',  'Page2', 'S27', 'B27', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_5',  'Page2', 'S28', 'B28', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_6',  'Page2', 'S29', 'B29', 'total_direct_expenses', true),
-- Operating items (rows 31-45)
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_7',  'Page2', 'S31', 'B31', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_8',  'Page2', 'S32', 'B32', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_9',  'Page2', 'S33', 'B33', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_10', 'Page2', 'S34', 'B34', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_11', 'Page2', 'S35', 'B35', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_12', 'Page2', 'S36', 'B36', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_13', 'Page2', 'S37', 'B37', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_14', 'Page2', 'S38', 'B38', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_15', 'Page2', 'S39', 'B39', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_16', 'Page2', 'S40', 'B40', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_17', 'Page2', 'S41', 'B41', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_18', 'Page2', 'S42', 'B42', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_19', 'Page2', 'S43', 'B43', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_20', 'Page2', 'S44', 'B44', 'total_direct_expenses', true),
('Hyundai', 'Used Vehicles', 'total_direct_expenses_sub_21', 'Page2', 'S45', 'B45', 'total_direct_expenses', true);

-- ============================================================
-- PAGE 2: USED VEHICLE TOTAL FIXED EXPENSE SUB-METRICS (Indirect, rows 54-59 + 61-67, col S)
-- Skip row 60 (rent factor sub-total)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Rent factor items (rows 54-59)
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_0',  'Page2', 'S54', 'B54', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_1',  'Page2', 'S55', 'B55', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_2',  'Page2', 'S56', 'B56', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_3',  'Page2', 'S57', 'B57', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_4',  'Page2', 'S58', 'B58', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_5',  'Page2', 'S59', 'B59', 'total_fixed_expense', true),
-- Other indirect items (rows 61-67)
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_6',  'Page2', 'S61', 'B61', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_7',  'Page2', 'S62', 'B62', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_8',  'Page2', 'S63', 'B63', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_9',  'Page2', 'S64', 'B64', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_10', 'Page2', 'S65', 'B65', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_11', 'Page2', 'S66', 'B66', 'total_fixed_expense', true),
('Hyundai', 'Used Vehicles', 'total_fixed_expense_sub_12', 'Page2', 'S67', 'B67', 'total_fixed_expense', true);
