-- KTRV Used Vehicles Department financial cell mappings
-- Total Sales/GP from Page3, Sales/Semi-Fixed from Page2, Fixed Expense from Op. Summary

-- =============================================================
-- PARENT METRICS
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'total_sales',         'Page3',       'D54',  false, NULL),
  ('KTRV', 'Used Vehicles', 'gp_net',              'Page3',       'F54',  false, NULL),
  ('KTRV', 'Used Vehicles', 'sales_expense',       'Page2',       'N28',  false, NULL),
  ('KTRV', 'Used Vehicles', 'semi_fixed_expense',  'Page2',       'N38',  false, NULL),
  ('KTRV', 'Used Vehicles', 'net_selling_gross',   'Op. Summary', 'R13',  false, NULL),
  ('KTRV', 'Used Vehicles', 'total_fixed_expense', 'Op. Summary', 'R45',  false, NULL),
  ('KTRV', 'Used Vehicles', 'department_profit',   'Op. Summary', 'R46',  false, NULL);


-- =============================================================
-- TOTAL SALES SUB-METRICS (Page3, Column D, names in L or K)
-- Rows 39-51, skipping 44 (gap) and 47 (blank sales)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:total_sales:001', 'Page3', 'D39', 'L39', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:002', 'Page3', 'D40', 'L40', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:003', 'Page3', 'D41', 'L41', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:004', 'Page3', 'D42', 'K42', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:005', 'Page3', 'D43', 'L43', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:006', 'Page3', 'D45', 'K45', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:007', 'Page3', 'D46', 'K46', true, 'total_sales'),
  -- D47 is blank (no sales), skip for total_sales
  ('KTRV', 'Used Vehicles', 'sub:total_sales:008', 'Page3', 'D48', 'K48', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:009', 'Page3', 'D49', 'K49', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:010', 'Page3', 'D50', 'K50', true, 'total_sales'),
  ('KTRV', 'Used Vehicles', 'sub:total_sales:011', 'Page3', 'D51', 'K51', true, 'total_sales');
  -- D52 is blank (no sales), skip for total_sales


-- =============================================================
-- GP NET SUB-METRICS (Page3, Column F, names in L or K)
-- Same rows as total_sales PLUS F47 and F52 (GP only, no sales)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:gp_net:001', 'Page3', 'F39', 'L39', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:002', 'Page3', 'F40', 'L40', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:003', 'Page3', 'F41', 'L41', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:004', 'Page3', 'F42', 'K42', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:005', 'Page3', 'F43', 'L43', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:006', 'Page3', 'F45', 'K45', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:007', 'Page3', 'F46', 'K46', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:008', 'Page3', 'F47', 'K47', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:009', 'Page3', 'F48', 'K48', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:010', 'Page3', 'F49', 'K49', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:011', 'Page3', 'F50', 'K50', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:012', 'Page3', 'F51', 'K51', true, 'gp_net'),
  ('KTRV', 'Used Vehicles', 'sub:gp_net:013', 'Page3', 'F52', 'K52', true, 'gp_net');


-- =============================================================
-- SALES EXPENSE SUB-METRICS (Page2, Column N, names Column D)
-- Values: N24-N27, Total: N28
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:sales_expense:001', 'Page2', 'N24', 'D24', true, 'sales_expense'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense:002', 'Page2', 'N25', 'D25', true, 'sales_expense'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense:003', 'Page2', 'N26', 'D26', true, 'sales_expense'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense:004', 'Page2', 'N27', 'D27', true, 'sales_expense');


-- =============================================================
-- SALES EXPENSE % SUB-METRICS (Page2, Column O, names Column D)
-- Values: O24-O27, Total: O28
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:sales_expense_percent:001', 'Page2', 'O24', 'D24', true, 'sales_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense_percent:002', 'Page2', 'O25', 'D25', true, 'sales_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense_percent:003', 'Page2', 'O26', 'D26', true, 'sales_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:sales_expense_percent:004', 'Page2', 'O27', 'D27', true, 'sales_expense_percent');


-- =============================================================
-- SEMI-FIXED EXPENSE SUB-METRICS (Page2, Column N, names Column D)
-- Values: N30-N37, Total: N38
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:001', 'Page2', 'N30', 'D30', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:002', 'Page2', 'N31', 'D31', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:003', 'Page2', 'N32', 'D32', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:004', 'Page2', 'N33', 'D33', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:005', 'Page2', 'N34', 'D34', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:006', 'Page2', 'N35', 'D35', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:007', 'Page2', 'N36', 'D36', true, 'semi_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense:008', 'Page2', 'N37', 'D37', true, 'semi_fixed_expense');


-- =============================================================
-- SEMI-FIXED EXPENSE % SUB-METRICS (Page2, Column O, names Column D)
-- Values: O30-O37, Total: O38
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:001', 'Page2', 'O30', 'D30', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:002', 'Page2', 'O31', 'D31', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:003', 'Page2', 'O32', 'D32', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:004', 'Page2', 'O33', 'D33', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:005', 'Page2', 'O34', 'D34', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:006', 'Page2', 'O35', 'D35', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:007', 'Page2', 'O36', 'D36', true, 'semi_fixed_expense_percent'),
  ('KTRV', 'Used Vehicles', 'sub:semi_fixed_expense_percent:008', 'Page2', 'O37', 'D37', true, 'semi_fixed_expense_percent');


-- =============================================================
-- TOTAL FIXED EXPENSE SUB-METRICS (Op. Summary, Column R, names Column C)
-- Same row layout as other departments, with embedded names
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:001:Salaries & Wages - Admin', 'Op. Summary', 'R22', 'C22', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:002:Employee Benefits',        'Op. Summary', 'R23', 'C23', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:003:Payroll Taxes',            'Op. Summary', 'R24', 'C24', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:004:Advertising - Gen & Inst', 'Op. Summary', 'R25', 'C25', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:005:Depreciation',             'Op. Summary', 'R26', 'C26', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:006:Data Processing',          'Op. Summary', 'R27', 'C27', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:007:Insurance/Legal',          'Op. Summary', 'R28', 'C28', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:008:Property Taxes',           'Op. Summary', 'R29', 'C29', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:009:Utilities',                'Op. Summary', 'R30', 'C30', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:010:Rent',                     'Op. Summary', 'R31', 'C31', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:011:Fuel/Company Vehicle',     'Op. Summary', 'R33', 'C33', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:012:Office Supplies',          'Op. Summary', 'R34', 'C34', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:013:Interest/Bank Charges',    'Op. Summary', 'R35', 'C35', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:014:Misc',                     'Op. Summary', 'R37', 'C37', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:015:Building Maint',           'Op. Summary', 'R38', 'C38', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:016:Telephone',                'Op. Summary', 'R39', 'C39', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:017:Travel/Training',          'Op. Summary', 'R40', 'C40', true, 'total_fixed_expense'),
  ('KTRV', 'Used Vehicles', 'sub:total_fixed_expense:018:PRORATED EXPENSE',         'Op. Summary', 'R44', 'C44', true, 'total_fixed_expense');
