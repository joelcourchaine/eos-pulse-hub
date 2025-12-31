-- Create table to track copied month metadata
CREATE TABLE public.financial_copy_metadata (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  target_month TEXT NOT NULL,
  source_identifier TEXT NOT NULL,
  source_label TEXT,
  copied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  copied_by UUID REFERENCES auth.users(id),
  UNIQUE(department_id, target_month)
);

-- Enable RLS
ALTER TABLE public.financial_copy_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies matching financial_entries access patterns
CREATE POLICY "Users can view copy metadata for their departments"
ON public.financial_copy_metadata
FOR SELECT
USING (
  department_id IN (
    SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'super_admin'
      OR (p.role = 'store_gm' AND p.store_id IN (
        SELECT store_id FROM public.departments WHERE id = department_id
      ))
    )
  )
);

CREATE POLICY "Users can insert copy metadata for their departments"
ON public.financial_copy_metadata
FOR INSERT
WITH CHECK (
  department_id IN (
    SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'super_admin'
      OR (p.role = 'store_gm' AND p.store_id IN (
        SELECT store_id FROM public.departments WHERE id = department_id
      ))
    )
  )
);

CREATE POLICY "Users can update copy metadata for their departments"
ON public.financial_copy_metadata
FOR UPDATE
USING (
  department_id IN (
    SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'super_admin'
      OR (p.role = 'store_gm' AND p.store_id IN (
        SELECT store_id FROM public.departments WHERE id = department_id
      ))
    )
  )
);

CREATE POLICY "Users can delete copy metadata for their departments"
ON public.financial_copy_metadata
FOR DELETE
USING (
  department_id IN (
    SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      p.role = 'super_admin'
      OR (p.role = 'store_gm' AND p.store_id IN (
        SELECT store_id FROM public.departments WHERE id = department_id
      ))
    )
  )
);