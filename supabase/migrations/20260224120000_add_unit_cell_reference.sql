-- Add unit_cell_reference column to financial_cell_mappings
-- This allows sub-metrics to also map a unit count cell from the spreadsheet
-- ============================================================

ALTER TABLE public.financial_cell_mappings
ADD COLUMN IF NOT EXISTS unit_cell_reference TEXT;

-- Nissan New Vehicles: unit counts are in Column B, rows 6-36 on Nissan4
-- The total_sales sub-metrics have cell_references like C6, C7, ... C36
-- Unit cell is B on the same row
UPDATE public.financial_cell_mappings
SET unit_cell_reference = 'B' || substring(cell_reference from '[0-9]+')
WHERE brand = 'Nissan'
  AND department_name = 'New Vehicles'
  AND parent_metric_key = 'total_sales'
  AND is_sub_metric = true
  AND CAST(substring(cell_reference from '[0-9]+') AS integer) BETWEEN 6 AND 36;

-- Nissan Used Vehicles: unit counts are in Column B, rows 42-52 on Nissan4
UPDATE public.financial_cell_mappings
SET unit_cell_reference = 'B' || substring(cell_reference from '[0-9]+')
WHERE brand = 'Nissan'
  AND department_name = 'Used Vehicles'
  AND parent_metric_key = 'total_sales'
  AND is_sub_metric = true
  AND CAST(substring(cell_reference from '[0-9]+') AS integer) BETWEEN 42 AND 52;
