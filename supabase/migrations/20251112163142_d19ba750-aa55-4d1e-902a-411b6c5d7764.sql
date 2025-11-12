-- Create department types table for predefined department options
CREATE TABLE public.department_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on department_types
ALTER TABLE public.department_types ENABLE ROW LEVEL SECURITY;

-- Department types are viewable by all authenticated users
CREATE POLICY "Authenticated users can view department types"
ON public.department_types
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only super admins can manage department types
CREATE POLICY "Super admins can manage department types"
ON public.department_types
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add department_type_id to departments table
ALTER TABLE public.departments
ADD COLUMN department_type_id UUID REFERENCES public.department_types(id);

-- Create index for department type (others already exist)
CREATE INDEX idx_departments_type_id ON public.departments(department_type_id);

-- Insert predefined department types
INSERT INTO public.department_types (name, description, display_order) VALUES
  ('Parts Department', 'Parts inventory and sales management', 1),
  ('Service Department', 'Service and maintenance operations', 2),
  ('Technician Production', 'Technician productivity and efficiency tracking', 3),
  ('New Vehicles', 'New vehicle sales and inventory', 4),
  ('Used Vehicles', 'Used vehicle sales and inventory', 5),
  ('Vehicle Sales', 'Overall vehicle sales operations', 6),
  ('Executive Rollup', 'Executive-level consolidated metrics', 7);

-- Add trigger for department_types updated_at
CREATE TRIGGER update_department_types_updated_at
BEFORE UPDATE ON public.department_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();