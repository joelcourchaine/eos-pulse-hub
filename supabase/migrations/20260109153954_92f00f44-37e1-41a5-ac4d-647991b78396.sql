-- Create enum for signature request status
CREATE TYPE public.signature_status AS ENUM ('pending', 'viewed', 'signed', 'expired');

-- Create signature_requests table
CREATE TABLE public.signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  original_pdf_path TEXT NOT NULL,
  signed_pdf_path TEXT,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status signature_status NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create signature_spots table
CREATE TABLE public.signature_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL DEFAULT 1,
  x_position FLOAT NOT NULL,
  y_position FLOAT NOT NULL,
  width FLOAT NOT NULL DEFAULT 200,
  height FLOAT NOT NULL DEFAULT 80,
  label TEXT DEFAULT 'Sign here',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_spots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for signature_requests

-- Super admins can do everything
CREATE POLICY "super_admin_all_signature_requests"
ON public.signature_requests
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Signers can view requests assigned to them
CREATE POLICY "signer_view_own_requests"
ON public.signature_requests
FOR SELECT
TO authenticated
USING (signer_id = auth.uid());

-- Signers can update their own requests (to mark as signed)
CREATE POLICY "signer_update_own_requests"
ON public.signature_requests
FOR UPDATE
TO authenticated
USING (signer_id = auth.uid())
WITH CHECK (signer_id = auth.uid());

-- RLS Policies for signature_spots

-- Super admins can do everything
CREATE POLICY "super_admin_all_signature_spots"
ON public.signature_spots
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = request_id
    AND public.has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = request_id
    AND public.has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Signers can view spots for their requests
CREATE POLICY "signer_view_spots"
ON public.signature_spots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = request_id
    AND sr.signer_id = auth.uid()
  )
);

-- Add updated_at trigger
CREATE TRIGGER update_signature_requests_updated_at
  BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_signature_requests_store ON public.signature_requests(store_id);
CREATE INDEX idx_signature_requests_signer ON public.signature_requests(signer_id);
CREATE INDEX idx_signature_requests_status ON public.signature_requests(status);
CREATE INDEX idx_signature_spots_request ON public.signature_spots(request_id);

-- Create storage bucket for signature documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('signature-documents', 'signature-documents', false);

-- Storage policies for signature-documents bucket

-- Super admins can do everything
CREATE POLICY "super_admin_signature_docs_all"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'signature-documents' AND public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (bucket_id = 'signature-documents' AND public.has_role(auth.uid(), 'super_admin'::app_role));

-- Signers can view documents they need to sign
CREATE POLICY "signer_view_signature_docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'signature-documents'
  AND EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.signer_id = auth.uid()
    AND (sr.original_pdf_path = name OR sr.signed_pdf_path = name)
  )
);

-- Signers can upload signed documents
CREATE POLICY "signer_upload_signed_docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signature-documents'
  AND EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.signer_id = auth.uid()
    AND sr.status IN ('pending', 'viewed')
  )
);