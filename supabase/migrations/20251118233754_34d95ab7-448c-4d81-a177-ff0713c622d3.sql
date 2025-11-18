-- Create director_notes table
CREATE TABLE public.director_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_date TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.director_notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view director notes"
ON public.director_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Store GMs and super admins can manage director notes"
ON public.director_notes
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'store_gm'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'store_gm'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_director_notes_updated_at
BEFORE UPDATE ON public.director_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_director_notes_department_period ON public.director_notes(department_id, period_type, period_date);