-- KTRV financial cell mappings for Service and Parts departments
-- All data is on Page4 of the KTRV Excel file
-- Names are read from column Q via name_cell_reference

-- =============================================================
-- SERVICE DEPARTMENT (Mechanical Department on Page4)
-- Parent metrics
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'total_sales',  'Page4', 'H18', false, NULL),
  ('KTRV', 'Service Department', 'gp_net',       'Page4', 'L18', false, NULL),
  ('KTRV', 'Service Department', 'gp_percent',   'Page4', 'P18', false, NULL);

-- =============================================================
-- SERVICE DEPARTMENT - Total Sales sub-metrics (H8:H15, names Q8:Q15)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sub:total_sales:001:CUSTOMER PAID LABOUR',  'Page4', 'H8',  'Q8',  true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:002:INSURANCE PAID LABOUR', 'Page4', 'H9',  'Q9',  true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:003:WARRANTY PAID LABOUR',  'Page4', 'H10', 'Q10', true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:004:INTERNAL LABOUR',       'Page4', 'H11', 'Q11', true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:005:LABOUR SOLD WITH UNIT', 'Page4', 'H12', 'Q12', true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:006:UNAPPLIED TIME',        'Page4', 'H13', 'Q13', true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:007:SUBLET',                'Page4', 'H14', 'Q14', true, 'total_sales'),
  ('KTRV', 'Service Department', 'sub:total_sales:008:UNIT PREP',             'Page4', 'H15', 'Q15', true, 'total_sales');

-- =============================================================
-- SERVICE DEPARTMENT - GP Net sub-metrics (L8:L15, names Q8:Q15)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sub:gp_net:001:CUSTOMER PAID LABOUR',  'Page4', 'L8',  'Q8',  true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:002:INSURANCE PAID LABOUR', 'Page4', 'L9',  'Q9',  true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:003:WARRANTY PAID LABOUR',  'Page4', 'L10', 'Q10', true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:004:INTERNAL LABOUR',       'Page4', 'L11', 'Q11', true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:005:LABOUR SOLD WITH UNIT', 'Page4', 'L12', 'Q12', true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:006:UNAPPLIED TIME',        'Page4', 'L13', 'Q13', true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:007:SUBLET',                'Page4', 'L14', 'Q14', true, 'gp_net'),
  ('KTRV', 'Service Department', 'sub:gp_net:008:UNIT PREP',             'Page4', 'L15', 'Q15', true, 'gp_net');

-- =============================================================
-- SERVICE DEPARTMENT - GP % sub-metrics (P8:P15, names Q8:Q15)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sub:gp_percent:001:CUSTOMER PAID LABOUR',  'Page4', 'P8',  'Q8',  true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:002:INSURANCE PAID LABOUR', 'Page4', 'P9',  'Q9',  true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:003:WARRANTY PAID LABOUR',  'Page4', 'P10', 'Q10', true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:004:INTERNAL LABOUR',       'Page4', 'P11', 'Q11', true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:005:LABOUR SOLD WITH UNIT', 'Page4', 'P12', 'Q12', true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:006:UNAPPLIED TIME',        'Page4', 'P13', 'Q13', true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:007:SUBLET',                'Page4', 'P14', 'Q14', true, 'gp_percent'),
  ('KTRV', 'Service Department', 'sub:gp_percent:008:UNIT PREP',             'Page4', 'P15', 'Q15', true, 'gp_percent');

-- =============================================================
-- PARTS DEPARTMENT
-- Parent metrics
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'total_sales',  'Page4', 'H41', false, NULL),
  ('KTRV', 'Parts Department', 'gp_net',       'Page4', 'L41', false, NULL),
  ('KTRV', 'Parts Department', 'gp_percent',   'Page4', 'P41', false, NULL);

