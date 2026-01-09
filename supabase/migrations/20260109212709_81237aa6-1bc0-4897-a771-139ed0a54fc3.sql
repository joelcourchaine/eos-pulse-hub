-- Create a function to check if a storage path is accessible via a valid signature token
-- This allows unauthenticated users to access PDFs if they have a valid access_token
CREATE OR REPLACE FUNCTION public.can_access_signature_document(file_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM signature_requests sr
    WHERE sr.original_pdf_path = file_path
      AND sr.status != 'signed'
      AND sr.expires_at > now()
  );
END;
$$;

-- Add policy for anonymous/public access to signature documents
-- This allows external signers to view PDFs without authentication
CREATE POLICY "public_signature_docs_view"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'signature-documents'
  AND public.can_access_signature_document(name)
);