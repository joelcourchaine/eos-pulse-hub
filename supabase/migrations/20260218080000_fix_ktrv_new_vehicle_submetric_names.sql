-- Fix KTRV New Vehicles sub-metric names
-- Problem: K column (K28-K35) name_cell_reference lookups are failing for
-- gp_net sub-metrics, causing fallback names like "009", "010", etc.
-- Solution: Embed actual names in metric_keys as fallbacks. Parser tries
-- name_cell_reference first, falls back to embedded name in metric_key.
-- Also embed names in total_sales sub-metric keys for consistency.

-- ============================================================
-- 1. Fix financial_cell_mappings: Embed names in metric_keys
-- ============================================================

-- Total Sales - Vehicle section (L column names work fine, but embed for safety)
UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:001:CLASS A'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:001' AND cell_reference = 'D6';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:002:CLASS B'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:002' AND cell_reference = 'D8';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:003:CLASS C'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:003' AND cell_reference = 'D10';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:004:5th WHEEL'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:004' AND cell_reference = 'D12';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:005:TOY HAULER'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:005' AND cell_reference = 'D14';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:006:TRAVEL TRAILER'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:006' AND cell_reference = 'D16';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:007:OTHER MAKES'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:007' AND cell_reference = 'D18';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:008:TOTAL NEW RETAIL'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:008' AND cell_reference = 'D20';

-- Total Sales - F&I section (K column names)
UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:009:F&I RESERVE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:009' AND cell_reference = 'D28';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:010:F&I INSURANCE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:010' AND cell_reference = 'D29';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:011:F&I FINANCE FEE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:011' AND cell_reference = 'D30';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:012:F&I WARRANTY - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:012' AND cell_reference = 'D31';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:013:F&I PROTECTIONS - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:013' AND cell_reference = 'D32';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:014:F&I SERVICE CONTRACTS - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:014' AND cell_reference = 'D33';

UPDATE financial_cell_mappings
SET metric_key = 'sub:total_sales:015:TOTAL NEW F&I'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:total_sales:015' AND cell_reference = 'D35';

-- GP Net - Vehicle section (L column names)
UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:001:CLASS A'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:001' AND cell_reference = 'F6';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:002:CLASS B'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:002' AND cell_reference = 'F8';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:003:CLASS C'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:003' AND cell_reference = 'F10';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:004:5th WHEEL'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:004' AND cell_reference = 'F12';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:005:TOY HAULER'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:005' AND cell_reference = 'F14';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:006:TRAVEL TRAILER'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:006' AND cell_reference = 'F16';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:007:OTHER MAKES'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:007' AND cell_reference = 'F18';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:008:TOTAL NEW RETAIL'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:008' AND cell_reference = 'F20';

-- GP Net - F&I section (K column names)
UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:009:F&I RESERVE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:009' AND cell_reference = 'F28';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:010:F&I INSURANCE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:010' AND cell_reference = 'F29';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:011:F&I FINANCE FEE - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:011' AND cell_reference = 'F30';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:012:F&I WARRANTY - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:012' AND cell_reference = 'F31';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:013:F&I PROTECTIONS - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:013' AND cell_reference = 'F32';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:014:F&I SERVICE CONTRACTS - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:014' AND cell_reference = 'F33';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:015:F&I REPOS & CHARGEBACKS - NEW'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:015' AND cell_reference = 'F34';

UPDATE financial_cell_mappings
SET metric_key = 'sub:gp_net:016:TOTAL NEW F&I'
WHERE brand = 'KTRV' AND department_name = 'New Vehicles'
  AND metric_key = 'sub:gp_net:016' AND cell_reference = 'F35';


-- ============================================================
-- 2. Fix existing corrupted financial_entries
--    These have metric_names like "sub:gp_net:009:009" where
--    the name portion is just the numeric fallback. Replace
--    with the correct names so data displays properly NOW
--    without needing a re-import.
-- ============================================================

-- GP Net F&I entries
UPDATE financial_entries
SET metric_name = 'sub:gp_net:009:F&I RESERVE - NEW'
WHERE metric_name = 'sub:gp_net:009:009';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:010:F&I INSURANCE - NEW'
WHERE metric_name = 'sub:gp_net:010:010';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:011:F&I FINANCE FEE - NEW'
WHERE metric_name = 'sub:gp_net:011:011';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:012:F&I WARRANTY - NEW'
WHERE metric_name = 'sub:gp_net:012:012';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:013:F&I PROTECTIONS - NEW'
WHERE metric_name = 'sub:gp_net:013:013';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:014:F&I SERVICE CONTRACTS - NEW'
WHERE metric_name = 'sub:gp_net:014:014';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:015:F&I REPOS & CHARGEBACKS - NEW'
WHERE metric_name = 'sub:gp_net:015:015';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:016:TOTAL NEW F&I'
WHERE metric_name = 'sub:gp_net:016:016';

-- Also fix vehicle GP Net entries if they were corrupted
UPDATE financial_entries
SET metric_name = 'sub:gp_net:001:CLASS A'
WHERE metric_name = 'sub:gp_net:001:001';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:002:CLASS B'
WHERE metric_name = 'sub:gp_net:002:002';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:003:CLASS C'
WHERE metric_name = 'sub:gp_net:003:003';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:004:5th WHEEL'
WHERE metric_name = 'sub:gp_net:004:004';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:005:TOY HAULER'
WHERE metric_name = 'sub:gp_net:005:005';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:006:TRAVEL TRAILER'
WHERE metric_name = 'sub:gp_net:006:006';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:007:OTHER MAKES'
WHERE metric_name = 'sub:gp_net:007:007';

UPDATE financial_entries
SET metric_name = 'sub:gp_net:008:TOTAL NEW RETAIL'
WHERE metric_name = 'sub:gp_net:008:008';

-- Fix total_sales entries too (in case they also have numeric-only names)
UPDATE financial_entries
SET metric_name = 'sub:total_sales:001:CLASS A'
WHERE metric_name = 'sub:total_sales:001:001';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:002:CLASS B'
WHERE metric_name = 'sub:total_sales:002:002';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:003:CLASS C'
WHERE metric_name = 'sub:total_sales:003:003';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:004:5th WHEEL'
WHERE metric_name = 'sub:total_sales:004:004';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:005:TOY HAULER'
WHERE metric_name = 'sub:total_sales:005:005';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:006:TRAVEL TRAILER'
WHERE metric_name = 'sub:total_sales:006:006';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:007:OTHER MAKES'
WHERE metric_name = 'sub:total_sales:007:007';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:008:TOTAL NEW RETAIL'
WHERE metric_name = 'sub:total_sales:008:008';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:009:F&I RESERVE - NEW'
WHERE metric_name = 'sub:total_sales:009:009';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:010:F&I INSURANCE - NEW'
WHERE metric_name = 'sub:total_sales:010:010';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:011:F&I FINANCE FEE - NEW'
WHERE metric_name = 'sub:total_sales:011:011';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:012:F&I WARRANTY - NEW'
WHERE metric_name = 'sub:total_sales:012:012';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:013:F&I PROTECTIONS - NEW'
WHERE metric_name = 'sub:total_sales:013:013';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:014:F&I SERVICE CONTRACTS - NEW'
WHERE metric_name = 'sub:total_sales:014:014';

UPDATE financial_entries
SET metric_name = 'sub:total_sales:015:TOTAL NEW F&I'
WHERE metric_name = 'sub:total_sales:015:015';
