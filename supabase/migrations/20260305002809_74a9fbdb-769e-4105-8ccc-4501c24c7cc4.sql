
-- Drop redundant narrow monthly constraint (kept: scorecard_entries_kpi_month_entry_unique)
ALTER TABLE scorecard_entries DROP CONSTRAINT IF EXISTS unique_kpi_month;

-- Drop one of the two duplicate weekly constraints (kept: unique_kpi_week)
ALTER TABLE scorecard_entries DROP CONSTRAINT IF EXISTS scorecard_entries_kpi_id_week_start_date_key;
