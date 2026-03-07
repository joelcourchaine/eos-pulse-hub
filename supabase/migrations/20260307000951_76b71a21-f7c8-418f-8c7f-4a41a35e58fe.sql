
-- Part 1: Backfill existing stores — skip if same store_id+department_type_id OR same store_id+name
INSERT INTO public.departments (name, store_id, department_type_id)
SELECT 
  dt.name,
  s.id AS store_id,
  dt.id AS department_type_id
FROM public.stores s
CROSS JOIN public.department_types dt
WHERE dt.name NOT IN ('Executive Rollup')
AND NOT EXISTS (
  SELECT 1 FROM public.departments d
  WHERE d.store_id = s.id AND d.department_type_id = dt.id
)
AND NOT EXISTS (
  SELECT 1 FROM public.departments d
  WHERE d.store_id = s.id AND lower(d.name) = lower(dt.name)
);

-- Part 2: Function to auto-provision departments for new stores
CREATE OR REPLACE FUNCTION public.auto_provision_departments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.departments (name, store_id, department_type_id)
  SELECT dt.name, NEW.id, dt.id
  FROM public.department_types dt
  WHERE dt.name NOT IN ('Executive Rollup')
  ON CONFLICT (store_id, name) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Part 2: Trigger to fire on new store creation
CREATE TRIGGER auto_provision_departments_on_store_create
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.auto_provision_departments();
