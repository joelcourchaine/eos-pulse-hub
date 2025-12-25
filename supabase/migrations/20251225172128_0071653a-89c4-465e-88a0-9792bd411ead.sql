-- Create storage bucket for financial attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-attachments', 'financial-attachments', true);

-- Storage policies for financial-attachments bucket
CREATE POLICY "Authenticated users can upload financial attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'financial-attachments');

CREATE POLICY "Authenticated users can view financial attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'financial-attachments');

CREATE POLICY "Authenticated users can delete their financial attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'financial-attachments');

-- Create table to track financial attachments
CREATE TABLE public.financial_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  month_identifier TEXT NOT NULL, -- e.g., "2024-01"
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- "excel", "pdf", "csv"
  file_size BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view financial attachments in their group"
ON public.financial_attachments
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

CREATE POLICY "Managers can manage financial attachments"
ON public.financial_attachments
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR
  has_role(auth.uid(), 'store_gm'::app_role) OR
  department_id IN (
    SELECT department_id FROM get_user_departments(auth.uid())
  )
);

-- Add unique constraint to prevent duplicate attachments for same month
ALTER TABLE public.financial_attachments 
ADD CONSTRAINT unique_department_month UNIQUE (department_id, month_identifier);