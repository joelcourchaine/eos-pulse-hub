ALTER TABLE public.scorecard_import_logs
ADD COLUMN IF NOT EXISTS report_file_path text;

COMMENT ON COLUMN public.scorecard_import_logs.report_file_path IS 'Storage path for the original imported report file (bucket: note-attachments)';