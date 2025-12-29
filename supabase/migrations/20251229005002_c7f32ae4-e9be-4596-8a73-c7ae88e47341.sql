-- First, delete duplicate rows keeping only the most recent one for each (department_id, month, metric_name)
DELETE FROM financial_entries a
USING financial_entries b
WHERE a.id < b.id
  AND a.department_id = b.department_id
  AND a.month = b.month
  AND a.metric_name = b.metric_name;

-- Add unique constraint to prevent future duplicates
ALTER TABLE financial_entries
ADD CONSTRAINT financial_entries_dept_month_metric_unique
UNIQUE (department_id, month, metric_name);