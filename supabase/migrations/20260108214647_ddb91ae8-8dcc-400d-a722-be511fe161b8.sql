-- Add aggregation_type column to kpi_definitions
ALTER TABLE kpi_definitions 
ADD COLUMN aggregation_type text NOT NULL DEFAULT 'sum';

-- Add aggregation_type column to preset_kpis
ALTER TABLE preset_kpis 
ADD COLUMN aggregation_type text NOT NULL DEFAULT 'sum';

-- Update existing kpi_definitions to use 'average' for rate-based metrics
UPDATE kpi_definitions 
SET aggregation_type = 'average' 
WHERE metric_type = 'percentage' 
   OR name ILIKE '%ELR%' 
   OR name ILIKE '%Per RO%' 
   OR name ILIKE '%Gross %'
   OR name ILIKE '%Per Unit%'
   OR name ILIKE '%Average%';

-- Update existing preset_kpis to use 'average' for rate-based metrics
UPDATE preset_kpis 
SET aggregation_type = 'average' 
WHERE metric_type = 'percentage' 
   OR name ILIKE '%ELR%' 
   OR name ILIKE '%Per RO%' 
   OR name ILIKE '%Gross %'
   OR name ILIKE '%Per Unit%'
   OR name ILIKE '%Average%';