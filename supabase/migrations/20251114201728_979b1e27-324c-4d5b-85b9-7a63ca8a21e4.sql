-- Function to create default financial targets for a new department
CREATE OR REPLACE FUNCTION public.create_default_financial_targets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  metric RECORD;
  quarter_num INTEGER;
BEGIN
  -- Define default metrics (matching the GMC_CHEVROLET_METRICS)
  FOR metric IN 
    SELECT * FROM (VALUES
      ('total_sales', 'above'),
      ('gp_net', 'above'),
      ('gp_percent', 'above'),
      ('personnel_expense', 'below'),
      ('personnel_expense_percent', 'below'),
      ('total_semi_fixed_expense', 'below'),
      ('total_semi_fixed_expense_percent', 'below'),
      ('total_fixed_expense', 'below'),
      ('department_profit', 'above'),
      ('parts_transfer', 'above'),
      ('net', 'above')
    ) AS t(metric_name, direction)
  LOOP
    -- Create targets for all 4 quarters of the current year
    FOR quarter_num IN 1..4 LOOP
      INSERT INTO public.financial_targets (
        department_id,
        metric_name,
        quarter,
        year,
        target_value,
        target_direction
      ) VALUES (
        NEW.id,
        metric.metric_name,
        quarter_num,
        current_year,
        0, -- Default target value of 0
        metric.direction
      );
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create financial targets when a department is added
DROP TRIGGER IF EXISTS create_financial_targets_on_department_insert ON public.departments;
CREATE TRIGGER create_financial_targets_on_department_insert
  AFTER INSERT ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_financial_targets();