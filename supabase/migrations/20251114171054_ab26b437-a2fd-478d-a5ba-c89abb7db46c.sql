-- Add notes column to financial_entries table
ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS notes TEXT;