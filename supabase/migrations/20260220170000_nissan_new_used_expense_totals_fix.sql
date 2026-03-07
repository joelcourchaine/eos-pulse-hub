-- Fix Nissan New/Used Vehicle expense total mappings
-- total_fixed_expense: H61/L61 -> H63/L63
-- Add new metric: total_direct_indirect_expenses at H62/L62

-- ============================================================
-- 1. Update total_fixed_expense: H61 -> H63, L61 -> L63
-- ============================================================
UPDATE public.financial_cell_mappings
SET cell_reference = 'H63'
WHERE brand = 'Nissan' AND department_name = 'New Vehicles'
  AND metric_key = 'total_fixed_expense' AND cell_reference = 'H61';

UPDATE public.financial_cell_mappings
SET cell_reference = 'L63'
WHERE brand = 'Nissan' AND department_name = 'Used Vehicles'
  AND metric_key = 'total_fixed_expense' AND cell_reference = 'L61';

-- ============================================================
-- 2. Add Total Direct & Indirect Expenses (H62 / L62)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, is_sub_metric)
VALUES
('Nissan', 'New Vehicles', 'total_direct_indirect_expenses', 'Nissan2', 'H62', false),
('Nissan', 'Used Vehicles', 'total_direct_indirect_expenses', 'Nissan2', 'L62', false);
