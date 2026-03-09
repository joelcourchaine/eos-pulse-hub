-- Add missing CHV ICE sub-metrics for rows 45-47 and 50
-- Row 44 (TOTAL NEW TRUCKS RETAIL) is a subtotal — skipped
-- Row 48 (TOTAL NEW TRUCKS) is a subtotal — skipped
-- Row 49 is blank — skipped
-- Row 51 (TOTAL NEW VEHICLES) is the parent total — already mapped

-- TOTAL SALES (col G)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:188', 'Page5 CHV ICE', 'G45', 'C45', 'F45', 'total_sales', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:total_sales:189', 'Page5 CHV ICE', 'G46', 'C46', 'F46', 'total_sales', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:total_sales:190', 'Page5 CHV ICE', 'G47', 'C47', 'F47', 'total_sales', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:total_sales:191', 'Page5 CHV ICE', 'G50', 'C50', 'F50', 'total_sales', true, 'Chevrolet');

-- GP NET (col I)
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:188', 'Page5 CHV ICE', 'I45', 'C45', 'F45', 'gp_net', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:gp_net:189', 'Page5 CHV ICE', 'I46', 'C46', 'F46', 'gp_net', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:gp_net:190', 'Page5 CHV ICE', 'I47', 'C47', 'F47', 'gp_net', true, 'Chevrolet'),
('GMC', 'New Vehicles', 'sub:gp_net:191', 'Page5 CHV ICE', 'I50', 'C50', 'F50', 'gp_net', true, 'Chevrolet');
