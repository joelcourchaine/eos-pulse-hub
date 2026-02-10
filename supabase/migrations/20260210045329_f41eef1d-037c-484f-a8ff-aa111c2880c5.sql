
-- Step 1: Delete ALL incorrect 2026 mappings from previous migration
DELETE FROM financial_cell_mappings
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3' AND effective_year = 2026;

-- Step 2: Mark DIGITAL ADVERTISING (006) as 2025-only (removed in 2026)
UPDATE financial_cell_mappings
SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND metric_key LIKE '%006:%'
  AND effective_year IS NULL;

-- Step 3: Mark any remaining universal mappings with row >= 28 as 2025-only
-- (this catches 007, 008, 009 which were still universal)
UPDATE financial_cell_mappings
SET effective_year = 2025
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND effective_year IS NULL
  AND substring(cell_reference from '[0-9]+')::int >= 28;

-- Step 4: Create correct 2026 mappings by copying 2025 rows (row >= 28) shifted -1
INSERT INTO financial_cell_mappings (brand, sheet_name, department_name, metric_key, cell_reference, is_sub_metric, parent_metric_key, name_cell_reference, effective_year)
SELECT 
  brand, sheet_name, department_name, metric_key,
  substring(cell_reference from '^[A-Z]+') || (substring(cell_reference from '[0-9]+')::int - 1)::text,
  is_sub_metric, parent_metric_key,
  CASE WHEN name_cell_reference IS NOT NULL 
    THEN substring(name_cell_reference from '^[A-Z]+') || (substring(name_cell_reference from '[0-9]+')::int - 1)::text
    ELSE NULL
  END,
  2026
FROM financial_cell_mappings
WHERE brand = 'Nissan' AND sheet_name = 'Nissan3'
  AND effective_year = 2025
  AND substring(cell_reference from '[0-9]+')::int >= 28;
