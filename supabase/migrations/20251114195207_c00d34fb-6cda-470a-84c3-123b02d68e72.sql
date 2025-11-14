-- Create brands table
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view brands"
ON public.brands
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage brands"
ON public.brands
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert Hyundai as the first brand
INSERT INTO public.brands (name) VALUES ('Hyundai');

-- Alter stores table to add brand_id foreign key (keep brand text for now for backward compatibility)
ALTER TABLE public.stores ADD COLUMN brand_id uuid REFERENCES public.brands(id);