-- Create department_forecasts table
CREATE TABLE public.department_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  forecast_year integer NOT NULL,
  name text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(department_id, forecast_year)
);

-- Create forecast_entries table
CREATE TABLE public.forecast_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.department_forecasts(id) ON DELETE CASCADE,
  month text NOT NULL,
  metric_name text NOT NULL,
  baseline_value numeric,
  forecast_value numeric,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(forecast_id, month, metric_name)
);

-- Create forecast_weights table
CREATE TABLE public.forecast_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES public.department_forecasts(id) ON DELETE CASCADE,
  month_number integer NOT NULL CHECK (month_number >= 1 AND month_number <= 12),
  original_weight numeric NOT NULL DEFAULT 0,
  adjusted_weight numeric NOT NULL DEFAULT 0,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(forecast_id, month_number)
);

-- Enable RLS
ALTER TABLE public.department_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_weights ENABLE ROW LEVEL SECURITY;

-- RLS for department_forecasts
CREATE POLICY "Users can view forecasts in their group"
ON public.department_forecasts
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage their department forecasts"
ON public.department_forecasts
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'store_gm') OR
  department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
);

-- RLS for forecast_entries
CREATE POLICY "Users can view forecast entries in their group"
ON public.forecast_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    forecast_id IN (
      SELECT df.id FROM department_forecasts df
      JOIN departments d ON df.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage forecast entries"
ON public.forecast_entries
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'store_gm') OR
  forecast_id IN (
    SELECT df.id FROM department_forecasts df
    WHERE df.department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
  )
);

-- RLS for forecast_weights
CREATE POLICY "Users can view forecast weights in their group"
ON public.forecast_weights
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    forecast_id IN (
      SELECT df.id FROM department_forecasts df
      JOIN departments d ON df.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage forecast weights"
ON public.forecast_weights
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR
  has_role(auth.uid(), 'store_gm') OR
  forecast_id IN (
    SELECT df.id FROM department_forecasts df
    WHERE df.department_id IN (SELECT department_id FROM get_user_departments(auth.uid()))
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_department_forecasts_updated_at
BEFORE UPDATE ON public.department_forecasts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forecast_entries_updated_at
BEFORE UPDATE ON public.forecast_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_forecast_weights_updated_at
BEFORE UPDATE ON public.forecast_weights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();