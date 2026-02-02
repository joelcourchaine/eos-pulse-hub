-- Create resource-thumbnails bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resource-thumbnails', 'resource-thumbnails', true);

-- RLS policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload resource thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'resource-thumbnails');

-- RLS policy: Allow anyone to view (public bucket)
CREATE POLICY "Anyone can view resource thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resource-thumbnails');

-- RLS policy: Allow authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete resource thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'resource-thumbnails');