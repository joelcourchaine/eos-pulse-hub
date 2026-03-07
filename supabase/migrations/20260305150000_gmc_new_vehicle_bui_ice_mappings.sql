-- GMC New Vehicles - Buick ICE Cell Mappings
-- ============================================================
-- Sheet: 'Page5 BUI ICE'
-- Rows 4-6 (3 items), Row 29 (1 item), Rows 31-34 (4 items)
-- Total: 8 items per parent metric
-- Names col C, Units col F, Sales col G, GP Net col I
-- Order indices continue from CHV EV (38+)
-- ============================================================

-- TOTAL SALES SUB-METRICS
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- Group 1: rows 4-6
('GMC', 'New Vehicles', 'sub:total_sales:38', 'Page5 BUI ICE', 'G4',  'C4',  'F4',  'total_sales', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:total_sales:39', 'Page5 BUI ICE', 'G5',  'C5',  'F5',  'total_sales', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:total_sales:40', 'Page5 BUI ICE', 'G6',  'C6',  'F6',  'total_sales', true, 'Buick'),
-- Group 2: row 29
('GMC', 'New Vehicles', 'sub:total_sales:41', 'Page5 BUI ICE', 'G29', 'C29', 'F29', 'total_sales', true, 'Buick'),
-- Group 3: rows 31-34
('GMC', 'New Vehicles', 'sub:total_sales:42', 'Page5 BUI ICE', 'G31', 'C31', 'F31', 'total_sales', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:total_sales:43', 'Page5 BUI ICE', 'G32', 'C32', 'F32', 'total_sales', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:total_sales:44', 'Page5 BUI ICE', 'G33', 'C33', 'F33', 'total_sales', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:total_sales:45', 'Page5 BUI ICE', 'G34', 'C34', 'F34', 'total_sales', true, 'Buick');

-- GP NET SUB-METRICS (same rows, col I values)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- Group 1: rows 4-6
('GMC', 'New Vehicles', 'sub:gp_net:38', 'Page5 BUI ICE', 'I4',  'C4',  'F4',  'gp_net', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:gp_net:39', 'Page5 BUI ICE', 'I5',  'C5',  'F5',  'gp_net', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:gp_net:40', 'Page5 BUI ICE', 'I6',  'C6',  'F6',  'gp_net', true, 'Buick'),
-- Group 2: row 29
('GMC', 'New Vehicles', 'sub:gp_net:41', 'Page5 BUI ICE', 'I29', 'C29', 'F29', 'gp_net', true, 'Buick'),
-- Group 3: rows 31-34
('GMC', 'New Vehicles', 'sub:gp_net:42', 'Page5 BUI ICE', 'I31', 'C31', 'F31', 'gp_net', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:gp_net:43', 'Page5 BUI ICE', 'I32', 'C32', 'F32', 'gp_net', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:gp_net:44', 'Page5 BUI ICE', 'I33', 'C33', 'F33', 'gp_net', true, 'Buick'),
('GMC', 'New Vehicles', 'sub:gp_net:45', 'Page5 BUI ICE', 'I34', 'C34', 'F34', 'gp_net', true, 'Buick');
