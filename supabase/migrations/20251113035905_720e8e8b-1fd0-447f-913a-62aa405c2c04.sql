-- Add target_direction column to financial_targets table
ALTER TABLE financial_targets 
ADD COLUMN target_direction text NOT NULL DEFAULT 'above' CHECK (target_direction IN ('above', 'below'));

COMMENT ON COLUMN financial_targets.target_direction IS 'Whether higher (above) or lower (below) values are better for this metric';