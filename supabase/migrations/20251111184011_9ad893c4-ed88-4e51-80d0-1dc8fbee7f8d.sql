-- Add columns to support monthly entries in addition to weekly entries
ALTER TABLE scorecard_entries 
ADD COLUMN entry_type text DEFAULT 'weekly' CHECK (entry_type IN ('weekly', 'monthly')),
ADD COLUMN month text;

-- Add index for monthly queries
CREATE INDEX idx_scorecard_entries_month ON scorecard_entries(month) WHERE month IS NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN scorecard_entries.entry_type IS 'Type of entry: weekly (week_start_date) or monthly (month in YYYY-MM format)';
COMMENT ON COLUMN scorecard_entries.month IS 'Month identifier in YYYY-MM format for monthly entries';
