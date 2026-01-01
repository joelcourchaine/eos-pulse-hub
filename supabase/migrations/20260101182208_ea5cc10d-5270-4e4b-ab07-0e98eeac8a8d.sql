-- Create table for forecast sub-metric notes
CREATE TABLE public.forecast_submetric_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  forecast_year INTEGER NOT NULL,
  sub_metric_key TEXT NOT NULL,
  parent_metric_key TEXT NOT NULL,
  note TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  UNIQUE(department_id, forecast_year, sub_metric_key)
);

-- Enable RLS
ALTER TABLE public.forecast_submetric_notes ENABLE ROW LEVEL SECURITY;

-- Create policies (users can view/edit notes for departments they have access to)
CREATE POLICY "Users can view forecast submetric notes"
ON public.forecast_submetric_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_department_access uda
    WHERE uda.department_id = forecast_submetric_notes.department_id
    AND uda.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM departments d
    JOIN stores s ON s.id = d.store_id
    JOIN profiles p ON p.store_id = s.id OR p.store_group_id = s.group_id
    WHERE d.id = forecast_submetric_notes.department_id
    AND p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

CREATE POLICY "Users can insert forecast submetric notes"
ON public.forecast_submetric_notes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_department_access uda
    WHERE uda.department_id = forecast_submetric_notes.department_id
    AND uda.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM departments d
    JOIN stores s ON s.id = d.store_id
    JOIN profiles p ON p.store_id = s.id OR p.store_group_id = s.group_id
    WHERE d.id = forecast_submetric_notes.department_id
    AND p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

CREATE POLICY "Users can update forecast submetric notes"
ON public.forecast_submetric_notes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_department_access uda
    WHERE uda.department_id = forecast_submetric_notes.department_id
    AND uda.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM departments d
    JOIN stores s ON s.id = d.store_id
    JOIN profiles p ON p.store_id = s.id OR p.store_group_id = s.group_id
    WHERE d.id = forecast_submetric_notes.department_id
    AND p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

CREATE POLICY "Users can delete forecast submetric notes"
ON public.forecast_submetric_notes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_department_access uda
    WHERE uda.department_id = forecast_submetric_notes.department_id
    AND uda.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM departments d
    JOIN stores s ON s.id = d.store_id
    JOIN profiles p ON p.store_id = s.id OR p.store_group_id = s.group_id
    WHERE d.id = forecast_submetric_notes.department_id
    AND p.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_forecast_submetric_notes_updated_at
BEFORE UPDATE ON public.forecast_submetric_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();