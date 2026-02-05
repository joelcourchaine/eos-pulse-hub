-- Fix Hyundai/Genesis expense sub-metric name column from B to C
UPDATE financial_cell_mappings
SET name_cell_reference = CONCAT('C', SUBSTRING(name_cell_reference FROM 2))
WHERE brand IN ('Hyundai', 'Genesis')
  AND metric_key LIKE 'sub:sales_expense:%'
  AND name_cell_reference LIKE 'B%';

UPDATE financial_cell_mappings
SET name_cell_reference = CONCAT('C', SUBSTRING(name_cell_reference FROM 2))
WHERE brand IN ('Hyundai', 'Genesis')
  AND metric_key LIKE 'sub:total_direct_expenses:%'
  AND name_cell_reference LIKE 'B%';