
-- Update CP Hours Per RO to have "above" target direction
UPDATE kpi_definitions
SET target_direction = 'above'
WHERE name = 'CP Hours Per RO';
