-- Create question categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.question_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (will do nothing if already enabled)
ALTER TABLE public.question_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view question categories" ON public.question_categories;
DROP POLICY IF EXISTS "Super admins can manage question categories" ON public.question_categories;

-- Allow everyone to view categories
CREATE POLICY "Users can view question categories"
ON public.question_categories
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Allow super admins to manage categories
CREATE POLICY "Super admins can manage question categories"
ON public.question_categories
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));