-- Set REPLICA IDENTITY FULL so DELETE events include the old row data
ALTER TABLE public.routine_completions REPLICA IDENTITY FULL;