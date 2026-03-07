-- GMC New Vehicles - Remaining Sub-Brand Sheet Mappings
-- ============================================================
-- All sheets use: Names col C, Units col F, Sales col G, GP Net col I
-- Order indices continue from BUI ICE (46+)
-- Sheets: BUI EV, GMC ICE, GMC EV, CAD ICE, CAD EV,
--         MED DUTY, HEAVY DUTY, FLT GOV, FLT COM
-- ============================================================

-- ============================================================
-- PAGE5 BUI EV — Buick EV (3 items, indices 46-48)
-- Valid rows: 24, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:46', 'Page5 BUI EV', 'G24', 'C24', 'F24', 'total_sales', true, 'Buick EV'),
('GMC', 'New Vehicles', 'sub:total_sales:47', 'Page5 BUI EV', 'G45', 'C45', 'F45', 'total_sales', true, 'Buick EV'),
('GMC', 'New Vehicles', 'sub:total_sales:48', 'Page5 BUI EV', 'G50', 'C50', 'F50', 'total_sales', true, 'Buick EV');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:46', 'Page5 BUI EV', 'I24', 'C24', 'F24', 'gp_net', true, 'Buick EV'),
('GMC', 'New Vehicles', 'sub:gp_net:47', 'Page5 BUI EV', 'I45', 'C45', 'F45', 'gp_net', true, 'Buick EV'),
('GMC', 'New Vehicles', 'sub:gp_net:48', 'Page5 BUI EV', 'I50', 'C50', 'F50', 'gp_net', true, 'Buick EV');

-- ============================================================
-- PAGE5 GMC ICE — GMC (15 items, indices 49-63)
-- Valid rows: 20, 22, 24, 29, 30, 31, 35, 36, 37, 38, 41, 42, 43, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:49', 'Page5 GMC ICE', 'G20', 'C20', 'F20', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:50', 'Page5 GMC ICE', 'G22', 'C22', 'F22', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:51', 'Page5 GMC ICE', 'G24', 'C24', 'F24', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:52', 'Page5 GMC ICE', 'G29', 'C29', 'F29', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:53', 'Page5 GMC ICE', 'G30', 'C30', 'F30', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:54', 'Page5 GMC ICE', 'G31', 'C31', 'F31', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:55', 'Page5 GMC ICE', 'G35', 'C35', 'F35', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:56', 'Page5 GMC ICE', 'G36', 'C36', 'F36', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:57', 'Page5 GMC ICE', 'G37', 'C37', 'F37', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:58', 'Page5 GMC ICE', 'G38', 'C38', 'F38', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:59', 'Page5 GMC ICE', 'G41', 'C41', 'F41', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:60', 'Page5 GMC ICE', 'G42', 'C42', 'F42', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:61', 'Page5 GMC ICE', 'G43', 'C43', 'F43', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:62', 'Page5 GMC ICE', 'G45', 'C45', 'F45', 'total_sales', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:total_sales:63', 'Page5 GMC ICE', 'G50', 'C50', 'F50', 'total_sales', true, 'GMC');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:49', 'Page5 GMC ICE', 'I20', 'C20', 'F20', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:50', 'Page5 GMC ICE', 'I22', 'C22', 'F22', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:51', 'Page5 GMC ICE', 'I24', 'C24', 'F24', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:52', 'Page5 GMC ICE', 'I29', 'C29', 'F29', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:53', 'Page5 GMC ICE', 'I30', 'C30', 'F30', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:54', 'Page5 GMC ICE', 'I31', 'C31', 'F31', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:55', 'Page5 GMC ICE', 'I35', 'C35', 'F35', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:56', 'Page5 GMC ICE', 'I36', 'C36', 'F36', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:57', 'Page5 GMC ICE', 'I37', 'C37', 'F37', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:58', 'Page5 GMC ICE', 'I38', 'C38', 'F38', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:59', 'Page5 GMC ICE', 'I41', 'C41', 'F41', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:60', 'Page5 GMC ICE', 'I42', 'C42', 'F42', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:61', 'Page5 GMC ICE', 'I43', 'C43', 'F43', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:62', 'Page5 GMC ICE', 'I45', 'C45', 'F45', 'gp_net', true, 'GMC'),
('GMC', 'New Vehicles', 'sub:gp_net:63', 'Page5 GMC ICE', 'I50', 'C50', 'F50', 'gp_net', true, 'GMC');

