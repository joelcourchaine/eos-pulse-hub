-- Add unique constraint for scorecard_entries upsert on kpi_id + month + entry_type
ALTER TABLE public.scorecard_entries 
ADD CONSTRAINT scorecard_entries_kpi_month_entry_unique 
UNIQUE (kpi_id, month, entry_type);