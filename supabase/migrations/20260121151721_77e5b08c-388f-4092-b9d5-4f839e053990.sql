-- Create scorecard import profiles table
CREATE TABLE public.scorecard_import_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_group_id UUID REFERENCES public.store_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role_type TEXT NOT NULL DEFAULT 'service_advisor',
  parser_type TEXT NOT NULL DEFAULT 'csr_productivity',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scorecard import mappings table
CREATE TABLE public.scorecard_import_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  import_profile_id UUID NOT NULL REFERENCES public.scorecard_import_profiles(id) ON DELETE CASCADE,
  source_column TEXT NOT NULL,
  pay_type_filter TEXT, -- NULL = total, "Customer", "Warranty", "Internal"
  target_kpi_name TEXT NOT NULL,
  is_per_user BOOLEAN NOT NULL DEFAULT false,
  metric_type TEXT NOT NULL DEFAULT 'unit',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create scorecard user aliases table
CREATE TABLE public.scorecard_user_aliases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, alias_name)
);

-- Create scorecard import logs table
CREATE TABLE public.scorecard_import_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  imported_by UUID REFERENCES public.profiles(id),
  import_source TEXT NOT NULL DEFAULT 'drop_zone',
  file_name TEXT NOT NULL,
  month TEXT NOT NULL,
  metrics_imported JSONB DEFAULT '{}',
  user_mappings JSONB DEFAULT '{}',
  unmatched_users TEXT[] DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.scorecard_import_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_import_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_user_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scorecard_import_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for scorecard_import_profiles
CREATE POLICY "All authenticated users can view import profiles"
  ON public.scorecard_import_profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage import profiles"
  ON public.scorecard_import_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS policies for scorecard_import_mappings
CREATE POLICY "All authenticated users can view import mappings"
  ON public.scorecard_import_mappings FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage import mappings"
  ON public.scorecard_import_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- RLS policies for scorecard_user_aliases
CREATE POLICY "Users can view aliases for accessible stores"
  ON public.scorecard_user_aliases FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage all aliases"
  ON public.scorecard_user_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Store GMs can manage aliases for their stores"
  ON public.scorecard_user_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'store_gm' AND store_id = scorecard_user_aliases.store_id)
    )
  );

-- RLS policies for scorecard_import_logs
CREATE POLICY "Users can view import logs"
  ON public.scorecard_import_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create import logs"
  ON public.scorecard_import_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage import logs"
  ON public.scorecard_import_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Add updated_at trigger for profiles table
CREATE TRIGGER update_scorecard_import_profiles_updated_at
  BEFORE UPDATE ON public.scorecard_import_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_scorecard_import_profiles_store_group ON public.scorecard_import_profiles(store_group_id);
CREATE INDEX idx_scorecard_import_mappings_profile ON public.scorecard_import_mappings(import_profile_id);
CREATE INDEX idx_scorecard_user_aliases_store ON public.scorecard_user_aliases(store_id);
CREATE INDEX idx_scorecard_user_aliases_user ON public.scorecard_user_aliases(user_id);
CREATE INDEX idx_scorecard_import_logs_department ON public.scorecard_import_logs(department_id);
CREATE INDEX idx_scorecard_import_logs_store ON public.scorecard_import_logs(store_id);