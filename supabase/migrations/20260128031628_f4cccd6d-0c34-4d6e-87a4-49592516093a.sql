-- Add due_day_config column to routine_templates
ALTER TABLE routine_templates ADD COLUMN IF NOT EXISTS due_day_config jsonb DEFAULT NULL;

-- Add due_day_config column to department_routines
ALTER TABLE department_routines ADD COLUMN IF NOT EXISTS due_day_config jsonb DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN routine_templates.due_day_config IS 'JSONB config for due dates. Weekly: {"type":"day_of_week","day":1-7}, Monthly: {"type":"day_of_month","day":1-28|"last"} or {"type":"last_weekday","weekday":1-7}, Quarterly: {"type":"day_of_quarter","day":"last"} or {"type":"day_of_quarter","month":1-3,"day":1-31}, Yearly: {"type":"specific_date","month":1-12,"day":1-31}';

COMMENT ON COLUMN department_routines.due_day_config IS 'JSONB config for due dates. Inherited from template or set directly.';