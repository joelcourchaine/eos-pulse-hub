-- Cell mappings for White Rock Hyundai (Hyundai-WR) variant brand
-- WRH uses a different spreadsheet layout than Murray Hyundai:
--   Page3: Parts in col E, Service in col G, names in col B
--   Page4: Sales in col C, GP in col D, GP% in col E, names in col G
-- vs Murray Hyundai:
--   Page3: Parts in col H, Service in col N, names in col C
--   Page4: Sales in col B, GP in col E, GP% in col H, names in col J

-- ============================================================
-- Page3 — Parent metrics for Parts department
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Parts', 'total_sales',           'Page3', 'E4',  NULL, NULL, false, NULL),
('Hyundai-WR', 'Parts', 'gp_net',                'Page3', 'E5',  NULL, NULL, false, NULL),
('Hyundai-WR', 'Parts', 'sales_expense',          'Page3', 'E19', NULL, NULL, false, NULL),
('Hyundai-WR', 'Parts', 'total_direct_expenses',  'Page3', 'E47', NULL, NULL, false, NULL),
('Hyundai-WR', 'Parts', 'net_selling_gross',       'Page3', 'E50', NULL, NULL, false, NULL),
('Hyundai-WR', 'Parts', 'total_fixed_expense',     'Page3', 'E70', NULL, NULL, false, NULL);

-- ============================================================
-- Page3 — Parent metrics for Service department
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Service', 'total_sales',           'Page3', 'G4',  NULL, NULL, false, NULL),
('Hyundai-WR', 'Service', 'gp_net',                'Page3', 'G5',  NULL, NULL, false, NULL),
('Hyundai-WR', 'Service', 'sales_expense',          'Page3', 'G19', NULL, NULL, false, NULL),
('Hyundai-WR', 'Service', 'total_direct_expenses',  'Page3', 'G47', NULL, NULL, false, NULL),
('Hyundai-WR', 'Service', 'net_selling_gross',       'Page3', 'G50', NULL, NULL, false, NULL),
('Hyundai-WR', 'Service', 'total_fixed_expense',     'Page3', 'G70', NULL, NULL, false, NULL);

-- ============================================================
-- Page3 — Sales Expense sub-metrics for Parts (rows 8-17)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Parts', 'sub:sales_expense:01', 'Page3', 'E8',  'B8',  'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:02', 'Page3', 'E9',  'B9',  'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:03', 'Page3', 'E10', 'B10', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:04', 'Page3', 'E11', 'B11', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:05', 'Page3', 'E12', 'B12', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:06', 'Page3', 'E13', 'B13', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:07', 'Page3', 'E14', 'B14', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:08', 'Page3', 'E15', 'B15', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:09', 'Page3', 'E16', 'B16', 'sales_expense', true, NULL),
('Hyundai-WR', 'Parts', 'sub:sales_expense:10', 'Page3', 'E17', 'B17', 'sales_expense', true, NULL);

-- ============================================================
-- Page3 — Sales Expense sub-metrics for Service (rows 8-17)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Service', 'sub:sales_expense:01', 'Page3', 'G8',  'B8',  'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:02', 'Page3', 'G9',  'B9',  'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:03', 'Page3', 'G10', 'B10', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:04', 'Page3', 'G11', 'B11', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:05', 'Page3', 'G12', 'B12', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:06', 'Page3', 'G13', 'B13', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:07', 'Page3', 'G14', 'B14', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:08', 'Page3', 'G15', 'B15', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:09', 'Page3', 'G16', 'B16', 'sales_expense', true, NULL),
('Hyundai-WR', 'Service', 'sub:sales_expense:10', 'Page3', 'G17', 'B17', 'sales_expense', true, NULL);

-- ============================================================
-- Page3 — Direct Expense sub-metrics for Parts (rows 21-27, 29-43)
-- Row 28 is SUB-TOTAL EMPLOYMENT EXP — skipped
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:01', 'Page3', 'E21', 'B21', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:02', 'Page3', 'E22', 'B22', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:03', 'Page3', 'E23', 'B23', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:04', 'Page3', 'E24', 'B24', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:05', 'Page3', 'E25', 'B25', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:06', 'Page3', 'E26', 'B26', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:07', 'Page3', 'E27', 'B27', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:08', 'Page3', 'E29', 'B29', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:09', 'Page3', 'E30', 'B30', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:10', 'Page3', 'E31', 'B31', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:11', 'Page3', 'E32', 'B32', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:12', 'Page3', 'E33', 'B33', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:13', 'Page3', 'E34', 'B34', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:14', 'Page3', 'E35', 'B35', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:15', 'Page3', 'E36', 'B36', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:16', 'Page3', 'E37', 'B37', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:17', 'Page3', 'E38', 'B38', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:18', 'Page3', 'E39', 'B39', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:19', 'Page3', 'E40', 'B40', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:20', 'Page3', 'E41', 'B41', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:21', 'Page3', 'E42', 'B42', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_direct_expenses:22', 'Page3', 'E43', 'B43', 'total_direct_expenses', true, NULL);

-- ============================================================
-- Page3 — Direct Expense sub-metrics for Service (rows 21-27, 29-43)
-- Row 28 is SUB-TOTAL EMPLOYMENT EXP — skipped
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:01', 'Page3', 'G21', 'B21', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:02', 'Page3', 'G22', 'B22', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:03', 'Page3', 'G23', 'B23', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:04', 'Page3', 'G24', 'B24', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:05', 'Page3', 'G25', 'B25', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:06', 'Page3', 'G26', 'B26', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:07', 'Page3', 'G27', 'B27', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:08', 'Page3', 'G29', 'B29', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:09', 'Page3', 'G30', 'B30', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:10', 'Page3', 'G31', 'B31', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:11', 'Page3', 'G32', 'B32', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:12', 'Page3', 'G33', 'B33', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:13', 'Page3', 'G34', 'B34', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:14', 'Page3', 'G35', 'B35', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:15', 'Page3', 'G36', 'B36', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:16', 'Page3', 'G37', 'B37', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:17', 'Page3', 'G38', 'B38', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:18', 'Page3', 'G39', 'B39', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:19', 'Page3', 'G40', 'B40', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:20', 'Page3', 'G41', 'B41', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:21', 'Page3', 'G42', 'B42', 'total_direct_expenses', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_direct_expenses:22', 'Page3', 'G43', 'B43', 'total_direct_expenses', true, NULL);

