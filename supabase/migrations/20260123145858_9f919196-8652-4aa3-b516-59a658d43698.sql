-- Add column to store the last uploaded report path per import profile
ALTER TABLE scorecard_import_profiles 
ADD COLUMN IF NOT EXISTS last_mapper_report_path TEXT DEFAULT NULL;