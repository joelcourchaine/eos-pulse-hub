-- Create the top_10_list_templates table
CREATE TABLE public.top_10_list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  department_type_id UUID REFERENCES public.department_types(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.top_10_list_templates ENABLE ROW LEVEL SECURITY;

-- Super admins can manage templates
CREATE POLICY "Super admins can manage templates"
ON public.top_10_list_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_top_10_list_templates_updated_at
  BEFORE UPDATE ON public.top_10_list_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();