-- ============================================================
-- Page4 — Parts department sub-metrics (rows 61-71)
-- Col C = Sales, Col D = GP, Col E = GP%, Col G = Name
-- Row 72 is TOTAL PARTS DEPARTMENT — skipped
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- total_sales sub-metrics (col C)
('Hyundai-WR', 'Parts', 'sub:total_sales:01', 'Page4', 'C61', 'G61', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:02', 'Page4', 'C62', 'G62', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:03', 'Page4', 'C63', 'G63', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:04', 'Page4', 'C64', 'G64', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:05', 'Page4', 'C65', 'G65', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:06', 'Page4', 'C66', 'G66', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:07', 'Page4', 'C67', 'G67', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:08', 'Page4', 'C68', 'G68', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:09', 'Page4', 'C69', 'G69', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:10', 'Page4', 'C70', 'G70', 'total_sales', true, NULL),
('Hyundai-WR', 'Parts', 'sub:total_sales:11', 'Page4', 'C71', 'G71', 'total_sales', true, NULL),
-- gp_net sub-metrics (col D)
('Hyundai-WR', 'Parts', 'sub:gp_net:01', 'Page4', 'D61', 'G61', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:02', 'Page4', 'D62', 'G62', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:03', 'Page4', 'D63', 'G63', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:04', 'Page4', 'D64', 'G64', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:05', 'Page4', 'D65', 'G65', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:06', 'Page4', 'D66', 'G66', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:07', 'Page4', 'D67', 'G67', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:08', 'Page4', 'D68', 'G68', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:09', 'Page4', 'D69', 'G69', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:10', 'Page4', 'D70', 'G70', 'gp_net', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_net:11', 'Page4', 'D71', 'G71', 'gp_net', true, NULL),
-- gp_percent sub-metrics (col E)
('Hyundai-WR', 'Parts', 'sub:gp_percent:01', 'Page4', 'E61', 'G61', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:02', 'Page4', 'E62', 'G62', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:03', 'Page4', 'E63', 'G63', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:04', 'Page4', 'E64', 'G64', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:05', 'Page4', 'E65', 'G65', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:06', 'Page4', 'E66', 'G66', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:07', 'Page4', 'E67', 'G67', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:08', 'Page4', 'E68', 'G68', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:09', 'Page4', 'E69', 'G69', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:10', 'Page4', 'E70', 'G70', 'gp_percent', true, NULL),
('Hyundai-WR', 'Parts', 'sub:gp_percent:11', 'Page4', 'E71', 'G71', 'gp_percent', true, NULL);

-- ============================================================
-- Page4 — Service department sub-metrics (rows 74-77, 79-83)
-- Row 78 is TOTAL LABOUR - SERVICE subtotal — skipped
-- Row 84 is TOTAL SERVICE DEPARTMENT — skipped
-- Col C = Sales, Col D = GP, Col E = GP%, Col G = Name
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- total_sales sub-metrics (col C)
('Hyundai-WR', 'Service', 'sub:total_sales:01', 'Page4', 'C74', 'G74', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:02', 'Page4', 'C75', 'G75', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:03', 'Page4', 'C76', 'G76', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:04', 'Page4', 'C77', 'G77', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:05', 'Page4', 'C79', 'G79', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:06', 'Page4', 'C80', 'G80', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:07', 'Page4', 'C81', 'G81', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:08', 'Page4', 'C82', 'G82', 'total_sales', true, NULL),
('Hyundai-WR', 'Service', 'sub:total_sales:09', 'Page4', 'C83', 'G83', 'total_sales', true, NULL),
-- gp_net sub-metrics (col D)
('Hyundai-WR', 'Service', 'sub:gp_net:01', 'Page4', 'D74', 'G74', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:02', 'Page4', 'D75', 'G75', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:03', 'Page4', 'D76', 'G76', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:04', 'Page4', 'D77', 'G77', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:05', 'Page4', 'D79', 'G79', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:06', 'Page4', 'D80', 'G80', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:07', 'Page4', 'D81', 'G81', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:08', 'Page4', 'D82', 'G82', 'gp_net', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_net:09', 'Page4', 'D83', 'G83', 'gp_net', true, NULL),
-- gp_percent sub-metrics (col E)
('Hyundai-WR', 'Service', 'sub:gp_percent:01', 'Page4', 'E74', 'G74', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:02', 'Page4', 'E75', 'G75', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:03', 'Page4', 'E76', 'G76', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:04', 'Page4', 'E77', 'G77', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:05', 'Page4', 'E79', 'G79', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:06', 'Page4', 'E80', 'G80', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:07', 'Page4', 'E81', 'G81', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:08', 'Page4', 'E82', 'G82', 'gp_percent', true, NULL),
('Hyundai-WR', 'Service', 'sub:gp_percent:09', 'Page4', 'E83', 'G83', 'gp_percent', true, NULL);

-- ============================================================
-- Add Hyundai-WR to brands table
-- ============================================================
INSERT INTO public.brands (name)
VALUES ('Hyundai-WR')
ON CONFLICT (name) DO NOTHING;
