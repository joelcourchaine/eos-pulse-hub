-- Create table for saved enterprise filters
CREATE TABLE public.enterprise_filters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filter_mode TEXT NOT NULL DEFAULT 'brand',
  selected_brand_ids TEXT[] DEFAULT '{}',
  selected_group_ids TEXT[] DEFAULT '{}',
  selected_store_ids TEXT[] DEFAULT '{}',
  selected_department_names TEXT[] DEFAULT '{}',
  metric_type TEXT NOT NULL DEFAULT 'weekly',
  date_period_type TEXT DEFAULT 'month',
  selected_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.enterprise_filters ENABLE ROW LEVEL SECURITY;

-- Users can manage their own filters
CREATE POLICY "Users can manage their own filters"
ON public.enterprise_filters
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_enterprise_filters_user_id ON public.enterprise_filters(user_id);