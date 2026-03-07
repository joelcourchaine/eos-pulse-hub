-- GMC New Vehicles Financial Cell Mappings
-- ============================================================
-- Sheet: 'Page5 CHV ICE'
-- Parent metrics: total_sales (G51), gp_net (I51)
-- Units: col F on same sheet (F51 = total, F4-F43 = per line item)
-- Sub-metrics grouped by row ranges on same sheet:
--   Group 1: rows 4-10  (7 items)
--   Group 2: rows 14-15 (2 items)
--   Group 3a: rows 22-29 (8 items) — separate section
--   Group 3b: rows 30-43 (14 items)
-- Total: 31 sub-metrics per parent
-- ============================================================

-- ============================================================
-- PARENT METRICS
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, unit_cell_reference, is_sub_metric)
VALUES
('GMC', 'New Vehicles', 'total_sales', 'Page5 CHV ICE', 'G51', 'F51', false),
('GMC', 'New Vehicles', 'gp_net', 'Page5 CHV ICE', 'I51', 'F51', false);

-- ============================================================
-- TOTAL SALES SUB-METRICS (col G values, col C names, col F units)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Group 1: rows 4-10
('GMC', 'New Vehicles', 'sub:total_sales:00', 'Page5 CHV ICE', 'G4',  'C4',  'F4',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:01', 'Page5 CHV ICE', 'G5',  'C5',  'F5',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:02', 'Page5 CHV ICE', 'G6',  'C6',  'F6',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:03', 'Page5 CHV ICE', 'G7',  'C7',  'F7',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:04', 'Page5 CHV ICE', 'G8',  'C8',  'F8',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:05', 'Page5 CHV ICE', 'G9',  'C9',  'F9',  'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:06', 'Page5 CHV ICE', 'G10', 'C10', 'F10', 'total_sales', true),
-- Group 2: rows 14-15
('GMC', 'New Vehicles', 'sub:total_sales:07', 'Page5 CHV ICE', 'G14', 'C14', 'F14', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:08', 'Page5 CHV ICE', 'G15', 'C15', 'F15', 'total_sales', true),
-- Group 3a: rows 22-29 (separate section)
('GMC', 'New Vehicles', 'sub:total_sales:09', 'Page5 CHV ICE', 'G22', 'C22', 'F22', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:10', 'Page5 CHV ICE', 'G23', 'C23', 'F23', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:11', 'Page5 CHV ICE', 'G24', 'C24', 'F24', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:12', 'Page5 CHV ICE', 'G25', 'C25', 'F25', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:13', 'Page5 CHV ICE', 'G26', 'C26', 'F26', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:14', 'Page5 CHV ICE', 'G27', 'C27', 'F27', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:15', 'Page5 CHV ICE', 'G28', 'C28', 'F28', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:16', 'Page5 CHV ICE', 'G29', 'C29', 'F29', 'total_sales', true),
-- Group 3b: rows 30-43
('GMC', 'New Vehicles', 'sub:total_sales:17', 'Page5 CHV ICE', 'G30', 'C30', 'F30', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:18', 'Page5 CHV ICE', 'G31', 'C31', 'F31', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:19', 'Page5 CHV ICE', 'G32', 'C32', 'F32', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:20', 'Page5 CHV ICE', 'G33', 'C33', 'F33', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:21', 'Page5 CHV ICE', 'G34', 'C34', 'F34', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:22', 'Page5 CHV ICE', 'G35', 'C35', 'F35', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:23', 'Page5 CHV ICE', 'G36', 'C36', 'F36', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:24', 'Page5 CHV ICE', 'G37', 'C37', 'F37', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:25', 'Page5 CHV ICE', 'G38', 'C38', 'F38', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:26', 'Page5 CHV ICE', 'G39', 'C39', 'F39', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:27', 'Page5 CHV ICE', 'G40', 'C40', 'F40', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:28', 'Page5 CHV ICE', 'G41', 'C41', 'F41', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:29', 'Page5 CHV ICE', 'G42', 'C42', 'F42', 'total_sales', true),
('GMC', 'New Vehicles', 'sub:total_sales:30', 'Page5 CHV ICE', 'G43', 'C43', 'F43', 'total_sales', true);

-- ============================================================
-- GP NET SUB-METRICS (col I values, col C names, col F units — same rows as total_sales)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric)
VALUES
-- Group 1: rows 4-10
('GMC', 'New Vehicles', 'sub:gp_net:00', 'Page5 CHV ICE', 'I4',  'C4',  'F4',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:01', 'Page5 CHV ICE', 'I5',  'C5',  'F5',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:02', 'Page5 CHV ICE', 'I6',  'C6',  'F6',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:03', 'Page5 CHV ICE', 'I7',  'C7',  'F7',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:04', 'Page5 CHV ICE', 'I8',  'C8',  'F8',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:05', 'Page5 CHV ICE', 'I9',  'C9',  'F9',  'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:06', 'Page5 CHV ICE', 'I10', 'C10', 'F10', 'gp_net', true),
-- Group 2: rows 14-15
('GMC', 'New Vehicles', 'sub:gp_net:07', 'Page5 CHV ICE', 'I14', 'C14', 'F14', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:08', 'Page5 CHV ICE', 'I15', 'C15', 'F15', 'gp_net', true),
-- Group 3a: rows 22-29 (separate section)
('GMC', 'New Vehicles', 'sub:gp_net:09', 'Page5 CHV ICE', 'I22', 'C22', 'F22', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:10', 'Page5 CHV ICE', 'I23', 'C23', 'F23', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:11', 'Page5 CHV ICE', 'I24', 'C24', 'F24', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:12', 'Page5 CHV ICE', 'I25', 'C25', 'F25', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:13', 'Page5 CHV ICE', 'I26', 'C26', 'F26', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:14', 'Page5 CHV ICE', 'I27', 'C27', 'F27', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:15', 'Page5 CHV ICE', 'I28', 'C28', 'F28', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:16', 'Page5 CHV ICE', 'I29', 'C29', 'F29', 'gp_net', true),
-- Group 3b: rows 30-43
('GMC', 'New Vehicles', 'sub:gp_net:17', 'Page5 CHV ICE', 'I30', 'C30', 'F30', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:18', 'Page5 CHV ICE', 'I31', 'C31', 'F31', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:19', 'Page5 CHV ICE', 'I32', 'C32', 'F32', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:20', 'Page5 CHV ICE', 'I33', 'C33', 'F33', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:21', 'Page5 CHV ICE', 'I34', 'C34', 'F34', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:22', 'Page5 CHV ICE', 'I35', 'C35', 'F35', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:23', 'Page5 CHV ICE', 'I36', 'C36', 'F36', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:24', 'Page5 CHV ICE', 'I37', 'C37', 'F37', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:25', 'Page5 CHV ICE', 'I38', 'C38', 'F38', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:26', 'Page5 CHV ICE', 'I39', 'C39', 'F39', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:27', 'Page5 CHV ICE', 'I40', 'C40', 'F40', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:28', 'Page5 CHV ICE', 'I41', 'C41', 'F41', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:29', 'Page5 CHV ICE', 'I42', 'C42', 'F42', 'gp_net', true),
('GMC', 'New Vehicles', 'sub:gp_net:30', 'Page5 CHV ICE', 'I43', 'C43', 'F43', 'gp_net', true);
