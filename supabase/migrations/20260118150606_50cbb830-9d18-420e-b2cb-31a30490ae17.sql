-- Add recurrence_group_id to consulting_calls for linking recurring call series
ALTER TABLE public.consulting_calls 
ADD COLUMN recurrence_group_id UUID DEFAULT NULL;

-- Add index for efficient querying of recurring call series
CREATE INDEX idx_consulting_calls_recurrence_group 
ON public.consulting_calls(recurrence_group_id) 
WHERE recurrence_group_id IS NOT NULL;