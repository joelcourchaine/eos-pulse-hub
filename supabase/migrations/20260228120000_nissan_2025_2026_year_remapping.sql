-- Nissan 2025→2026 Financial Cell Mapping Remapping
-- ============================================================
-- 2026 Nissan spreadsheet changes:
--   Nissan2: Row 27 (DIGITAL ADVERTISING) removed, rows 28+ shift up by 1
--   Nissan3: Row 27 removed, rows 28+ shift up by 1
--   Nissan4: Row 27 now has data (was empty), rows 28-29 still empty, nothing else shifted
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 0: Clean slate — remove pre-existing 2026 Nissan mappings
-- (Earlier migration 20260210045329 partially created Nissan3 2026 records)
-- ============================================================
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND effective_year = 2026;

-- ============================================================
-- STEP 1: Tag all existing Nissan mappings as 2025
-- ============================================================
UPDATE public.financial_cell_mappings
SET effective_year = 2025
WHERE brand = 'Nissan' AND effective_year IS NULL;

-- ============================================================
-- STEP 2: Bulk copy all 2025 mappings → 2026
-- ============================================================
INSERT INTO public.financial_cell_mappings
  (brand, department_name, metric_key, sheet_name, cell_reference,
   name_cell_reference, parent_metric_key, is_sub_metric, effective_year, unit_cell_reference)
SELECT brand, department_name, metric_key, sheet_name, cell_reference,
   name_cell_reference, parent_metric_key, is_sub_metric, 2026, unit_cell_reference
FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND effective_year = 2025;

-- ============================================================
-- STEP 3: Nissan2 2026 adjustments
-- Row 27 (DIGITAL ADVERTISING) removed, rows 28+ shift up by 1
-- ============================================================

-- 3a. Delete total_direct_expenses_sub_7 (was row 27) for New & Used Vehicles
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND effective_year = 2026
  AND sheet_name = 'Nissan2'
  AND metric_key = 'total_direct_expenses_sub_7'
  AND department_name IN ('New Vehicles', 'Used Vehicles');

-- 3b. Shift all Nissan2 cell_reference where row >= 28 by -1
--     Also shift name_cell_reference where applicable
UPDATE public.financial_cell_mappings
SET
  cell_reference = substring(cell_reference from '^[A-Z]+') || (substring(cell_reference from '[0-9]+')::int - 1),
  name_cell_reference = CASE
    WHEN name_cell_reference IS NOT NULL
    THEN substring(name_cell_reference from '^[A-Z]+') || (substring(name_cell_reference from '[0-9]+')::int - 1)
    ELSE NULL
  END
WHERE brand = 'Nissan' AND effective_year = 2026
  AND sheet_name = 'Nissan2'
  AND substring(cell_reference from '[0-9]+')::int >= 28;

-- ============================================================
-- STEP 4: Nissan3 2026 adjustments
-- Row 27 removed, rows 28+ shift up by 1
-- ============================================================

-- 4a. Delete total_direct_expenses_sub_7 for Service & Parts Departments
DELETE FROM public.financial_cell_mappings
WHERE brand = 'Nissan' AND effective_year = 2026
  AND sheet_name = 'Nissan3'
  AND metric_key = 'total_direct_expenses_sub_7'
  AND department_name IN ('Service Department', 'Parts Department');

-- 4b. Shift all Nissan3 cell_reference where row >= 28 by -1
UPDATE public.financial_cell_mappings
SET
  cell_reference = substring(cell_reference from '^[A-Z]+') || (substring(cell_reference from '[0-9]+')::int - 1),
  name_cell_reference = CASE
    WHEN name_cell_reference IS NOT NULL
    THEN substring(name_cell_reference from '^[A-Z]+') || (substring(name_cell_reference from '[0-9]+')::int - 1)
    ELSE NULL
  END
WHERE brand = 'Nissan' AND effective_year = 2026
  AND sheet_name = 'Nissan3'
  AND substring(cell_reference from '[0-9]+')::int >= 28;

-- ============================================================
-- STEP 5: Nissan4 2026 addition
-- Row 27 now has data (was empty in 2025). Add new sub-metrics.
-- ============================================================

-- 5a. New Vehicle total_sales sub for row 27
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, effective_year, unit_cell_reference)
VALUES
('Nissan', 'New Vehicles', 'total_sales_sub_31', 'Nissan4', 'C27', 'G27', 'total_sales', true, 2026, 'B27');

-- 5b. New Vehicle gp_net sub for row 27
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, effective_year)
VALUES
('Nissan', 'New Vehicles', 'gp_net_sub_31', 'Nissan4', 'D27', 'G27', 'gp_net', true, 2026);

-- 5c. New Vehicle gp_percent sub for row 27
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric, effective_year)
VALUES
('Nissan', 'New Vehicles', 'gp_percent_sub_31', 'Nissan4', 'E27', 'G27', 'gp_percent', true, 2026);

-- ============================================================
-- STEP 6: Remap specific cells that moved to "Stats" sheet in 2026
-- ============================================================

-- 6a. Service Department: Nissan3 D26 → Stats I234
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'I234', name_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'Service Department'
  AND metric_key = 'total_direct_expenses_sub_6'
  AND sheet_name = 'Nissan3';

-- 6b. Parts Department: Nissan3 H26 → Stats K234
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'K234', name_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'Parts Department'
  AND metric_key = 'total_direct_expenses_sub_6'
  AND sheet_name = 'Nissan3';

-- 6c. Used Vehicles: Nissan2 L26 → Stats E234
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'E234', name_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'Used Vehicles'
  AND metric_key = 'total_direct_expenses_sub_6'
  AND sheet_name = 'Nissan2';

-- 6d. New Vehicles: Nissan2 H26 → Stats C234
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'C234', name_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'New Vehicles'
  AND metric_key = 'total_direct_expenses_sub_6'
  AND sheet_name = 'Nissan2';

-- 6e. New Vehicles: Nissan4 C35 → Stats D55
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'D55', name_cell_reference = NULL, unit_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'New Vehicles'
  AND metric_key = 'total_sales_sub_26'
  AND sheet_name = 'Nissan4';

-- 6f. Body Shop Department: Nissan3 L26 → Stats M234
UPDATE public.financial_cell_mappings
SET sheet_name = 'Stats', cell_reference = 'M234', name_cell_reference = NULL
WHERE brand = 'Nissan' AND effective_year = 2026
  AND department_name = 'Body Shop Department'
  AND metric_key = 'total_direct_expenses_sub_6'
  AND sheet_name = 'Nissan3';

COMMIT;
