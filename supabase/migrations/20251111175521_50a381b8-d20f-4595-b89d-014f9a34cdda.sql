-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('super_admin', 'store_gm', 'department_manager', 'read_only');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'department_manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create stores table
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

-- Create departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, name)
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create KPI definitions table
CREATE TABLE public.kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('dollar', 'percentage', 'unit', 'text')),
  target_value NUMERIC,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kpi_definitions ENABLE ROW LEVEL SECURITY;

-- Create weekly scorecard data table
CREATE TABLE public.scorecard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  actual_value NUMERIC,
  notes TEXT,
  variance NUMERIC,
  status TEXT CHECK (status IN ('green', 'yellow', 'red')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(kpi_id, week_start_date)
);

ALTER TABLE public.scorecard_entries ENABLE ROW LEVEL SECURITY;

-- Create rocks table (quarterly goals)
CREATE TABLE public.rocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year INTEGER NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'off_track', 'completed')),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rocks ENABLE ROW LEVEL SECURITY;

-- Create to-dos table
CREATE TABLE public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.profiles(id),
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'past_due')),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- Create meeting notes table
CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('segue', 'scorecard', 'rocks', 'headlines', 'todos', 'issues', 'conclude')),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, meeting_date, section)
);

ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id AND role = _role
  )
$$;

-- Create function to get user's department
CREATE OR REPLACE FUNCTION public.get_user_department(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.departments
  WHERE manager_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for stores
CREATE POLICY "All authenticated users can view stores" ON public.stores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Super admins can manage stores" ON public.stores FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

-- RLS Policies for departments
CREATE POLICY "All authenticated users can view departments" ON public.departments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Super admins and GMs can manage departments" ON public.departments FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'store_gm')
);

-- RLS Policies for KPI definitions
CREATE POLICY "Users can view KPI definitions" ON public.kpi_definitions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can edit their department KPIs" ON public.kpi_definitions FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'store_gm') OR
  department_id = public.get_user_department(auth.uid())
);

-- RLS Policies for scorecard entries
CREATE POLICY "Users can view scorecard entries" ON public.scorecard_entries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can edit their scorecard entries" ON public.scorecard_entries FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'store_gm') OR
  EXISTS (
    SELECT 1 FROM public.kpi_definitions kpi
    WHERE kpi.id = scorecard_entries.kpi_id
    AND kpi.department_id = public.get_user_department(auth.uid())
  )
);

-- RLS Policies for rocks
CREATE POLICY "Users can view rocks" ON public.rocks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage their department rocks" ON public.rocks FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'store_gm') OR
  department_id = public.get_user_department(auth.uid())
);

-- RLS Policies for todos
CREATE POLICY "Users can view todos" ON public.todos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage their department todos" ON public.todos FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'store_gm') OR
  department_id = public.get_user_department(auth.uid())
);

-- RLS Policies for meeting notes
CREATE POLICY "Users can view meeting notes" ON public.meeting_notes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Managers can manage their department meeting notes" ON public.meeting_notes FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR 
  public.has_role(auth.uid(), 'store_gm') OR
  department_id = public.get_user_department(auth.uid())
);

-- Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'department_manager'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_stores_updated_at BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpi_definitions_updated_at BEFORE UPDATE ON public.kpi_definitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scorecard_entries_updated_at BEFORE UPDATE ON public.scorecard_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rocks_updated_at BEFORE UPDATE ON public.rocks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON public.todos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_meeting_notes_updated_at BEFORE UPDATE ON public.meeting_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();