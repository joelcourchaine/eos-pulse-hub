-- Ford Body Shop Department Financial Cell Mappings
-- ============================================================
-- Parent metrics: Total Sales (FORD5 S44), GP Net (FORD5 S45),
--   Sales Expense (FORD5 S62), Total Fixed Expense (FORD2 AF13)
-- Sub-metrics: Total Sales & GP Net (6 each), Sales Expense (13),
--   Total Fixed Expense (22)
-- NOTE: Sheet names use 'FORD5'/'FORD2'/'FORD6' format (matching existing 'FORD6' pattern).
--   Verify these match the actual Excel tab names.
-- Total Fixed Expense subs on FORD6 (col AC values, col B names) — matches Parts/Service pattern.

-- ============================================================
-- PARENT METRICS
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Ford', 'Body Shop Department', 'total_sales', 'FORD5', 'S44', false),
('Ford', 'Body Shop Department', 'gp_net', 'FORD5', 'S45', false),
('Ford', 'Body Shop Department', 'sales_expense', 'FORD5', 'S62', false),
('Ford', 'Body Shop Department', 'total_fixed_expense', 'FORD2', 'AF13', false);

-- ============================================================
-- TOTAL SALES SUB-METRICS (FORD5 col S, names col G, even rows 28-38)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Ford', 'Body Shop Department', 'sub:total_sales:00', 'FORD5', 'S28', 'G28', 'total_sales', true),
('Ford', 'Body Shop Department', 'sub:total_sales:01', 'FORD5', 'S30', 'G30', 'total_sales', true),
('Ford', 'Body Shop Department', 'sub:total_sales:02', 'FORD5', 'S32', 'G32', 'total_sales', true),
('Ford', 'Body Shop Department', 'sub:total_sales:03', 'FORD5', 'S34', 'G34', 'total_sales', true),
('Ford', 'Body Shop Department', 'sub:total_sales:04', 'FORD5', 'S36', 'G36', 'total_sales', true),
('Ford', 'Body Shop Department', 'sub:total_sales:05', 'FORD5', 'S38', 'G38', 'total_sales', true);

-- ============================================================
-- GP NET SUB-METRICS (FORD5 col S, names col G, even rows 28-38)
-- Same cells as Total Sales — same line item breakdown
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Ford', 'Body Shop Department', 'sub:gp_net:00', 'FORD5', 'S29', 'G28', 'gp_net', true),
('Ford', 'Body Shop Department', 'sub:gp_net:01', 'FORD5', 'S31', 'G30', 'gp_net', true),
('Ford', 'Body Shop Department', 'sub:gp_net:02', 'FORD5', 'S33', 'G32', 'gp_net', true),
('Ford', 'Body Shop Department', 'sub:gp_net:03', 'FORD5', 'S35', 'G34', 'gp_net', true),
('Ford', 'Body Shop Department', 'sub:gp_net:04', 'FORD5', 'S37', 'G36', 'gp_net', true);

-- ============================================================
-- SALES EXPENSE SUB-METRICS (FORD5 col S values, col G names, rows 49-61)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Ford', 'Body Shop Department', 'sub:sales_expense:00', 'FORD5', 'S49', 'G49', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:01', 'FORD5', 'S50', 'G50', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:02', 'FORD5', 'S51', 'G51', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:03', 'FORD5', 'S52', 'G52', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:04', 'FORD5', 'S53', 'G53', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:05', 'FORD5', 'S54', 'G54', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:06', 'FORD5', 'S55', 'G55', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:07', 'FORD5', 'S56', 'G56', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:08', 'FORD5', 'S57', 'G57', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:09', 'FORD5', 'S58', 'G58', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:10', 'FORD5', 'S59', 'G59', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:11', 'FORD5', 'S60', 'G60', 'sales_expense', true),
('Ford', 'Body Shop Department', 'sub:sales_expense:12', 'FORD5', 'S61', 'G61', 'sales_expense', true);

-- ============================================================
-- TOTAL FIXED EXPENSE SUB-METRICS (FORD6 col AC values, col B names, rows 5-26)
-- Matches Parts (col Y) and Service (col Z) pattern on FORD6
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:00', 'FORD6', 'AC5', 'B5', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:01', 'FORD6', 'AC6', 'B6', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:02', 'FORD6', 'AC7', 'B7', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:03', 'FORD6', 'AC8', 'B8', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:04', 'FORD6', 'AC9', 'B9', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:05', 'FORD6', 'AC10', 'B10', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:06', 'FORD6', 'AC11', 'B11', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:07', 'FORD6', 'AC12', 'B12', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:08', 'FORD6', 'AC13', 'B13', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:09', 'FORD6', 'AC14', 'B14', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:10', 'FORD6', 'AC15', 'B15', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:11', 'FORD6', 'AC16', 'B16', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:12', 'FORD6', 'AC17', 'B17', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:13', 'FORD6', 'AC18', 'B18', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:14', 'FORD6', 'AC19', 'B19', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:15', 'FORD6', 'AC20', 'B20', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:16', 'FORD6', 'AC21', 'B21', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:17', 'FORD6', 'AC22', 'B22', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:18', 'FORD6', 'AC23', 'B23', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:19', 'FORD6', 'AC24', 'B24', 'total_fixed_expense', true),
('Ford', 'Body Shop Department', 'sub:total_fixed_expense:20', 'FORD6', 'AC25', 'B25', 'total_fixed_expense', true),
