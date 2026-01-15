-- Add columns to rocks table for linking to metrics/sub-metrics
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS linked_metric_key TEXT;
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS linked_metric_type TEXT CHECK (linked_metric_type IN ('metric', 'submetric'));
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS linked_submetric_name TEXT;
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS linked_parent_metric_key TEXT;
ALTER TABLE public.rocks ADD COLUMN IF NOT EXISTS target_direction TEXT DEFAULT 'above' CHECK (target_direction IN ('above', 'below'));

-- Create rock_monthly_targets table for storing monthly targets
CREATE TABLE IF NOT EXISTS public.rock_monthly_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rock_id UUID NOT NULL REFERENCES public.rocks(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rock_id, month)
);

-- Enable RLS
ALTER TABLE public.rock_monthly_targets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for rock_monthly_targets
CREATE POLICY "Users can view rock targets for accessible departments"
  ON public.rock_monthly_targets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.rocks r
      JOIN public.departments d ON r.department_id = d.id
      WHERE r.id = rock_monthly_targets.rock_id
      AND (
        d.manager_id = auth.uid()
        OR d.id IN (SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid())
        OR d.store_id IN (SELECT store_id FROM public.get_user_stores(auth.uid()))
      )
    )
  );

CREATE POLICY "Users can insert rock targets for accessible departments"
  ON public.rock_monthly_targets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rocks r
      JOIN public.departments d ON r.department_id = d.id
      WHERE r.id = rock_monthly_targets.rock_id
      AND (
        d.manager_id = auth.uid()
        OR d.id IN (SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid())
        OR d.store_id IN (SELECT store_id FROM public.get_user_stores(auth.uid()))
      )
    )
  );

CREATE POLICY "Users can update rock targets for accessible departments"
  ON public.rock_monthly_targets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.rocks r
      JOIN public.departments d ON r.department_id = d.id
      WHERE r.id = rock_monthly_targets.rock_id
      AND (
        d.manager_id = auth.uid()
        OR d.id IN (SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid())
        OR d.store_id IN (SELECT store_id FROM public.get_user_stores(auth.uid()))
      )
    )
  );

CREATE POLICY "Users can delete rock targets for accessible departments"
  ON public.rock_monthly_targets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.rocks r
      JOIN public.departments d ON r.department_id = d.id
      WHERE r.id = rock_monthly_targets.rock_id
      AND (
        d.manager_id = auth.uid()
        OR d.id IN (SELECT department_id FROM public.user_department_access WHERE user_id = auth.uid())
        OR d.store_id IN (SELECT store_id FROM public.get_user_stores(auth.uid()))
      )
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_rock_monthly_targets_updated_at
  BEFORE UPDATE ON public.rock_monthly_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();