-- ============================================================
-- PAGE5 GMC EV — GMC EV (6 items, indices 64-69)
-- Valid rows: 24, 28, 29, 30, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:64', 'Page5 GMC EV', 'G24', 'C24', 'F24', 'total_sales', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:total_sales:65', 'Page5 GMC EV', 'G28', 'C28', 'F28', 'total_sales', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:total_sales:66', 'Page5 GMC EV', 'G29', 'C29', 'F29', 'total_sales', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:total_sales:67', 'Page5 GMC EV', 'G30', 'C30', 'F30', 'total_sales', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:total_sales:68', 'Page5 GMC EV', 'G45', 'C45', 'F45', 'total_sales', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:total_sales:69', 'Page5 GMC EV', 'G50', 'C50', 'F50', 'total_sales', true, 'GMC EV');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:64', 'Page5 GMC EV', 'I24', 'C24', 'F24', 'gp_net', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:gp_net:65', 'Page5 GMC EV', 'I28', 'C28', 'F28', 'gp_net', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:gp_net:66', 'Page5 GMC EV', 'I29', 'C29', 'F29', 'gp_net', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:gp_net:67', 'Page5 GMC EV', 'I30', 'C30', 'F30', 'gp_net', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:gp_net:68', 'Page5 GMC EV', 'I45', 'C45', 'F45', 'gp_net', true, 'GMC EV'),
('GMC', 'New Vehicles', 'sub:gp_net:69', 'Page5 GMC EV', 'I50', 'C50', 'F50', 'gp_net', true, 'GMC EV');

-- ============================================================
-- PAGE5 CAD ICE — Cadillac (23 items, indices 70-92)
-- Valid rows: 6-9, 12-16, 20, 22, 24, 28, 30, 31, 35-37, 39, 42, 43, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:70', 'Page5 CAD ICE', 'G6',  'C6',  'F6',  'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:71', 'Page5 CAD ICE', 'G7',  'C7',  'F7',  'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:72', 'Page5 CAD ICE', 'G8',  'C8',  'F8',  'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:73', 'Page5 CAD ICE', 'G9',  'C9',  'F9',  'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:74', 'Page5 CAD ICE', 'G12', 'C12', 'F12', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:75', 'Page5 CAD ICE', 'G13', 'C13', 'F13', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:76', 'Page5 CAD ICE', 'G14', 'C14', 'F14', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:77', 'Page5 CAD ICE', 'G15', 'C15', 'F15', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:78', 'Page5 CAD ICE', 'G16', 'C16', 'F16', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:79', 'Page5 CAD ICE', 'G20', 'C20', 'F20', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:80', 'Page5 CAD ICE', 'G22', 'C22', 'F22', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:81', 'Page5 CAD ICE', 'G24', 'C24', 'F24', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:82', 'Page5 CAD ICE', 'G28', 'C28', 'F28', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:83', 'Page5 CAD ICE', 'G30', 'C30', 'F30', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:84', 'Page5 CAD ICE', 'G31', 'C31', 'F31', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:85', 'Page5 CAD ICE', 'G35', 'C35', 'F35', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:86', 'Page5 CAD ICE', 'G36', 'C36', 'F36', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:87', 'Page5 CAD ICE', 'G37', 'C37', 'F37', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:88', 'Page5 CAD ICE', 'G39', 'C39', 'F39', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:89', 'Page5 CAD ICE', 'G42', 'C42', 'F42', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:90', 'Page5 CAD ICE', 'G43', 'C43', 'F43', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:91', 'Page5 CAD ICE', 'G45', 'C45', 'F45', 'total_sales', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:total_sales:92', 'Page5 CAD ICE', 'G50', 'C50', 'F50', 'total_sales', true, 'Cadillac');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:70', 'Page5 CAD ICE', 'I6',  'C6',  'F6',  'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:71', 'Page5 CAD ICE', 'I7',  'C7',  'F7',  'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:72', 'Page5 CAD ICE', 'I8',  'C8',  'F8',  'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:73', 'Page5 CAD ICE', 'I9',  'C9',  'F9',  'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:74', 'Page5 CAD ICE', 'I12', 'C12', 'F12', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:75', 'Page5 CAD ICE', 'I13', 'C13', 'F13', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:76', 'Page5 CAD ICE', 'I14', 'C14', 'F14', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:77', 'Page5 CAD ICE', 'I15', 'C15', 'F15', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:78', 'Page5 CAD ICE', 'I16', 'C16', 'F16', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:79', 'Page5 CAD ICE', 'I20', 'C20', 'F20', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:80', 'Page5 CAD ICE', 'I22', 'C22', 'F22', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:81', 'Page5 CAD ICE', 'I24', 'C24', 'F24', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:82', 'Page5 CAD ICE', 'I28', 'C28', 'F28', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:83', 'Page5 CAD ICE', 'I30', 'C30', 'F30', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:84', 'Page5 CAD ICE', 'I31', 'C31', 'F31', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:85', 'Page5 CAD ICE', 'I35', 'C35', 'F35', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:86', 'Page5 CAD ICE', 'I36', 'C36', 'F36', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:87', 'Page5 CAD ICE', 'I37', 'C37', 'F37', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:88', 'Page5 CAD ICE', 'I39', 'C39', 'F39', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:89', 'Page5 CAD ICE', 'I42', 'C42', 'F42', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:90', 'Page5 CAD ICE', 'I43', 'C43', 'F43', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:91', 'Page5 CAD ICE', 'I45', 'C45', 'F45', 'gp_net', true, 'Cadillac'),
('GMC', 'New Vehicles', 'sub:gp_net:92', 'Page5 CAD ICE', 'I50', 'C50', 'F50', 'gp_net', true, 'Cadillac');

