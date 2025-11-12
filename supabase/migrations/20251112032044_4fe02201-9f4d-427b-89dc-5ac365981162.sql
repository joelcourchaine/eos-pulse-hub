-- Add target_direction column to kpi_definitions
ALTER TABLE kpi_definitions 
ADD COLUMN target_direction text NOT NULL DEFAULT 'above' CHECK (target_direction IN ('above', 'below'));