-- Create top_10_lists table
CREATE TABLE public.top_10_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create top_10_items table
CREATE TABLE public.top_10_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.top_10_lists(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT rank_range CHECK (rank BETWEEN 1 AND 10),
  CONSTRAINT unique_list_rank UNIQUE (list_id, rank)
);

-- Enable RLS
ALTER TABLE public.top_10_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.top_10_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for top_10_lists
CREATE POLICY "Users can view lists in their group"
ON public.top_10_lists
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage their department lists"
ON public.top_10_lists
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'store_gm'::app_role) OR
  department_id IN (
    SELECT department_id FROM get_user_departments(auth.uid())
  )
);

-- RLS policies for top_10_items
CREATE POLICY "Users can view items in their group"
ON public.top_10_items
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    list_id IN (
      SELECT l.id FROM top_10_lists l
      JOIN departments d ON l.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

CREATE POLICY "Managers can manage items in their department lists"
ON public.top_10_items
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'store_gm'::app_role) OR
  list_id IN (
    SELECT l.id FROM top_10_lists l
    WHERE l.department_id IN (
      SELECT department_id FROM get_user_departments(auth.uid())
    )
  )
);

-- Create indexes for performance
CREATE INDEX idx_top_10_lists_department ON public.top_10_lists(department_id);
CREATE INDEX idx_top_10_items_list ON public.top_10_items(list_id);

-- Create updated_at triggers
CREATE TRIGGER update_top_10_lists_updated_at
  BEFORE UPDATE ON public.top_10_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_top_10_items_updated_at
  BEFORE UPDATE ON public.top_10_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();