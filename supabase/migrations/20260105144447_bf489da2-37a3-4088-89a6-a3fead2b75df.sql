-- Create mandatory_kpi_rules table
CREATE TABLE public.mandatory_kpi_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_kpi_id UUID NOT NULL REFERENCES public.preset_kpis(id) ON DELETE CASCADE,
  store_group_id UUID NOT NULL REFERENCES public.store_groups(id) ON DELETE CASCADE,
  department_type_id UUID NOT NULL REFERENCES public.department_types(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(preset_kpi_id, store_group_id, department_type_id)
);

-- Enable RLS
ALTER TABLE public.mandatory_kpi_rules ENABLE ROW LEVEL SECURITY;

-- Super admins can manage mandatory KPI rules
CREATE POLICY "Super admins can manage mandatory KPI rules"
  ON public.mandatory_kpi_rules FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- All authenticated users can view rules
CREATE POLICY "Users can view mandatory KPI rules"
  ON public.mandatory_kpi_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_mandatory_kpi_rules_updated_at
  BEFORE UPDATE ON public.mandatory_kpi_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();