-- Add unique constraint on financial_entries for upsert functionality
ALTER TABLE public.financial_entries 
ADD CONSTRAINT financial_entries_department_month_metric_unique 
UNIQUE (department_id, month, metric_name);