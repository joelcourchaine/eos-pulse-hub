-- Create routine_templates table (admin-managed master templates)
CREATE TABLE public.routine_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  department_type_id UUID REFERENCES public.department_types(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create department_routines table (department-specific instances)
CREATE TABLE public.department_routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.routine_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create routine_completions table (tracks check-offs per period)
CREATE TABLE public.routine_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID NOT NULL REFERENCES public.department_routines(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(routine_id, item_id, period_start)
);

-- Enable RLS on all tables
ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for routine_templates
CREATE POLICY "All authenticated users can view routine templates"
  ON public.routine_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage routine templates"
  ON public.routine_templates FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for department_routines
CREATE POLICY "Users can view routines in their store group"
  ON public.department_routines FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      department_id IN (
        SELECT d.id FROM departments d
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Managers can manage their department routines"
  ON public.department_routines FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'store_gm'::app_role) OR
    department_id IN (
      SELECT department_id FROM get_user_departments(auth.uid())
    )
  );

-- RLS Policies for routine_completions
CREATE POLICY "Users can view completions in their store group"
  ON public.routine_completions FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role) OR
      routine_id IN (
        SELECT dr.id FROM department_routines dr
        JOIN departments d ON dr.department_id = d.id
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Users can manage completions for accessible routines"
  ON public.routine_completions FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'store_gm'::app_role) OR
    routine_id IN (
      SELECT dr.id FROM department_routines dr
      WHERE dr.department_id IN (
        SELECT department_id FROM get_user_departments(auth.uid())
      )
    )
  );

CREATE POLICY "Users can delete their own completions"
  ON public.routine_completions FOR DELETE
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    completed_by = auth.uid() OR
    routine_id IN (
      SELECT dr.id FROM department_routines dr
      WHERE dr.department_id IN (
        SELECT department_id FROM get_user_departments(auth.uid())
      )
    )
  );

-- Create indexes for performance
CREATE INDEX idx_routine_templates_cadence ON public.routine_templates(cadence);
CREATE INDEX idx_routine_templates_department_type ON public.routine_templates(department_type_id);
CREATE INDEX idx_department_routines_department ON public.department_routines(department_id);
CREATE INDEX idx_department_routines_cadence ON public.department_routines(cadence);
CREATE INDEX idx_routine_completions_routine_period ON public.routine_completions(routine_id, period_start);

-- Create triggers for updated_at
CREATE TRIGGER update_routine_templates_updated_at
  BEFORE UPDATE ON public.routine_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_department_routines_updated_at
  BEFORE UPDATE ON public.department_routines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for routine_completions
ALTER PUBLICATION supabase_realtime ADD TABLE public.routine_completions;