-- Add brand column to stores table
ALTER TABLE public.stores 
ADD COLUMN brand text;

-- Add a check constraint for valid brand values
ALTER TABLE public.stores
ADD CONSTRAINT stores_brand_check 
CHECK (brand IN ('GMC', 'Chevrolet', 'Other'));