-- =============================================================
-- PARTS DEPARTMENT - Total Sales sub-metrics
-- SUM(H27:H35,H39:H40) = 11 sub-metrics (rows 36,38 excluded from sales)
-- Names from column Q
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sub:total_sales:001:P & A COUNTER',                 'Page4', 'H27', 'Q27', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:002:P & A WHOLESALE',               'Page4', 'H28', 'Q28', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:003:P & A CUSTOMER SHOP INSTALLED', 'Page4', 'H29', 'Q29', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:004:P & A SOLD WITH UNITS',         'Page4', 'H30', 'Q30', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:005:P & A INSURANCE',               'Page4', 'H31', 'Q31', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:006:P & A WARRANTY',                'Page4', 'H32', 'Q32', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:007:P & A INTERNAL',                'Page4', 'H33', 'Q33', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:008:P & A ACCESSORY - PARTS',       'Page4', 'H34', 'Q34', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:009:P & A ACCESSORY - LABOUR',      'Page4', 'H35', 'Q35', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:010:P & A SUBLET',                  'Page4', 'H39', 'Q39', true, 'total_sales'),
  ('KTRV', 'Parts Department', 'sub:total_sales:011:NON-AUTO & MISCELLANEOUS',      'Page4', 'H40', 'Q40', true, 'total_sales');

-- =============================================================
-- PARTS DEPARTMENT - GP Net sub-metrics
-- SUM(L27:L40) = all rows including purchase discounts & inventory adj
-- Rows 36 and 38 affect GP but not Total Sales
-- Row 37 is blank (skipped)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sub:gp_net:001:P & A COUNTER',                 'Page4', 'L27', 'Q27', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:002:P & A WHOLESALE',               'Page4', 'L28', 'Q28', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:003:P & A CUSTOMER SHOP INSTALLED', 'Page4', 'L29', 'Q29', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:004:P & A SOLD WITH UNITS',         'Page4', 'L30', 'Q30', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:005:P & A INSURANCE',               'Page4', 'L31', 'Q31', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:006:P & A WARRANTY',                'Page4', 'L32', 'Q32', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:007:P & A INTERNAL',                'Page4', 'L33', 'Q33', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:008:P & A ACCESSORY - PARTS',       'Page4', 'L34', 'Q34', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:009:P & A ACCESSORY - LABOUR',      'Page4', 'L35', 'Q35', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:010:PURCHASE DISCOUNTS - P & A',    'Page4', 'L36', 'Q36', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:011:P & A INVENTORY ADJUSTMENTS',   'Page4', 'L38', 'Q38', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:012:P & A SUBLET',                  'Page4', 'L39', 'Q39', true, 'gp_net'),
  ('KTRV', 'Parts Department', 'sub:gp_net:013:NON-AUTO & MISCELLANEOUS',      'Page4', 'L40', 'Q40', true, 'gp_net');

-- =============================================================
-- PARTS DEPARTMENT - GP % sub-metrics (same rows as GP Net)
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sub:gp_percent:001:P & A COUNTER',                 'Page4', 'P27', 'Q27', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:002:P & A WHOLESALE',               'Page4', 'P28', 'Q28', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:003:P & A CUSTOMER SHOP INSTALLED', 'Page4', 'P29', 'Q29', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:004:P & A SOLD WITH UNITS',         'Page4', 'P30', 'Q30', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:005:P & A INSURANCE',               'Page4', 'P31', 'Q31', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:006:P & A WARRANTY',                'Page4', 'P32', 'Q32', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:007:P & A INTERNAL',                'Page4', 'P33', 'Q33', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:008:P & A ACCESSORY - PARTS',       'Page4', 'P34', 'Q34', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:009:P & A ACCESSORY - LABOUR',      'Page4', 'P35', 'Q35', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:010:PURCHASE DISCOUNTS - P & A',    'Page4', 'P36', 'Q36', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:011:P & A INVENTORY ADJUSTMENTS',   'Page4', 'P38', 'Q38', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:012:P & A SUBLET',                  'Page4', 'P39', 'Q39', true, 'gp_percent'),
  ('KTRV', 'Parts Department', 'sub:gp_percent:013:NON-AUTO & MISCELLANEOUS',      'Page4', 'P40', 'Q40', true, 'gp_percent');

-- =============================================================
-- SERVICE DEPARTMENT - Sales Expense (Page2)
-- Parent: N51, sub-metrics N43:N50, names D43:D50
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sales_expense', 'Page2', 'N51', false, NULL);

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sub:sales_expense:001', 'Page2', 'N43', 'D43', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:002', 'Page2', 'N44', 'D44', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:003', 'Page2', 'N45', 'D45', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:004', 'Page2', 'N46', 'D46', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:005', 'Page2', 'N47', 'D47', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:006', 'Page2', 'N48', 'D48', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:007', 'Page2', 'N49', 'D49', true, 'sales_expense'),
  ('KTRV', 'Service Department', 'sub:sales_expense:008', 'Page2', 'N50', 'D50', true, 'sales_expense');

