-- Set category = 'Chevrolet' on CHV ICE sub-metrics that currently have NULL category
-- These are the original Page5 CHV ICE sub-metrics (order indices 00-30)
-- so they appear when the Chevrolet brand filter is selected.

UPDATE public.financial_cell_mappings
SET category = 'Chevrolet'
WHERE brand = 'GMC'
  AND department_name = 'New Vehicles'
  AND sheet_name = 'Page5 CHV ICE'
  AND is_sub_metric = true
  AND category IS NULL;
