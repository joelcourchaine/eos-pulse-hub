-- Cleanup duplicate Nissan financial_cell_mappings
-- Fixes: duplicate parent rows, duplicate sub-metric sets (old format)

-- ============================================================
-- 1. Delete wrong total_direct_expenses parents (D37 / H37)
--    Correct parents are D38 (Service) and H38 (Parts)
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND department_name = 'Service Department'
  AND metric_key = 'total_direct_expenses' AND is_sub_metric = false
  AND cell_reference = 'D37';

DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND department_name = 'Parts Department'
  AND metric_key = 'total_direct_expenses' AND is_sub_metric = false
  AND cell_reference = 'H37';

-- ============================================================
-- 2. Delete wrong total_fixed_expense parents (D60 / H60)
--    Correct parents are D61 (Service) and H61 (Parts)
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND department_name = 'Service Department'
  AND metric_key = 'total_fixed_expense' AND is_sub_metric = false
  AND cell_reference = 'D60';

DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND department_name = 'Parts Department'
  AND metric_key = 'total_fixed_expense' AND is_sub_metric = false
  AND cell_reference = 'H60';

-- ============================================================
-- 3. Delete old-format sub:total_direct_expenses:* rows
--    (duplicated with off-by-one cell refs)
--    Keeps the clean total_direct_expenses_sub_N rows
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan'
  AND metric_key LIKE 'sub:total_direct_expenses:%'
  AND department_name IN ('Service Department', 'Parts Department', 'Body Shop Department');