-- ============================================================
-- PAGE5 CAD EV — Cadillac EV (9 items, indices 93-101)
-- Valid rows: 4, 24, 28, 29, 30, 31, 32, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:93',  'Page5 CAD EV', 'G4',  'C4',  'F4',  'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:94',  'Page5 CAD EV', 'G24', 'C24', 'F24', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:95',  'Page5 CAD EV', 'G28', 'C28', 'F28', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:96',  'Page5 CAD EV', 'G29', 'C29', 'F29', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:97',  'Page5 CAD EV', 'G30', 'C30', 'F30', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:98',  'Page5 CAD EV', 'G31', 'C31', 'F31', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:99',  'Page5 CAD EV', 'G32', 'C32', 'F32', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:100', 'Page5 CAD EV', 'G45', 'C45', 'F45', 'total_sales', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:total_sales:101', 'Page5 CAD EV', 'G50', 'C50', 'F50', 'total_sales', true, 'Cadillac EV');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:93',  'Page5 CAD EV', 'I4',  'C4',  'F4',  'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:94',  'Page5 CAD EV', 'I24', 'C24', 'F24', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:95',  'Page5 CAD EV', 'I28', 'C28', 'F28', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:96',  'Page5 CAD EV', 'I29', 'C29', 'F29', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:97',  'Page5 CAD EV', 'I30', 'C30', 'F30', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:98',  'Page5 CAD EV', 'I31', 'C31', 'F31', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:99',  'Page5 CAD EV', 'I32', 'C32', 'F32', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:100', 'Page5 CAD EV', 'I45', 'C45', 'F45', 'gp_net', true, 'Cadillac EV'),
('GMC', 'New Vehicles', 'sub:gp_net:101', 'Page5 CAD EV', 'I50', 'C50', 'F50', 'gp_net', true, 'Cadillac EV');

-- ============================================================
-- PAGE5 MED DUTY — Medium Duty (5 items, indices 102-106)
-- Valid rows: 24, 42, 43, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:102', 'Page5 MED DUTY', 'G24', 'C24', 'F24', 'total_sales', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:103', 'Page5 MED DUTY', 'G42', 'C42', 'F42', 'total_sales', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:104', 'Page5 MED DUTY', 'G43', 'C43', 'F43', 'total_sales', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:105', 'Page5 MED DUTY', 'G45', 'C45', 'F45', 'total_sales', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:106', 'Page5 MED DUTY', 'G50', 'C50', 'F50', 'total_sales', true, 'Medium Duty');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:102', 'Page5 MED DUTY', 'I24', 'C24', 'F24', 'gp_net', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:103', 'Page5 MED DUTY', 'I42', 'C42', 'F42', 'gp_net', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:104', 'Page5 MED DUTY', 'I43', 'C43', 'F43', 'gp_net', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:105', 'Page5 MED DUTY', 'I45', 'C45', 'F45', 'gp_net', true, 'Medium Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:106', 'Page5 MED DUTY', 'I50', 'C50', 'F50', 'gp_net', true, 'Medium Duty');

