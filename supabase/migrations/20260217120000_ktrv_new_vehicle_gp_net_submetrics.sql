-- KTRV New Vehicles GP Net sub-metrics (Page3, Column F, names Column L)
-- Matches the same rows as total_sales but includes F29 and F34 (GP only, no sales)

INSERT INTO financial_cell_mappings (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, is_sub_metric, parent_metric_key)
VALUES
  -- Vehicle GP
  ('KTRV', 'New Vehicles', 'sub:gp_net:001', 'Page3', 'F6',  'L6',  true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:002', 'Page3', 'F8',  'L8',  true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:003', 'Page3', 'F10', 'L10', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:004', 'Page3', 'F12', 'L12', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:005', 'Page3', 'F14', 'L14', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:006', 'Page3', 'F16', 'L16', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:007', 'Page3', 'F18', 'L18', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:008', 'Page3', 'F20', 'L20', true, 'gp_net'),
  -- F&I GP (names in Column K, F29 and F34 have GP values but no sales)
  ('KTRV', 'New Vehicles', 'sub:gp_net:009', 'Page3', 'F28', 'K28', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:010', 'Page3', 'F29', 'K29', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:011', 'Page3', 'F30', 'K30', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:012', 'Page3', 'F31', 'K31', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:013', 'Page3', 'F32', 'K32', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:014', 'Page3', 'F33', 'K33', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:015', 'Page3', 'F34', 'K34', true, 'gp_net'),
  ('KTRV', 'New Vehicles', 'sub:gp_net:016', 'Page3', 'F35', 'K35', true, 'gp_net');
