-- Fix KTRV New Vehicle Department mappings
-- 1. Department name is "New Vehicles" not "New Vehicle Department"
-- 2. Remove O21 row (doesn't exist on Op. Summary for this dept)
-- 3. Fix prorated expense name at C43 (cell is empty, embed name)
-- 4. Fix parent total_sales from D35 to D36
-- 5. Fix GP Net from Page2/N4 to Page3/F36
-- 6. Fix all total_sales sub-metrics (wrong rows and name columns)

-- 1. Fix department name
UPDATE financial_cell_mappings
SET department_name = 'New Vehicles'
WHERE brand = 'KTRV' AND department_name = 'New Vehicle Department';

-- 2. Remove non-existent O21 mapping
DELETE FROM financial_cell_mappings
WHERE brand = 'KTRV'
  AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_fixed_expense:001'
  AND cell_reference = 'O21';

-- 3. Fix prorated expense name (C43 is empty on spreadsheet)
-- Also fix for Service and Parts departments (same C43 issue)
UPDATE financial_cell_mappings
SET metric_key = 'sub:total_fixed_expense:020:PRORATED EXPENSE'
WHERE brand = 'KTRV'
  AND metric_key = 'sub:total_fixed_expense:020'
  AND cell_reference IN ('T43', 'X43', 'O43');

-- 4. Fix parent total_sales: D35 -> D36
UPDATE financial_cell_mappings
SET cell_reference = 'D36'
WHERE brand = 'KTRV'
  AND department_name = 'New Vehicles'
  AND metric_key = 'total_sales'
  AND cell_reference = 'D35';

-- 5. Fix GP Net: Page2/N4 -> Page3/F36
UPDATE financial_cell_mappings
SET sheet_name = 'Page3', cell_reference = 'F36'
WHERE brand = 'KTRV'
  AND department_name = 'New Vehicles'
  AND metric_key = 'gp_net'
  AND cell_reference = 'N4';

-- 6. Delete all incorrect total_sales sub-metrics for New Vehicles
DELETE FROM financial_cell_mappings
WHERE brand = 'KTRV'
  AND department_name = 'New Vehicles'
  AND is_sub_metric = true
  AND parent_metric_key = 'total_sales';

-- 7. Re-insert correct total_sales sub-metrics
-- All values in Column D, all names in Column L on Page3
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  -- Vehicle Sales
  ('KTRV', 'New Vehicles', 'sub:total_sales:001', 'Page3', 'D6',  'L6',  true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:002', 'Page3', 'D8',  'L8',  true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:003', 'Page3', 'D10', 'L10', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:004', 'Page3', 'D12', 'L12', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:005', 'Page3', 'D14', 'L14', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:006', 'Page3', 'D16', 'L16', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:007', 'Page3', 'D18', 'L18', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:008', 'Page3', 'D20', 'L20', true, 'total_sales'),
  -- F&I Sales (D29 and D34 have GP only, no sales - will show 0)
  ('KTRV', 'New Vehicles', 'sub:total_sales:009', 'Page3', 'D28', 'L28', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:010', 'Page3', 'D29', 'L29', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:011', 'Page3', 'D30', 'L30', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:012', 'Page3', 'D31', 'L31', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:013', 'Page3', 'D32', 'L32', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:014', 'Page3', 'D33', 'L33', true, 'total_sales'),
  ('KTRV', 'New Vehicles', 'sub:total_sales:015', 'Page3', 'D35', 'L35', true, 'total_sales');
