-- Remove placeholder/empty vehicle rows from Hyundai New Vehicles mappings
-- These are blank rows in the spreadsheet reserved for future models:
--   Rows 11-15 (car placeholders), 26-27 (truck placeholders), 36-37 (EV placeholders)
-- They import with names like "04", "05", "06" etc. (the order index) because col J is empty.
-- Also remove TBD rows (25, 35) which are always empty/zero.
-- ============================================================

-- Delete from cell mappings (both total_sales and gp_net sub-metrics)
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Hyundai'
  AND department_name = 'New Vehicles'
  AND sheet_name = 'Page4'
  AND is_sub_metric = true
  AND cell_reference IN (
    -- Car placeholders (rows 11-15): B/E 11-15
    'B11', 'B12', 'B13', 'B14', 'B15',
    'E11', 'E12', 'E13', 'E14', 'E15',
    -- Truck placeholders (rows 26-27): B/E 26-27
    'B26', 'B27',
    'E26', 'E27',
    -- EV placeholders (rows 36-37): B/E 36-37
    'B36', 'B37',
    'E36', 'E37',
    -- TBD rows (rows 25, 35): B/E 25, 35
    'B25', 'B35',
    'E25', 'E35'
  );

-- Clean up imported financial_entries that came from these placeholder rows.
-- They were imported with names like "04", "05", "06", "07", "08", "18", "19", "TBD"
-- under parent keys total_sales and gp_net for Hyundai New Vehicles.
DELETE FROM public.financial_entries
WHERE department_id IN (
  SELECT d.id FROM departments d
  JOIN stores s ON d.store_id = s.id
  WHERE s.brand = 'Hyundai' AND d.name = 'New Vehicles'
)
AND metric_name SIMILAR TO 'sub:(total_sales|gp_net):\d{3}:(04|05|06|07|08|18|19|TBD)'
AND metric_name LIKE 'sub:%';

-- Also clean up any units entries for these placeholder rows
DELETE FROM public.financial_entries
WHERE department_id IN (
  SELECT d.id FROM departments d
  JOIN stores s ON d.store_id = s.id
  WHERE s.brand = 'Hyundai' AND d.name = 'New Vehicles'
)
AND metric_name SIMILAR TO 'units:(total_sales|gp_net):\d{3}:(04|05|06|07|08|18|19|TBD)'
AND metric_name LIKE 'units:%';
