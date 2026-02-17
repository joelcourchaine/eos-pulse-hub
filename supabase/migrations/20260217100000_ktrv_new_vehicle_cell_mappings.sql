-- KTRV financial cell mappings for New Vehicle Department
-- Total Sales from Page3, GP/Expense metrics from Page2, Fixed Expense from Op. Summary

-- =============================================================
-- NEW VEHICLE DEPARTMENT - Parent metrics
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicle Department', 'total_sales',         'Page3',       'D35', false, NULL),
  ('KTRV', 'New Vehicle Department', 'gp_net',              'Page2',       'N4',  false, NULL),
  ('KTRV', 'New Vehicle Department', 'sales_expense',       'Page2',       'N9',  false, NULL),
  ('KTRV', 'New Vehicle Department', 'semi_fixed_expense',  'Page2',       'N20', false, NULL),
  ('KTRV', 'New Vehicle Department', 'net_selling_gross',   'Page2',       'N21', false, NULL),
  ('KTRV', 'New Vehicle Department', 'total_fixed_expense', 'Op. Summary', 'O44', false, NULL),
  ('KTRV', 'New Vehicle Department', 'department_profit',   'Op. Summary', 'O45', false, NULL);

-- =============================================================
-- Total Sales sub-metrics (Page3, Column D)
-- Vehicle section: labels in Column L
-- F&I section: labels in Column K
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  -- Vehicle Sales
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:001:CLASS A',               'Page3', 'D5',  'L5',  true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:002:CLASS B',               'Page3', 'D7',  'L7',  true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:003:TRAVEL TRAILER',        'Page3', 'D15', 'L15', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:004:OTHER MAKES',           'Page3', 'D17', 'L17', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:005:TOTAL NEW RETAIL',      'Page3', 'D19', 'L19', true, 'total_sales'),
  -- F&I Sales
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:006:F&I RESERVE - NEW',     'Page3', 'D27', 'K27', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:007:F&I FINANCE FEE - NEW', 'Page3', 'D29', 'K29', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:008:F&I WARRANTY - NEW',    'Page3', 'D30', 'K30', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:009:F&I PROTECTIONS - NEW', 'Page3', 'D31', 'K31', true, 'total_sales'),
  ('KTRV', 'New Vehicle Department', 'sub:total_sales:010:TOTAL NEW F&I',         'Page3', 'D34', 'K34', true, 'total_sales');

-- =============================================================
-- Sales Expense sub-metrics (Page2, Column N, names Column D)
-- Rows 5-8
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicle Department', 'sub:sales_expense:001', 'Page2', 'N5', 'D5', true, 'sales_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:sales_expense:002', 'Page2', 'N6', 'D6', true, 'sales_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:sales_expense:003', 'Page2', 'N7', 'D7', true, 'sales_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:sales_expense:004', 'Page2', 'N8', 'D8', true, 'sales_expense');

-- =============================================================
-- Semi-Fixed Expense sub-metrics (Page2, Column N, names Column D)
-- Rows 12-15, 18-19
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:001', 'Page2', 'N12', 'D12', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:002', 'Page2', 'N13', 'D13', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:003', 'Page2', 'N14', 'D14', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:004', 'Page2', 'N15', 'D15', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:005', 'Page2', 'N18', 'D18', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:semi_fixed_expense:006', 'Page2', 'N19', 'D19', true, 'semi_fixed_expense');

-- =============================================================
-- Total Fixed Expense sub-metrics (Op. Summary, Column O, names Column C)
-- Rows 21-39 (individual items) + Row 43 (Prorated Expense)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:001', 'Op. Summary', 'O21', 'C21', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:002', 'Op. Summary', 'O22', 'C22', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:003', 'Op. Summary', 'O23', 'C23', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:004', 'Op. Summary', 'O24', 'C24', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:005', 'Op. Summary', 'O25', 'C25', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:006', 'Op. Summary', 'O26', 'C26', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:007', 'Op. Summary', 'O27', 'C27', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:008', 'Op. Summary', 'O28', 'C28', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:009', 'Op. Summary', 'O29', 'C29', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:010', 'Op. Summary', 'O30', 'C30', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:011', 'Op. Summary', 'O31', 'C31', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:012', 'Op. Summary', 'O32', 'C32', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:013', 'Op. Summary', 'O33', 'C33', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:014', 'Op. Summary', 'O34', 'C34', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:015', 'Op. Summary', 'O35', 'C35', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:016', 'Op. Summary', 'O36', 'C36', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:017', 'Op. Summary', 'O37', 'C37', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:018', 'Op. Summary', 'O38', 'C38', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:019', 'Op. Summary', 'O39', 'C39', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicle Department', 'sub:total_fixed_expense:020', 'Op. Summary', 'O43', 'C43', true, 'total_fixed_expense');
