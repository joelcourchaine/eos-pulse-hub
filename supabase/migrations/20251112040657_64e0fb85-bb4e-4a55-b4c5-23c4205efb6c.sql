-- Add unique constraint for monthly scorecard entries
-- This allows upsert operations on monthly entries
ALTER TABLE scorecard_entries 
ADD CONSTRAINT unique_kpi_month UNIQUE (kpi_id, month);

-- Also add unique constraint for weekly entries if it doesn't exist
ALTER TABLE scorecard_entries 
ADD CONSTRAINT unique_kpi_week UNIQUE (kpi_id, week_start_date);