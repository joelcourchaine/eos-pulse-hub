-- Fix Honda sales_expense sub-metric mappings
-- Remove salaries_dept_managers and salaries_owners (no longer in Honda spreadsheet)
-- Keep and rename the 3 correct sub-metrics: Salaries-Other (row 25), Absentee & Vacation Pay (row 26), Employee Benefits (row 27)

-- Delete ALL existing Honda sales_expense sub-metrics for Parts and Service
DELETE FROM financial_cell_mappings
WHERE brand = 'Honda'
  AND is_sub_metric = true
  AND parent_metric_key = 'sales_expense'
  AND department_name IN ('Parts', 'Service');

-- Re-insert correct mappings for Parts (column E on Honda3)
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('Honda', 'Parts', 'sub:sales_expense:001:Salaries-Other', 'Honda3', 'E25', true, 'sales_expense'),
  ('Honda', 'Parts', 'sub:sales_expense:002:Absentee & Vacation Pay', 'Honda3', 'E26', true, 'sales_expense'),
  ('Honda', 'Parts', 'sub:sales_expense:003:Employee Benefits', 'Honda3', 'E27', true, 'sales_expense');

-- Re-insert correct mappings for Service (column J on Honda3)
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('Honda', 'Service', 'sub:sales_expense:001:Salaries-Other', 'Honda3', 'J25', true, 'sales_expense'),
  ('Honda', 'Service', 'sub:sales_expense:002:Absentee & Vacation Pay', 'Honda3', 'J26', true, 'sales_expense'),
  ('Honda', 'Service', 'sub:sales_expense:003:Employee Benefits', 'Honda3', 'J27', true, 'sales_expense');
