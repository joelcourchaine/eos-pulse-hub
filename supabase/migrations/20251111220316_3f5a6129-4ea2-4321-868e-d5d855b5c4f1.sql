-- Add reports_to column to profiles table for organizational hierarchy
ALTER TABLE public.profiles 
ADD COLUMN reports_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_profiles_reports_to ON public.profiles(reports_to);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.reports_to IS 'The user this person reports to in the organizational hierarchy';