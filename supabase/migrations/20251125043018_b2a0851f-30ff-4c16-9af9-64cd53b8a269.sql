-- Create preset KPIs table
CREATE TABLE IF NOT EXISTS public.preset_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('dollar', 'percentage', 'unit')),
  target_direction TEXT NOT NULL DEFAULT 'above' CHECK (target_direction IN ('above', 'below')),
  dependencies TEXT[] DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name)
);

-- Enable RLS
ALTER TABLE public.preset_kpis ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view preset KPIs
CREATE POLICY "Anyone can view preset KPIs"
ON public.preset_kpis
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only super admins can manage preset KPIs
CREATE POLICY "Super admins can manage preset KPIs"
ON public.preset_kpis
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Insert existing preset KPIs
INSERT INTO public.preset_kpis (name, metric_type, target_direction, dependencies, display_order) VALUES
  ('Total Hours', 'unit', 'above', '{}', 1),
  ('Total ELR', 'dollar', 'above', '{}', 2),
  ('Total Labour Sales', 'dollar', 'above', '{}', 3),
  ('CP Labour Sales', 'dollar', 'above', '{}', 4),
  ('Warranty Labour Sales', 'dollar', 'above', '{}', 5),
  ('Internal Labour Sales', 'dollar', 'above', '{}', 6),
  ('Total Service Gross', 'dollar', 'above', '{}', 7),
  ('Total Service Gross %', 'percentage', 'above', ARRAY['Total Service Gross'], 8),
  ('CP Hours', 'unit', 'above', '{}', 9),
  ('CP RO''s', 'unit', 'above', '{}', 10),
  ('CP Labour Sales Per RO', 'dollar', 'above', ARRAY['CP Labour Sales', 'CP RO''s'], 11),
  ('CP Hours Per RO', 'unit', 'above', '{}', 12),
  ('CP ELR', 'dollar', 'above', '{}', 13);

-- Add trigger for updated_at
CREATE TRIGGER update_preset_kpis_updated_at
  BEFORE UPDATE ON public.preset_kpis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();