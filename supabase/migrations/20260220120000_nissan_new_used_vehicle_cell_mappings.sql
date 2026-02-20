-- Nissan New & Used Vehicle Financial Cell Mappings
-- ============================================================
-- Maps Nissan4 (Sales/GP) and Nissan2 (Expenses) sheets
-- 205 total rows: 12 parents + 193 sub-metrics
-- Skipped rows: Nissan4 rows 14, 27-29 (New); Nissan2 row 20 (both)

-- ============================================================
-- PARENT METRICS
-- ============================================================

-- New Vehicles parent metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_sales', 'Nissan4', 'C40', false),
('Nissan', 'New Vehicles', 'gp_net', 'Nissan4', 'D40', false),
('Nissan', 'New Vehicles', 'sales_expense', 'Nissan2', 'H13', false),
('Nissan', 'New Vehicles', 'total_direct_expenses', 'Nissan2', 'H38', false),
('Nissan', 'New Vehicles', 'total_fixed_expense', 'Nissan2', 'H61', false),
('Nissan', 'New Vehicles', 'department_profit', 'Nissan2', 'H64', false);

-- Used Vehicles parent metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'total_sales', 'Nissan4', 'C56', false),
('Nissan', 'Used Vehicles', 'gp_net', 'Nissan4', 'D56', false),
('Nissan', 'Used Vehicles', 'sales_expense', 'Nissan2', 'L13', false),
('Nissan', 'Used Vehicles', 'total_direct_expenses', 'Nissan2', 'L38', false),
('Nissan', 'Used Vehicles', 'total_fixed_expense', 'Nissan2', 'L61', false),
('Nissan', 'Used Vehicles', 'department_profit', 'Nissan2', 'L64', false);

-- ============================================================
-- NISSAN4: TOTAL SALES SUB-METRICS (Col C values, Col G names)
-- ============================================================

-- New Vehicle Total Sales sub-metrics (rows 6-39, skip 14, 27-29)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_sales_sub_1', 'Nissan4', 'C6', 'G6', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_2', 'Nissan4', 'C7', 'G7', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_3', 'Nissan4', 'C8', 'G8', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_4', 'Nissan4', 'C9', 'G9', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_5', 'Nissan4', 'C10', 'G10', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_6', 'Nissan4', 'C11', 'G11', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_7', 'Nissan4', 'C12', 'G12', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_8', 'Nissan4', 'C13', 'G13', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_9', 'Nissan4', 'C15', 'G15', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_10', 'Nissan4', 'C16', 'G16', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_11', 'Nissan4', 'C17', 'G17', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_12', 'Nissan4', 'C18', 'G18', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_13', 'Nissan4', 'C19', 'G19', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_14', 'Nissan4', 'C20', 'G20', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_15', 'Nissan4', 'C21', 'G21', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_16', 'Nissan4', 'C22', 'G22', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_17', 'Nissan4', 'C23', 'G23', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_18', 'Nissan4', 'C24', 'G24', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_19', 'Nissan4', 'C25', 'G25', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_20', 'Nissan4', 'C26', 'G26', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_21', 'Nissan4', 'C30', 'G30', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_22', 'Nissan4', 'C31', 'G31', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_23', 'Nissan4', 'C32', 'G32', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_24', 'Nissan4', 'C33', 'G33', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_25', 'Nissan4', 'C34', 'G34', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_26', 'Nissan4', 'C35', 'G35', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_27', 'Nissan4', 'C36', 'G36', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_28', 'Nissan4', 'C37', 'G37', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_29', 'Nissan4', 'C38', 'G38', 'total_sales', true),
('Nissan', 'New Vehicles', 'total_sales_sub_30', 'Nissan4', 'C39', 'G39', 'total_sales', true);

-- Used Vehicle Total Sales sub-metrics (rows 41-55, 15 subs)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'total_sales_sub_1', 'Nissan4', 'C41', 'G41', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_2', 'Nissan4', 'C42', 'G42', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_3', 'Nissan4', 'C43', 'G43', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_4', 'Nissan4', 'C44', 'G44', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_5', 'Nissan4', 'C45', 'G45', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_6', 'Nissan4', 'C46', 'G46', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_7', 'Nissan4', 'C47', 'G47', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_8', 'Nissan4', 'C48', 'G48', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_9', 'Nissan4', 'C49', 'G49', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_10', 'Nissan4', 'C50', 'G50', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_11', 'Nissan4', 'C51', 'G51', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_12', 'Nissan4', 'C52', 'G52', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_13', 'Nissan4', 'C53', 'G53', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_14', 'Nissan4', 'C54', 'G54', 'total_sales', true),
('Nissan', 'Used Vehicles', 'total_sales_sub_15', 'Nissan4', 'C55', 'G55', 'total_sales', true);

-- ============================================================
-- NISSAN4: GP NET SUB-METRICS (Col D values, Col G names)
-- ============================================================

