-- Create storage bucket for note attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-attachments', 'note-attachments', true);

-- Create RLS policies for note attachments
CREATE POLICY "Authenticated users can upload note attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'note-attachments');

CREATE POLICY "Authenticated users can view note attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'note-attachments');

CREATE POLICY "Users can update their own note attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'note-attachments');

CREATE POLICY "Users can delete their own note attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'note-attachments');