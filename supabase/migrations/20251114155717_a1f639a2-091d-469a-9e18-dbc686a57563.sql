-- Create store_groups table
CREATE TABLE public.store_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on store_groups
ALTER TABLE public.store_groups ENABLE ROW LEVEL SECURITY;

-- Create policies for store_groups
CREATE POLICY "Super admins can manage store groups"
ON public.store_groups
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view store groups"
ON public.store_groups
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Add group_id column to stores table
ALTER TABLE public.stores
ADD COLUMN group_id UUID REFERENCES public.store_groups(id) ON DELETE SET NULL;

-- Add trigger for updated_at on store_groups
CREATE TRIGGER update_store_groups_updated_at
BEFORE UPDATE ON public.store_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert the two initial groups
INSERT INTO public.store_groups (name) VALUES
  ('Murray Group'),
  ('The Steve Marshall Group');