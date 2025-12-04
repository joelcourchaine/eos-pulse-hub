-- Add selected_metrics column to enterprise_filters table
ALTER TABLE public.enterprise_filters 
ADD COLUMN selected_metrics text[] DEFAULT NULL;