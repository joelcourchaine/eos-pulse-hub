-- Make week_start_date nullable for monthly entries
ALTER TABLE scorecard_entries 
ALTER COLUMN week_start_date DROP NOT NULL;