-- New Vehicle GP Net sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'gp_net_sub_1', 'Nissan4', 'D6', 'G6', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_2', 'Nissan4', 'D7', 'G7', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_3', 'Nissan4', 'D8', 'G8', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_4', 'Nissan4', 'D9', 'G9', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_5', 'Nissan4', 'D10', 'G10', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_6', 'Nissan4', 'D11', 'G11', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_7', 'Nissan4', 'D12', 'G12', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_8', 'Nissan4', 'D13', 'G13', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_9', 'Nissan4', 'D15', 'G15', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_10', 'Nissan4', 'D16', 'G16', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_11', 'Nissan4', 'D17', 'G17', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_12', 'Nissan4', 'D18', 'G18', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_13', 'Nissan4', 'D19', 'G19', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_14', 'Nissan4', 'D20', 'G20', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_15', 'Nissan4', 'D21', 'G21', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_16', 'Nissan4', 'D22', 'G22', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_17', 'Nissan4', 'D23', 'G23', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_18', 'Nissan4', 'D24', 'G24', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_19', 'Nissan4', 'D25', 'G25', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_20', 'Nissan4', 'D26', 'G26', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_21', 'Nissan4', 'D30', 'G30', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_22', 'Nissan4', 'D31', 'G31', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_23', 'Nissan4', 'D32', 'G32', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_24', 'Nissan4', 'D33', 'G33', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_25', 'Nissan4', 'D34', 'G34', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_26', 'Nissan4', 'D35', 'G35', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_27', 'Nissan4', 'D36', 'G36', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_28', 'Nissan4', 'D37', 'G37', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_29', 'Nissan4', 'D38', 'G38', 'gp_net', true),
('Nissan', 'New Vehicles', 'gp_net_sub_30', 'Nissan4', 'D39', 'G39', 'gp_net', true);

-- Used Vehicle GP Net sub-metrics (rows 41-55, 15 subs)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'gp_net_sub_1', 'Nissan4', 'D41', 'G41', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_2', 'Nissan4', 'D42', 'G42', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_3', 'Nissan4', 'D43', 'G43', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_4', 'Nissan4', 'D44', 'G44', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_5', 'Nissan4', 'D45', 'G45', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_6', 'Nissan4', 'D46', 'G46', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_7', 'Nissan4', 'D47', 'G47', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_8', 'Nissan4', 'D48', 'G48', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_9', 'Nissan4', 'D49', 'G49', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_10', 'Nissan4', 'D50', 'G50', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_11', 'Nissan4', 'D51', 'G51', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_12', 'Nissan4', 'D52', 'G52', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_13', 'Nissan4', 'D53', 'G53', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_14', 'Nissan4', 'D54', 'G54', 'gp_net', true),
('Nissan', 'Used Vehicles', 'gp_net_sub_15', 'Nissan4', 'D55', 'G55', 'gp_net', true);

-- ============================================================
-- NISSAN4: GP % SUB-METRICS (Col E values, Col G names)
-- ============================================================

-- New Vehicle GP % sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'gp_percent_sub_1', 'Nissan4', 'E6', 'G6', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_2', 'Nissan4', 'E7', 'G7', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_3', 'Nissan4', 'E8', 'G8', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_4', 'Nissan4', 'E9', 'G9', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_5', 'Nissan4', 'E10', 'G10', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_6', 'Nissan4', 'E11', 'G11', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_7', 'Nissan4', 'E12', 'G12', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_8', 'Nissan4', 'E13', 'G13', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_9', 'Nissan4', 'E15', 'G15', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_10', 'Nissan4', 'E16', 'G16', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_11', 'Nissan4', 'E17', 'G17', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_12', 'Nissan4', 'E18', 'G18', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_13', 'Nissan4', 'E19', 'G19', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_14', 'Nissan4', 'E20', 'G20', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_15', 'Nissan4', 'E21', 'G21', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_16', 'Nissan4', 'E22', 'G22', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_17', 'Nissan4', 'E23', 'G23', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_18', 'Nissan4', 'E24', 'G24', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_19', 'Nissan4', 'E25', 'G25', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_20', 'Nissan4', 'E26', 'G26', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_21', 'Nissan4', 'E30', 'G30', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_22', 'Nissan4', 'E31', 'G31', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_23', 'Nissan4', 'E32', 'G32', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_24', 'Nissan4', 'E33', 'G33', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_25', 'Nissan4', 'E34', 'G34', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_26', 'Nissan4', 'E35', 'G35', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_27', 'Nissan4', 'E36', 'G36', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_28', 'Nissan4', 'E37', 'G37', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_29', 'Nissan4', 'E38', 'G38', 'gp_percent', true),
('Nissan', 'New Vehicles', 'gp_percent_sub_30', 'Nissan4', 'E39', 'G39', 'gp_percent', true);

