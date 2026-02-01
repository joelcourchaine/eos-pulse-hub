-- Create resource_type enum
CREATE TYPE public.resource_type AS ENUM ('google_doc', 'spreadsheet', 'powerpoint', 'pdf', 'weblink', 'video');

-- Create resource_category enum
CREATE TYPE public.resource_category AS ENUM ('training', 'templates', 'guides', 'best_practices', 'processes', 'reports');

-- Create resources table
CREATE TABLE public.resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  resource_type public.resource_type NOT NULL,
  url TEXT,
  file_path TEXT,
  thumbnail_url TEXT,
  category public.resource_category NOT NULL DEFAULT 'guides',
  tags TEXT[] DEFAULT '{}',
  searchable_content TEXT,
  department_type_id UUID REFERENCES public.department_types(id) ON DELETE SET NULL,
  store_group_id UUID REFERENCES public.store_groups(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Create indexes for search performance
CREATE INDEX idx_resources_searchable ON public.resources USING gin(to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(description, '') || ' ' || COALESCE(searchable_content, '')));
CREATE INDEX idx_resources_category ON public.resources(category);
CREATE INDEX idx_resources_department_type ON public.resources(department_type_id);
CREATE INDEX idx_resources_active ON public.resources(is_active);

-- RLS Policies
-- Anyone authenticated can view active resources (filtered by store group if applicable)
CREATE POLICY "Users can view active resources"
ON public.resources
FOR SELECT
USING (
  is_active = true
  AND (
    store_group_id IS NULL
    OR store_group_id = public.get_current_user_store_group()
  )
);

-- Super admins can manage all resources
CREATE POLICY "Super admins can manage resources"
ON public.resources
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();