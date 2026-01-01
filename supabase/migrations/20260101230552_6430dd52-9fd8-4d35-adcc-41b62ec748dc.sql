-- Add issue_id column to forecast_submetric_notes to link notes to issues
ALTER TABLE public.forecast_submetric_notes 
ADD COLUMN issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL;