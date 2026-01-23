-- Create a table to store per-store report paths for each import profile
CREATE TABLE public.scorecard_profile_store_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_profile_id UUID NOT NULL REFERENCES scorecard_import_profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  report_path TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Each profile+store combination can only have one report path
  CONSTRAINT unique_profile_store UNIQUE (import_profile_id, store_id)
);

-- Enable RLS
ALTER TABLE public.scorecard_profile_store_reports ENABLE ROW LEVEL SECURITY;

-- Super admins can manage all
CREATE POLICY "Super admins can manage profile store reports"
ON public.scorecard_profile_store_reports
FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- Create index for faster lookups
CREATE INDEX idx_profile_store_reports_lookup 
ON public.scorecard_profile_store_reports(import_profile_id, store_id);