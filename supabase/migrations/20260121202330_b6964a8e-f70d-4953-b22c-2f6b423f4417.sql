-- Drop the table that was partially created
DROP TABLE IF EXISTS public.scorecard_column_templates;

-- Create table for column-to-KPI templates at the import profile level
CREATE TABLE public.scorecard_column_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_profile_id UUID NOT NULL REFERENCES public.scorecard_import_profiles(id) ON DELETE CASCADE,
  col_index INTEGER NOT NULL,
  kpi_name TEXT NOT NULL,
  pay_type_filter TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT unique_profile_column_kpi UNIQUE(import_profile_id, col_index, kpi_name)
);

-- Enable RLS
ALTER TABLE public.scorecard_column_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies - using store_group_id from scorecard_import_profiles
CREATE POLICY "Users can view column templates for their store group's profiles"
ON public.scorecard_column_templates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.scorecard_import_profiles sip
    WHERE sip.id = import_profile_id
    AND (
      sip.store_group_id = public.get_user_store_group(auth.uid())
      OR public.has_role(auth.uid(), 'super_admin')
    )
  )
);

CREATE POLICY "Managers can insert column templates"
ON public.scorecard_column_templates
FOR INSERT
WITH CHECK (
  public.is_manager_or_above(auth.uid())
);

CREATE POLICY "Managers can update column templates"
ON public.scorecard_column_templates
FOR UPDATE
USING (
  public.is_manager_or_above(auth.uid())
);

CREATE POLICY "Managers can delete column templates"
ON public.scorecard_column_templates
FOR DELETE
USING (
  public.is_manager_or_above(auth.uid())
);

-- Add index for efficient lookups
CREATE INDEX idx_column_templates_profile ON public.scorecard_column_templates(import_profile_id);

-- Add comment for documentation
COMMENT ON TABLE public.scorecard_column_templates IS 'Stores column-to-KPI mappings at the profile level for automatic inheritance when linking new advisors';