-- =============================================================
-- PARTS DEPARTMENT - Sales Expense (Page2)
-- Parent: N62, sub-metrics N54:N61, names D54:D61
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sales_expense', 'Page2', 'N62', false, NULL);

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sub:sales_expense:001', 'Page2', 'N54', 'D54', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:002', 'Page2', 'N55', 'D55', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:003', 'Page2', 'N56', 'D56', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:004', 'Page2', 'N57', 'D57', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:005', 'Page2', 'N58', 'D58', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:006', 'Page2', 'N59', 'D59', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:007', 'Page2', 'N60', 'D60', true, 'sales_expense'),
  ('KTRV', 'Parts Department', 'sub:sales_expense:008', 'Page2', 'N61', 'D61', true, 'sales_expense');

-- =============================================================
-- SERVICE DEPARTMENT - Net Selling Gross (Page2)
-- Direct value, not calculated
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'net_selling_gross', 'Page2', 'N52', false, NULL);

-- =============================================================
-- SERVICE DEPARTMENT - Total Fixed Expense (Op. Summary)
-- Parent: T45, sub-metrics T22:T40 + T43, names C22:C40 + C43
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'total_fixed_expense', 'Op. Summary', 'T45', false, NULL);

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:001', 'Op. Summary', 'T22', 'C22', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:002', 'Op. Summary', 'T23', 'C23', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:003', 'Op. Summary', 'T24', 'C24', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:004', 'Op. Summary', 'T25', 'C25', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:005', 'Op. Summary', 'T26', 'C26', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:006', 'Op. Summary', 'T27', 'C27', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:007', 'Op. Summary', 'T28', 'C28', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:008', 'Op. Summary', 'T29', 'C29', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:009', 'Op. Summary', 'T30', 'C30', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:010', 'Op. Summary', 'T31', 'C31', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:011', 'Op. Summary', 'T32', 'C32', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:012', 'Op. Summary', 'T33', 'C33', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:013', 'Op. Summary', 'T34', 'C34', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:014', 'Op. Summary', 'T35', 'C35', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:015', 'Op. Summary', 'T36', 'C36', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:016', 'Op. Summary', 'T37', 'C37', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:017', 'Op. Summary', 'T38', 'C38', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:018', 'Op. Summary', 'T39', 'C39', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:019', 'Op. Summary', 'T40', 'C40', true, 'total_fixed_expense'),
  ('KTRV', 'Service Department', 'sub:total_fixed_expense:020', 'Op. Summary', 'T43', 'C43', true, 'total_fixed_expense');

-- =============================================================
-- PARTS DEPARTMENT - Total Fixed Expense (Op. Summary)
-- Parent: X45, sub-metrics X22:X40 + X43, names C22:C40 + C43
-- =============================================================
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'total_fixed_expense', 'Op. Summary', 'X45', false, NULL);

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:001', 'Op. Summary', 'X22', 'C22', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:002', 'Op. Summary', 'X23', 'C23', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:003', 'Op. Summary', 'X24', 'C24', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:004', 'Op. Summary', 'X25', 'C25', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:005', 'Op. Summary', 'X26', 'C26', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:006', 'Op. Summary', 'X27', 'C27', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:007', 'Op. Summary', 'X28', 'C28', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:008', 'Op. Summary', 'X29', 'C29', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:009', 'Op. Summary', 'X30', 'C30', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:010', 'Op. Summary', 'X31', 'C31', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:011', 'Op. Summary', 'X32', 'C32', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:012', 'Op. Summary', 'X33', 'C33', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:013', 'Op. Summary', 'X34', 'C34', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:014', 'Op. Summary', 'X35', 'C35', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:015', 'Op. Summary', 'X36', 'C36', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:016', 'Op. Summary', 'X37', 'C37', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:017', 'Op. Summary', 'X38', 'C38', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:018', 'Op. Summary', 'X39', 'C39', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:019', 'Op. Summary', 'X40', 'C40', true, 'total_fixed_expense'),
  ('KTRV', 'Parts Department', 'sub:total_fixed_expense:020', 'Op. Summary', 'X43', 'C43', true, 'total_fixed_expense');