-- Used Vehicle GP % sub-metrics (rows 41-55, 15 subs)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'gp_percent_sub_1', 'Nissan4', 'E41', 'G41', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_2', 'Nissan4', 'E42', 'G42', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_3', 'Nissan4', 'E43', 'G43', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_4', 'Nissan4', 'E44', 'G44', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_5', 'Nissan4', 'E45', 'G45', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_6', 'Nissan4', 'E46', 'G46', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_7', 'Nissan4', 'E47', 'G47', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_8', 'Nissan4', 'E48', 'G48', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_9', 'Nissan4', 'E49', 'G49', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_10', 'Nissan4', 'E50', 'G50', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_11', 'Nissan4', 'E51', 'G51', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_12', 'Nissan4', 'E52', 'G52', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_13', 'Nissan4', 'E53', 'G53', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_14', 'Nissan4', 'E54', 'G54', 'gp_percent', true),
('Nissan', 'Used Vehicles', 'gp_percent_sub_15', 'Nissan4', 'E55', 'G55', 'gp_percent', true);

-- ============================================================
-- NISSAN2: SALES EXPENSE SUB-METRICS (Rows 9-12)
-- ============================================================

-- New Vehicle Sales Expense sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'sales_expense_sub_1', 'Nissan2', 'H9', 'B9', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_2', 'Nissan2', 'H10', 'B10', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_3', 'Nissan2', 'H11', 'B11', 'sales_expense', true),
('Nissan', 'New Vehicles', 'sales_expense_sub_4', 'Nissan2', 'H12', 'B12', 'sales_expense', true);

-- Used Vehicle Sales Expense sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'sales_expense_sub_1', 'Nissan2', 'L9', 'B9', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_2', 'Nissan2', 'L10', 'B10', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_3', 'Nissan2', 'L11', 'B11', 'sales_expense', true),
('Nissan', 'Used Vehicles', 'sales_expense_sub_4', 'Nissan2', 'L12', 'B12', 'sales_expense', true);

-- ============================================================
-- NISSAN2: TOTAL DIRECT EXPENSES SUB-METRICS (Rows 15-37, skip 20)
-- ============================================================

-- New Vehicle Total Direct Expenses sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_1', 'Nissan2', 'H15', 'B15', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_2', 'Nissan2', 'H16', 'B16', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_3', 'Nissan2', 'H17', 'B17', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_4', 'Nissan2', 'H18', 'B18', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_5', 'Nissan2', 'H19', 'B19', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_6', 'Nissan2', 'H21', 'B21', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_7', 'Nissan2', 'H22', 'B22', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_8', 'Nissan2', 'H23', 'B23', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_9', 'Nissan2', 'H24', 'B24', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_10', 'Nissan2', 'H25', 'B25', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_11', 'Nissan2', 'H26', 'B26', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_12', 'Nissan2', 'H27', 'B27', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_13', 'Nissan2', 'H28', 'B28', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_14', 'Nissan2', 'H29', 'B29', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_15', 'Nissan2', 'H30', 'B30', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_16', 'Nissan2', 'H31', 'B31', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_17', 'Nissan2', 'H32', 'B32', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_18', 'Nissan2', 'H33', 'B33', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_19', 'Nissan2', 'H34', 'B34', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_20', 'Nissan2', 'H35', 'B35', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_21', 'Nissan2', 'H36', 'B36', 'total_direct_expenses', true),
('Nissan', 'New Vehicles', 'total_direct_expenses_sub_22', 'Nissan2', 'H37', 'B37', 'total_direct_expenses', true);

-- Used Vehicle Total Direct Expenses sub-metrics
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_1', 'Nissan2', 'L15', 'B15', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_2', 'Nissan2', 'L16', 'B16', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_3', 'Nissan2', 'L17', 'B17', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_4', 'Nissan2', 'L18', 'B18', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_5', 'Nissan2', 'L19', 'B19', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_6', 'Nissan2', 'L21', 'B21', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_7', 'Nissan2', 'L22', 'B22', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_8', 'Nissan2', 'L23', 'B23', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_9', 'Nissan2', 'L24', 'B24', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_10', 'Nissan2', 'L25', 'B25', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_11', 'Nissan2', 'L26', 'B26', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_12', 'Nissan2', 'L27', 'B27', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_13', 'Nissan2', 'L28', 'B28', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_14', 'Nissan2', 'L29', 'B29', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_15', 'Nissan2', 'L30', 'B30', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_16', 'Nissan2', 'L31', 'B31', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_17', 'Nissan2', 'L32', 'B32', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_18', 'Nissan2', 'L33', 'B33', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_19', 'Nissan2', 'L34', 'B34', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_20', 'Nissan2', 'L35', 'B35', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_21', 'Nissan2', 'L36', 'B36', 'total_direct_expenses', true),
('Nissan', 'Used Vehicles', 'total_direct_expenses_sub_22', 'Nissan2', 'L37', 'B37', 'total_direct_expenses', true);