-- ============================================================
-- PAGE5 HEAVY DUTY — Heavy Duty (4 items, indices 107-110)
-- Valid rows: 24, 28, 45, 50
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:total_sales:107', 'Page5 HEAVY DUTY', 'G24', 'C24', 'F24', 'total_sales', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:108', 'Page5 HEAVY DUTY', 'G28', 'C28', 'F28', 'total_sales', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:109', 'Page5 HEAVY DUTY', 'G45', 'C45', 'F45', 'total_sales', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:total_sales:110', 'Page5 HEAVY DUTY', 'G50', 'C50', 'F50', 'total_sales', true, 'Heavy Duty');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:107', 'Page5 HEAVY DUTY', 'I24', 'C24', 'F24', 'gp_net', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:108', 'Page5 HEAVY DUTY', 'I28', 'C28', 'F28', 'gp_net', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:109', 'Page5 HEAVY DUTY', 'I45', 'C45', 'F45', 'gp_net', true, 'Heavy Duty'),
('GMC', 'New Vehicles', 'sub:gp_net:110', 'Page5 HEAVY DUTY', 'I50', 'C50', 'F50', 'gp_net', true, 'Heavy Duty');

-- ============================================================
-- PAGE5 FLT GOV — Fleet section (26 items, indices 111-136)
-- Valid rows: 4-9, 13-24, 25, 27-29, 31-34
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- Cars: rows 4-9
('GMC', 'New Vehicles', 'sub:total_sales:111', 'Page5 FLT GOV', 'G4',  'C4',  'F4',  'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:112', 'Page5 FLT GOV', 'G5',  'C5',  'F5',  'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:113', 'Page5 FLT GOV', 'G6',  'C6',  'F6',  'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:114', 'Page5 FLT GOV', 'G7',  'C7',  'F7',  'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:115', 'Page5 FLT GOV', 'G8',  'C8',  'F8',  'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:116', 'Page5 FLT GOV', 'G9',  'C9',  'F9',  'total_sales', true, 'Fleet'),
-- SUVs: rows 13-24
('GMC', 'New Vehicles', 'sub:total_sales:117', 'Page5 FLT GOV', 'G13', 'C13', 'F13', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:118', 'Page5 FLT GOV', 'G14', 'C14', 'F14', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:119', 'Page5 FLT GOV', 'G15', 'C15', 'F15', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:120', 'Page5 FLT GOV', 'G16', 'C16', 'F16', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:121', 'Page5 FLT GOV', 'G17', 'C17', 'F17', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:122', 'Page5 FLT GOV', 'G18', 'C18', 'F18', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:123', 'Page5 FLT GOV', 'G19', 'C19', 'F19', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:124', 'Page5 FLT GOV', 'G20', 'C20', 'F20', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:125', 'Page5 FLT GOV', 'G21', 'C21', 'F21', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:126', 'Page5 FLT GOV', 'G22', 'C22', 'F22', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:127', 'Page5 FLT GOV', 'G23', 'C23', 'F23', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:128', 'Page5 FLT GOV', 'G24', 'C24', 'F24', 'total_sales', true, 'Fleet'),
-- Trucks: rows 25, 27-29, 31-34
('GMC', 'New Vehicles', 'sub:total_sales:129', 'Page5 FLT GOV', 'G25', 'C25', 'F25', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:130', 'Page5 FLT GOV', 'G27', 'C27', 'F27', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:131', 'Page5 FLT GOV', 'G28', 'C28', 'F28', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:132', 'Page5 FLT GOV', 'G29', 'C29', 'F29', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:133', 'Page5 FLT GOV', 'G31', 'C31', 'F31', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:134', 'Page5 FLT GOV', 'G32', 'C32', 'F32', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:135', 'Page5 FLT GOV', 'G33', 'C33', 'F33', 'total_sales', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:total_sales:136', 'Page5 FLT GOV', 'G34', 'C34', 'F34', 'total_sales', true, 'Fleet');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:111', 'Page5 FLT GOV', 'I4',  'C4',  'F4',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:112', 'Page5 FLT GOV', 'I5',  'C5',  'F5',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:113', 'Page5 FLT GOV', 'I6',  'C6',  'F6',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:114', 'Page5 FLT GOV', 'I7',  'C7',  'F7',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:115', 'Page5 FLT GOV', 'I8',  'C8',  'F8',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:116', 'Page5 FLT GOV', 'I9',  'C9',  'F9',  'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:117', 'Page5 FLT GOV', 'I13', 'C13', 'F13', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:118', 'Page5 FLT GOV', 'I14', 'C14', 'F14', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:119', 'Page5 FLT GOV', 'I15', 'C15', 'F15', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:120', 'Page5 FLT GOV', 'I16', 'C16', 'F16', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:121', 'Page5 FLT GOV', 'I17', 'C17', 'F17', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:122', 'Page5 FLT GOV', 'I18', 'C18', 'F18', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:123', 'Page5 FLT GOV', 'I19', 'C19', 'F19', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:124', 'Page5 FLT GOV', 'I20', 'C20', 'F20', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:125', 'Page5 FLT GOV', 'I21', 'C21', 'F21', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:126', 'Page5 FLT GOV', 'I22', 'C22', 'F22', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:127', 'Page5 FLT GOV', 'I23', 'C23', 'F23', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:128', 'Page5 FLT GOV', 'I24', 'C24', 'F24', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:129', 'Page5 FLT GOV', 'I25', 'C25', 'F25', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:130', 'Page5 FLT GOV', 'I27', 'C27', 'F27', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:131', 'Page5 FLT GOV', 'I28', 'C28', 'F28', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:132', 'Page5 FLT GOV', 'I29', 'C29', 'F29', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:133', 'Page5 FLT GOV', 'I31', 'C31', 'F31', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:134', 'Page5 FLT GOV', 'I32', 'C32', 'F32', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:135', 'Page5 FLT GOV', 'I33', 'C33', 'F33', 'gp_net', true, 'Fleet'),
('GMC', 'New Vehicles', 'sub:gp_net:136', 'Page5 FLT GOV', 'I34', 'C34', 'F34', 'gp_net', true, 'Fleet');

-- ============================================================
-- PAGE5 FLT GOV — Government section (25 items, indices 137-161)
-- Valid rows: 40-45, 49-60, 61, 63-65, 67-69
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- Cars: rows 40-45
('GMC', 'New Vehicles', 'sub:total_sales:137', 'Page5 FLT GOV', 'G40', 'C40', 'F40', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:138', 'Page5 FLT GOV', 'G41', 'C41', 'F41', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:139', 'Page5 FLT GOV', 'G42', 'C42', 'F42', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:140', 'Page5 FLT GOV', 'G43', 'C43', 'F43', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:141', 'Page5 FLT GOV', 'G44', 'C44', 'F44', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:142', 'Page5 FLT GOV', 'G45', 'C45', 'F45', 'total_sales', true, 'Government'),
-- SUVs: rows 49-60
('GMC', 'New Vehicles', 'sub:total_sales:143', 'Page5 FLT GOV', 'G49', 'C49', 'F49', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:144', 'Page5 FLT GOV', 'G50', 'C50', 'F50', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:145', 'Page5 FLT GOV', 'G51', 'C51', 'F51', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:146', 'Page5 FLT GOV', 'G52', 'C52', 'F52', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:147', 'Page5 FLT GOV', 'G53', 'C53', 'F53', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:148', 'Page5 FLT GOV', 'G54', 'C54', 'F54', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:149', 'Page5 FLT GOV', 'G55', 'C55', 'F55', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:150', 'Page5 FLT GOV', 'G56', 'C56', 'F56', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:151', 'Page5 FLT GOV', 'G57', 'C57', 'F57', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:152', 'Page5 FLT GOV', 'G58', 'C58', 'F58', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:153', 'Page5 FLT GOV', 'G59', 'C59', 'F59', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:154', 'Page5 FLT GOV', 'G60', 'C60', 'F60', 'total_sales', true, 'Government'),
-- Trucks: rows 61, 63-65, 67-69
('GMC', 'New Vehicles', 'sub:total_sales:155', 'Page5 FLT GOV', 'G61', 'C61', 'F61', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:156', 'Page5 FLT GOV', 'G63', 'C63', 'F63', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:157', 'Page5 FLT GOV', 'G64', 'C64', 'F64', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:158', 'Page5 FLT GOV', 'G65', 'C65', 'F65', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:159', 'Page5 FLT GOV', 'G67', 'C67', 'F67', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:160', 'Page5 FLT GOV', 'G68', 'C68', 'F68', 'total_sales', true, 'Government'),
('GMC', 'New Vehicles', 'sub:total_sales:161', 'Page5 FLT GOV', 'G69', 'C69', 'F69', 'total_sales', true, 'Government');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:137', 'Page5 FLT GOV', 'I40', 'C40', 'F40', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:138', 'Page5 FLT GOV', 'I41', 'C41', 'F41', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:139', 'Page5 FLT GOV', 'I42', 'C42', 'F42', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:140', 'Page5 FLT GOV', 'I43', 'C43', 'F43', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:141', 'Page5 FLT GOV', 'I44', 'C44', 'F44', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:142', 'Page5 FLT GOV', 'I45', 'C45', 'F45', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:143', 'Page5 FLT GOV', 'I49', 'C49', 'F49', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:144', 'Page5 FLT GOV', 'I50', 'C50', 'F50', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:145', 'Page5 FLT GOV', 'I51', 'C51', 'F51', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:146', 'Page5 FLT GOV', 'I52', 'C52', 'F52', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:147', 'Page5 FLT GOV', 'I53', 'C53', 'F53', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:148', 'Page5 FLT GOV', 'I54', 'C54', 'F54', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:149', 'Page5 FLT GOV', 'I55', 'C55', 'F55', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:150', 'Page5 FLT GOV', 'I56', 'C56', 'F56', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:151', 'Page5 FLT GOV', 'I57', 'C57', 'F57', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:152', 'Page5 FLT GOV', 'I58', 'C58', 'F58', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:153', 'Page5 FLT GOV', 'I59', 'C59', 'F59', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:154', 'Page5 FLT GOV', 'I60', 'C60', 'F60', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:155', 'Page5 FLT GOV', 'I61', 'C61', 'F61', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:156', 'Page5 FLT GOV', 'I63', 'C63', 'F63', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:157', 'Page5 FLT GOV', 'I64', 'C64', 'F64', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:158', 'Page5 FLT GOV', 'I65', 'C65', 'F65', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:159', 'Page5 FLT GOV', 'I67', 'C67', 'F67', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:160', 'Page5 FLT GOV', 'I68', 'C68', 'F68', 'gp_net', true, 'Government'),
('GMC', 'New Vehicles', 'sub:gp_net:161', 'Page5 FLT GOV', 'I69', 'C69', 'F69', 'gp_net', true, 'Government');

-- ============================================================
-- PAGE5 FLT COM — Commercial (26 items, indices 162-187)
-- Small Business section only (same layout as FLT GOV Fleet)
-- Valid rows: 4-9, 13-24, 25, 27-29, 31-34
-- Skipping Summary (rows 39-58) and Expenses (rows 60-67)
-- ============================================================
INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
-- Cars: rows 4-9
('GMC', 'New Vehicles', 'sub:total_sales:162', 'Page5 FLT COM', 'G4',  'C4',  'F4',  'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:163', 'Page5 FLT COM', 'G5',  'C5',  'F5',  'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:164', 'Page5 FLT COM', 'G6',  'C6',  'F6',  'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:165', 'Page5 FLT COM', 'G7',  'C7',  'F7',  'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:166', 'Page5 FLT COM', 'G8',  'C8',  'F8',  'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:167', 'Page5 FLT COM', 'G9',  'C9',  'F9',  'total_sales', true, 'Commercial'),
-- SUVs: rows 13-24
('GMC', 'New Vehicles', 'sub:total_sales:168', 'Page5 FLT COM', 'G13', 'C13', 'F13', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:169', 'Page5 FLT COM', 'G14', 'C14', 'F14', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:170', 'Page5 FLT COM', 'G15', 'C15', 'F15', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:171', 'Page5 FLT COM', 'G16', 'C16', 'F16', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:172', 'Page5 FLT COM', 'G17', 'C17', 'F17', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:173', 'Page5 FLT COM', 'G18', 'C18', 'F18', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:174', 'Page5 FLT COM', 'G19', 'C19', 'F19', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:175', 'Page5 FLT COM', 'G20', 'C20', 'F20', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:176', 'Page5 FLT COM', 'G21', 'C21', 'F21', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:177', 'Page5 FLT COM', 'G22', 'C22', 'F22', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:178', 'Page5 FLT COM', 'G23', 'C23', 'F23', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:179', 'Page5 FLT COM', 'G24', 'C24', 'F24', 'total_sales', true, 'Commercial'),
-- Trucks: rows 25, 27-29, 31-34
('GMC', 'New Vehicles', 'sub:total_sales:180', 'Page5 FLT COM', 'G25', 'C25', 'F25', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:181', 'Page5 FLT COM', 'G27', 'C27', 'F27', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:182', 'Page5 FLT COM', 'G28', 'C28', 'F28', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:183', 'Page5 FLT COM', 'G29', 'C29', 'F29', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:184', 'Page5 FLT COM', 'G31', 'C31', 'F31', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:185', 'Page5 FLT COM', 'G32', 'C32', 'F32', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:186', 'Page5 FLT COM', 'G33', 'C33', 'F33', 'total_sales', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:total_sales:187', 'Page5 FLT COM', 'G34', 'C34', 'F34', 'total_sales', true, 'Commercial');

INSERT INTO public.financial_cell_mappings
(brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, unit_cell_reference, parent_metric_key, is_sub_metric, category)
VALUES
('GMC', 'New Vehicles', 'sub:gp_net:162', 'Page5 FLT COM', 'I4',  'C4',  'F4',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:163', 'Page5 FLT COM', 'I5',  'C5',  'F5',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:164', 'Page5 FLT COM', 'I6',  'C6',  'F6',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:165', 'Page5 FLT COM', 'I7',  'C7',  'F7',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:166', 'Page5 FLT COM', 'I8',  'C8',  'F8',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:167', 'Page5 FLT COM', 'I9',  'C9',  'F9',  'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:168', 'Page5 FLT COM', 'I13', 'C13', 'F13', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:169', 'Page5 FLT COM', 'I14', 'C14', 'F14', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:170', 'Page5 FLT COM', 'I15', 'C15', 'F15', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:171', 'Page5 FLT COM', 'I16', 'C16', 'F16', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:172', 'Page5 FLT COM', 'I17', 'C17', 'F17', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:173', 'Page5 FLT COM', 'I18', 'C18', 'F18', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:174', 'Page5 FLT COM', 'I19', 'C19', 'F19', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:175', 'Page5 FLT COM', 'I20', 'C20', 'F20', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:176', 'Page5 FLT COM', 'I21', 'C21', 'F21', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:177', 'Page5 FLT COM', 'I22', 'C22', 'F22', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:178', 'Page5 FLT COM', 'I23', 'C23', 'F23', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:179', 'Page5 FLT COM', 'I24', 'C24', 'F24', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:180', 'Page5 FLT COM', 'I25', 'C25', 'F25', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:181', 'Page5 FLT COM', 'I27', 'C27', 'F27', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:182', 'Page5 FLT COM', 'I28', 'C28', 'F28', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:183', 'Page5 FLT COM', 'I29', 'C29', 'F29', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:184', 'Page5 FLT COM', 'I31', 'C31', 'F31', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:185', 'Page5 FLT COM', 'I32', 'C32', 'F32', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:186', 'Page5 FLT COM', 'I33', 'C33', 'F33', 'gp_net', true, 'Commercial'),
('GMC', 'New Vehicles', 'sub:gp_net:187', 'Page5 FLT COM', 'I34', 'C34', 'F34', 'gp_net', true, 'Commercial');
