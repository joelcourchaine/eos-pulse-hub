-- Create storage bucket for store logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-logos', 'store-logos', true);

-- Add logo_url column to stores table
ALTER TABLE public.stores
ADD COLUMN logo_url TEXT;

-- Storage policies for store logos
CREATE POLICY "Store logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'store-logos');

CREATE POLICY "Admins can upload store logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'store-logos' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role)
  )
);

CREATE POLICY "Admins can update store logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'store-logos' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role)
  )
);

CREATE POLICY "Admins can delete store logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'store-logos' 
  AND (
    has_role(auth.uid(), 'super_admin'::app_role) 
    OR has_role(auth.uid(), 'store_gm'::app_role)
  )
);