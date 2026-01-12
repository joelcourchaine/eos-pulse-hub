-- Security fix: Make sensitive storage buckets private
-- This ensures that files can only be accessed via signed URLs,
-- enforcing proper authentication and RLS policies.
-- 
-- store-logos remains public (acceptable for non-sensitive branding assets)

-- Change note-attachments to private
-- Contains: meeting notes, screenshots, issue attachments
UPDATE storage.buckets 
SET public = false 
WHERE id = 'note-attachments';

-- Change financial-attachments to private
-- Contains: Excel files with sensitive financial data
UPDATE storage.buckets 
SET public = false 
WHERE id = 'financial-attachments';