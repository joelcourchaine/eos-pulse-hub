-- Create table for cell-level KPI mappings
CREATE TABLE public.scorecard_cell_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_profile_id UUID NOT NULL REFERENCES public.scorecard_import_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  kpi_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(import_profile_id, row_index, col_index)
);

-- Enable RLS
ALTER TABLE public.scorecard_cell_mappings ENABLE ROW LEVEL SECURITY;

-- Policies: users in same store group can manage mappings
CREATE POLICY "Users can view cell mappings in their store group"
ON public.scorecard_cell_mappings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM scorecard_import_profiles sip
    WHERE sip.id = import_profile_id
    AND (
      sip.store_group_id = public.get_user_store_group(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Users can insert cell mappings in their store group"
ON public.scorecard_cell_mappings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM scorecard_import_profiles sip
    WHERE sip.id = import_profile_id
    AND (
      sip.store_group_id = public.get_user_store_group(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Users can update cell mappings in their store group"
ON public.scorecard_cell_mappings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM scorecard_import_profiles sip
    WHERE sip.id = import_profile_id
    AND (
      sip.store_group_id = public.get_user_store_group(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Users can delete cell mappings in their store group"
ON public.scorecard_cell_mappings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM scorecard_import_profiles sip
    WHERE sip.id = import_profile_id
    AND (
      sip.store_group_id = public.get_user_store_group(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);