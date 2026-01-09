-- Add columns for external signers (no account required)
ALTER TABLE public.signature_requests 
ADD COLUMN signer_email text,
ADD COLUMN signer_name text,
ADD COLUMN access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- Make signer_id nullable for external signers
ALTER TABLE public.signature_requests 
ALTER COLUMN signer_id DROP NOT NULL;

-- Create index on access_token for fast lookups
CREATE INDEX idx_signature_requests_access_token ON public.signature_requests(access_token);

-- Create a function to get signature request by token (bypasses RLS for public access)
CREATE OR REPLACE FUNCTION public.get_signature_request_by_token(p_token uuid)
RETURNS TABLE (
  id uuid,
  title text,
  message text,
  original_pdf_path text,
  signed_pdf_path text,
  status public.signature_status,
  signer_email text,
  signer_name text,
  expires_at timestamptz,
  created_at timestamptz,
  store_id uuid
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sr.id,
    sr.title,
    sr.message,
    sr.original_pdf_path,
    sr.signed_pdf_path,
    sr.status,
    sr.signer_email,
    sr.signer_name,
    sr.expires_at,
    sr.created_at,
    sr.store_id
  FROM public.signature_requests sr
  WHERE sr.access_token = p_token;
END;
$$;

-- Create a function to get signature spots by request id (for use with token-based access)
CREATE OR REPLACE FUNCTION public.get_signature_spots_by_request(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  page_number int,
  x_position numeric,
  y_position numeric,
  width numeric,
  height numeric,
  label text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.page_number,
    ss.x_position,
    ss.y_position,
    ss.width,
    ss.height,
    ss.label
  FROM public.signature_spots ss
  WHERE ss.request_id = p_request_id;
END;
$$;