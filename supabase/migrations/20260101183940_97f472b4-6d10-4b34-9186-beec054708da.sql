-- Create table to store forecast driver settings
CREATE TABLE public.forecast_driver_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.department_forecasts(id) ON DELETE CASCADE,
  growth_percent numeric DEFAULT 0,
  sales_expense numeric,
  fixed_expense numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(forecast_id)
);

-- Create table to store sub-metric overrides
CREATE TABLE public.forecast_submetric_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.department_forecasts(id) ON DELETE CASCADE,
  sub_metric_key text NOT NULL,
  parent_metric_key text NOT NULL,
  overridden_annual_value numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(forecast_id, sub_metric_key)
);

-- Enable RLS
ALTER TABLE public.forecast_driver_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_submetric_overrides ENABLE ROW LEVEL SECURITY;

-- RLS policies for forecast_driver_settings
CREATE POLICY "Managers can manage forecast driver settings"
ON public.forecast_driver_settings
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'store_gm'::app_role) OR 
  (forecast_id IN (
    SELECT df.id FROM department_forecasts df
    WHERE df.department_id IN (
      SELECT department_id FROM get_user_departments(auth.uid())
    )
  ))
);

CREATE POLICY "Users can view forecast driver settings in their group"
ON public.forecast_driver_settings
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    forecast_id IN (
      SELECT df.id FROM department_forecasts df
      JOIN departments d ON df.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- RLS policies for forecast_submetric_overrides
CREATE POLICY "Managers can manage forecast submetric overrides"
ON public.forecast_submetric_overrides
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'store_gm'::app_role) OR 
  (forecast_id IN (
    SELECT df.id FROM department_forecasts df
    WHERE df.department_id IN (
      SELECT department_id FROM get_user_departments(auth.uid())
    )
  ))
);

CREATE POLICY "Users can view forecast submetric overrides in their group"
ON public.forecast_submetric_overrides
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    forecast_id IN (
      SELECT df.id FROM department_forecasts df
      JOIN departments d ON df.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_forecast_driver_settings_updated_at
BEFORE UPDATE ON public.forecast_driver_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forecast_submetric_overrides_updated_at
BEFORE UPDATE ON public.forecast_submetric_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();