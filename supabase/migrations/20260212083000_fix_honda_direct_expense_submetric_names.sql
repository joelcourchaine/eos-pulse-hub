-- Fix Honda total_direct_expenses sub-metric names
-- Current metric_keys use snake_case (e.g. "office_supplies") which displays ugly
-- Update to new format with proper display names and add name_cell_reference
-- so the parser reads the exact name from the Honda spreadsheet

-- Delete ALL existing Honda total_direct_expenses sub-metrics for Parts and Service
DELETE FROM financial_cell_mappings
WHERE brand = 'Honda'
  AND is_sub_metric = true
  AND parent_metric_key = 'total_direct_expenses'
  AND department_name IN ('Parts', 'Service');

-- Re-insert Parts total_direct_expenses sub-metrics (column E values, column B names on Honda3)
-- Ordered by row number to preserve spreadsheet order
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('Honda', 'Parts', 'sub:total_direct_expenses:001:Office Supplies',                'Honda3', 'E30', 'B30', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:002:Shop Tools & Sundry Supplies',   'Honda3', 'E31', 'B31', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:003:Courtesy Vehicle',               'Honda3', 'E32', 'B32', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:004:Laundry & Uniforms',             'Honda3', 'E33', 'B33', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:005:Janitor Services & Cleaning',    'Honda3', 'E34', 'B34', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:006:Postage',                        'Honda3', 'E35', 'B35', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:007:Policy Adjustments',             'Honda3', 'E36', 'B36', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:008:Advertising',                    'Honda3', 'E37', 'B37', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:009:Co-op Advertising Rebate',       'Honda3', 'E38', 'B38', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:010:Donations',                      'Honda3', 'E39', 'B39', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:011:Company Vehicle',                'Honda3', 'E40', 'B40', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:012:Inventory Maintenance',          'Honda3', 'E41', 'B41', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:013:Data Processing',                'Honda3', 'E42', 'B42', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:014:Training',                       'Honda3', 'E43', 'B43', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:015:Travel & Entertainment',         'Honda3', 'E44', 'B44', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:016:Telephone & Fax',               'Honda3', 'E45', 'B45', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:017:Membership, Dues & Subscriptions', 'Honda3', 'E46', 'B46', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:018:Freight & Express',              'Honda3', 'E47', 'B47', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:019:Outside Services',               'Honda3', 'E48', 'B48', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:020:Audit, Legal & Collection',      'Honda3', 'E49', 'B49', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:021:Miscellaneous',                  'Honda3', 'E50', 'B50', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:022:Interest & Bank Charges',        'Honda3', 'E51', 'B51', true, 'total_direct_expenses'),
  ('Honda', 'Parts', 'sub:total_direct_expenses:023:Floor Plan Interest',            'Honda3', 'E52', 'B52', true, 'total_direct_expenses');

-- Re-insert Service total_direct_expenses sub-metrics (column J values, column B names on Honda3)
INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  ('Honda', 'Service', 'sub:total_direct_expenses:001:Office Supplies',                'Honda3', 'J30', 'B30', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:002:Shop Tools & Sundry Supplies',   'Honda3', 'J31', 'B31', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:003:Courtesy Vehicle',               'Honda3', 'J32', 'B32', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:004:Laundry & Uniforms',             'Honda3', 'J33', 'B33', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:005:Janitor Services & Cleaning',    'Honda3', 'J34', 'B34', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:006:Postage',                        'Honda3', 'J35', 'B35', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:007:Policy Adjustments',             'Honda3', 'J36', 'B36', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:008:Advertising',                    'Honda3', 'J37', 'B37', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:009:Co-op Advertising Rebate',       'Honda3', 'J38', 'B38', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:010:Donations',                      'Honda3', 'J39', 'B39', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:011:Company Vehicle',                'Honda3', 'J40', 'B40', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:012:Inventory Maintenance',          'Honda3', 'J41', 'B41', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:013:Data Processing',                'Honda3', 'J42', 'B42', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:014:Training',                       'Honda3', 'J43', 'B43', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:015:Travel & Entertainment',         'Honda3', 'J44', 'B44', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:016:Telephone & Fax',               'Honda3', 'J45', 'B45', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:017:Membership, Dues & Subscriptions', 'Honda3', 'J46', 'B46', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:018:Freight & Express',              'Honda3', 'J47', 'B47', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:019:Outside Services',               'Honda3', 'J48', 'B48', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:020:Audit, Legal & Collection',      'Honda3', 'J49', 'B49', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:021:Miscellaneous',                  'Honda3', 'J50', 'B50', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:022:Interest & Bank Charges',        'Honda3', 'J51', 'B51', true, 'total_direct_expenses'),
  ('Honda', 'Service', 'sub:total_direct_expenses:023:Floor Plan Interest',            'Honda3', 'J52', 'B52', true, 'total_direct_expenses');
