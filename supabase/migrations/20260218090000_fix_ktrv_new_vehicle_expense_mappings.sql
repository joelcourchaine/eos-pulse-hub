-- Fix KTRV New Vehicles expense metric mappings
-- Corrects parent totals, sub-metric rows, adds missing sub-metrics,
-- adds % sub-metrics, fixes total fixed expense layout.

-- ============================================================
-- 1. Fix Parent Metric Cell References
-- ============================================================

-- Sales Expense: N9 -> N10
UPDATE financial_cell_mappings
SET cell_reference = 'N10'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sales_expense' AND cell_reference = 'N9';

-- Semi-Fixed Expense: N20 -> N21
UPDATE financial_cell_mappings
SET cell_reference = 'N21'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'semi_fixed_expense' AND cell_reference = 'N20';

-- Net Selling Gross: N21 -> N22
UPDATE financial_cell_mappings
SET cell_reference = 'N22'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'net_selling_gross' AND cell_reference = 'N21';

-- Total Fixed Expense: O44 -> O45
UPDATE financial_cell_mappings
SET cell_reference = 'O45'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'total_fixed_expense' AND cell_reference = 'O44';

-- Department Profit: O45 -> O46
UPDATE financial_cell_mappings
SET cell_reference = 'O46'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'department_profit' AND cell_reference = 'O45';


-- ============================================================
-- 2. Fix Sales Expense Sub-Metrics (Page2)
--    Old: N5/D5, N6/D6, N7/D7, N8/D8 (off by one row)
--    New: N6/D6, N7/D7, N8/D8, N9/D9
-- ============================================================

DELETE FROM financial_cell_mappings
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND is_sub_metric = true AND parent_metric_key = 'sales_expense';

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicles', 'sub:sales_expense:001', 'Page2', 'N6', 'D6', true, 'sales_expense'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense:002', 'Page2', 'N7', 'D7', true, 'sales_expense'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense:003', 'Page2', 'N8', 'D8', true, 'sales_expense'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense:004', 'Page2', 'N9', 'D9', true, 'sales_expense');


-- ============================================================
-- 3. Fix Semi-Fixed Expense Sub-Metrics (Page2)
--    Old: N12-N15, N18-N19 (6 items, missing N16, N17, N20)
--    New: N12-N20 (9 items)
-- ============================================================

DELETE FROM financial_cell_mappings
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND is_sub_metric = true AND parent_metric_key = 'semi_fixed_expense';

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:001', 'Page2', 'N12', 'D12', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:002', 'Page2', 'N13', 'D13', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:003', 'Page2', 'N14', 'D14', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:004', 'Page2', 'N15', 'D15', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:005', 'Page2', 'N16', 'D16', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:006', 'Page2', 'N17', 'D17', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:007', 'Page2', 'N18', 'D18', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:008', 'Page2', 'N19', 'D19', true, 'semi_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense:009', 'Page2', 'N20', 'D20', true, 'semi_fixed_expense');


-- ============================================================
-- 4. Fix Total Fixed Expense Sub-Metrics (Op. Summary)
--    Remove: O32, O36, O43
--    Add: O40, O44
--    Embed known names in metric_keys
-- ============================================================

DELETE FROM financial_cell_mappings
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND is_sub_metric = true AND parent_metric_key = 'total_fixed_expense';

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:001:Salaries & Wages - Admin', 'Op. Summary', 'O22', 'C22', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:002:Employee Benefits',        'Op. Summary', 'O23', 'C23', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:003:Payroll Taxes',            'Op. Summary', 'O24', 'C24', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:004:Advertising - Gen & Inst', 'Op. Summary', 'O25', 'C25', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:005:Depreciation',             'Op. Summary', 'O26', 'C26', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:006:Data Processing',          'Op. Summary', 'O27', 'C27', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:007:Insurance/Legal',          'Op. Summary', 'O28', 'C28', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:008:Property Taxes',           'Op. Summary', 'O29', 'C29', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:009:Utilities',                'Op. Summary', 'O30', 'C30', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:010:Rent',                     'Op. Summary', 'O31', 'C31', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:011:Fuel/Company Vehicle',     'Op. Summary', 'O33', 'C33', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:012:Office Supplies',          'Op. Summary', 'O34', 'C34', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:013:Interest/Bank Charges',    'Op. Summary', 'O35', 'C35', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:014:Misc',                     'Op. Summary', 'O37', 'C37', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:015:Building Maint',           'Op. Summary', 'O38', 'C38', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:016:Telephone',                'Op. Summary', 'O39', 'C39', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:017:Travel/Training',          'Op. Summary', 'O40', 'C40', true, 'total_fixed_expense'),
  ('KTRV', 'New Vehicles', 'sub:total_fixed_expense:018:PRORATED EXPENSE',         'Op. Summary', 'O44', 'C44', true, 'total_fixed_expense');


-- ============================================================
-- 5. Add Sales Expense % Sub-Metrics (Page2, Column O, names Column D)
--    Values: O6, O7, O8, O9  Total: O10
-- ============================================================

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicles', 'sub:sales_expense_percent:001', 'Page2', 'O6', 'D6', true, 'sales_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense_percent:002', 'Page2', 'O7', 'D7', true, 'sales_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense_percent:003', 'Page2', 'O8', 'D8', true, 'sales_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:sales_expense_percent:004', 'Page2', 'O9', 'D9', true, 'sales_expense_percent');


-- ============================================================
-- 6. Add Semi-Fixed Expense % Sub-Metrics (Page2, Column O, names Column D)
--    Values: O12-O20  Total: O21
-- ============================================================

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:001', 'Page2', 'O12', 'D12', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:002', 'Page2', 'O13', 'D13', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:003', 'Page2', 'O14', 'D14', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:004', 'Page2', 'O15', 'D15', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:005', 'Page2', 'O16', 'D16', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:006', 'Page2', 'O17', 'D17', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:007', 'Page2', 'O18', 'D18', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:008', 'Page2', 'O19', 'D19', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'New Vehicles', 'sub:semi_fixed_expense_percent:009', 'Page2', 'O20', 'D20', true, 'semi_fixed_expense_percent');
