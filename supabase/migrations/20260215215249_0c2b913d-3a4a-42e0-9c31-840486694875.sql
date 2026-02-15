
-- ============================================================
-- Process Categories (lookup / seed)
-- ============================================================
CREATE TABLE public.process_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view process categories"
  ON public.process_categories FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage process categories"
  ON public.process_categories FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.process_categories (name, display_order) VALUES
  ('Serve the Customer', 1),
  ('Run the Department', 2),
  ('Grow the Business', 3);

-- ============================================================
-- Processes
-- ============================================================
CREATE TABLE public.processes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.process_categories(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view processes in their store group"
  ON public.processes FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR department_id IN (
        SELECT d.id FROM departments d
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Managers can manage processes"
  ON public.processes FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'store_gm'::app_role)
    OR department_id IN (
      SELECT department_id FROM get_user_departments(auth.uid())
    )
  );

-- ============================================================
-- Process Stages
-- ============================================================
CREATE TABLE public.process_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id uuid NOT NULL REFERENCES public.processes(id) ON DELETE CASCADE,
  title text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stages in their store group"
  ON public.process_stages FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR process_id IN (
        SELECT p.id FROM processes p
        JOIN departments d ON p.department_id = d.id
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Managers can manage stages"
  ON public.process_stages FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'store_gm'::app_role)
    OR process_id IN (
      SELECT p.id FROM processes p
      WHERE p.department_id IN (
        SELECT department_id FROM get_user_departments(auth.uid())
      )
    )
  );

-- ============================================================
-- Process Steps
-- ============================================================
CREATE TABLE public.process_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stage_id uuid NOT NULL REFERENCES public.process_stages(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  definition_of_done text,
  owner_role text,
  estimated_minutes integer,
  display_order integer NOT NULL DEFAULT 0,
  is_sub_process boolean NOT NULL DEFAULT false,
  parent_step_id uuid REFERENCES public.process_steps(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps in their store group"
  ON public.process_steps FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR stage_id IN (
        SELECT ps.id FROM process_stages ps
        JOIN processes p ON ps.process_id = p.id
        JOIN departments d ON p.department_id = d.id
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Managers can manage steps"
  ON public.process_steps FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'store_gm'::app_role)
    OR stage_id IN (
      SELECT ps.id FROM process_stages ps
      JOIN processes p ON ps.process_id = p.id
      WHERE p.department_id IN (
        SELECT department_id FROM get_user_departments(auth.uid())
      )
    )
  );

-- ============================================================
-- Process Step Attachments
-- ============================================================
CREATE TABLE public.process_step_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id uuid NOT NULL REFERENCES public.process_steps(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.process_step_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in their store group"
  ON public.process_step_attachments FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR step_id IN (
        SELECT pst.id FROM process_steps pst
        JOIN process_stages ps ON pst.stage_id = ps.id
        JOIN processes p ON ps.process_id = p.id
        JOIN departments d ON p.department_id = d.id
        JOIN stores s ON d.store_id = s.id
        WHERE s.group_id = get_user_store_group(auth.uid())
      )
    )
  );

CREATE POLICY "Managers can manage attachments"
  ON public.process_step_attachments FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'store_gm'::app_role)
    OR step_id IN (
      SELECT pst.id FROM process_steps pst
      JOIN process_stages ps ON pst.stage_id = ps.id
      JOIN processes p ON ps.process_id = p.id
      WHERE p.department_id IN (
        SELECT department_id FROM get_user_departments(auth.uid())
      )
    )
  );

-- ============================================================
-- Storage Bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('process-attachments', 'process-attachments', false);

CREATE POLICY "Users can view process attachments in their group"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'process-attachments' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Managers can upload process attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'process-attachments' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Managers can delete process attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'process-attachments' AND auth.uid() IS NOT NULL
  );

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE TRIGGER update_processes_updated_at
  BEFORE UPDATE ON public.processes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_stages_updated_at
  BEFORE UPDATE ON public.process_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_process_steps_updated_at
  BEFORE UPDATE ON public.process_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
