-- GMC New Vehicles - Chevrolet EV Cell Mappings
-- ============================================================
-- Sheet: 'Page5 CHV EV'
-- Rows 28-34 (7 items)
-- Names col C, Units col D, Sales col G, GP Net col I
-- Order indices continue from CHV ICE (31+)
-- ============================================================

-- TOTAL SALES SUB-METRICS
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:31', 'Page5 CHV EV', 'G28', 'C28', 'D28', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:32', 'Page5 CHV EV', 'G29', 'C29', 'D29', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:33', 'Page5 CHV EV', 'G30', 'C30', 'D30', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:34', 'Page5 CHV EV', 'G31', 'C31', 'D31', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:35', 'Page5 CHV EV', 'G32', 'C32', 'D32', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:36', 'Page5 CHV EV', 'G33', 'C33', 'D33', 'total_sales', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:total_sales:37', 'Page5 CHV EV', 'G34', 'C34', 'D34', 'total_sales', true, 'Chevrolet EV');

-- GP NET SUB-METRICS (same rows, col I values)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:31', 'Page5 CHV EV', 'I28', 'C28', 'D28', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:32', 'Page5 CHV EV', 'I29', 'C29', 'D29', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:33', 'Page5 CHV EV', 'I30', 'C30', 'D30', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:34', 'Page5 CHV EV', 'I31', 'C31', 'D31', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:35', 'Page5 CHV EV', 'I32', 'C32', 'D32', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:36', 'Page5 CHV EV', 'I33', 'C33', 'D33', 'gp_net', true, 'Chevrolet EV'),
('GMC', 'New Vehicles', 'sub:gp_net:37', 'Page5 CHV EV', 'I34', 'C34', 'D34', 'gp_net', true, 'Chevrolet EV');
