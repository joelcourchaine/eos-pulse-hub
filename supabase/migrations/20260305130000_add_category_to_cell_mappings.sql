-- Add category column to financial_cell_mappings
-- Used for GMC sub-brand filtering (Chevrolet, Buick, Cadillac, GMC, Fleet)
-- The dropdown in the financial summary lets users filter sub-metrics by category.
ALTER TABLE public.financial_cell_mappings
ADD COLUMN IF NOT EXISTS category TEXT;

-- Tag existing Chevrolet ICE sub-metrics
UPDATE public.financial_cell_mappings
SET category = 'Chevrolet'
WHERE brand = 'GMC'
  AND department_name = 'New Vehicles'
  AND is_sub_metric = true;
