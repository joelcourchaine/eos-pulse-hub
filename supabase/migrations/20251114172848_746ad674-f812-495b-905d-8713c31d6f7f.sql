-- Update the stores brand check constraint to allow all brands in the UI
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_brand_check;

ALTER TABLE stores ADD CONSTRAINT stores_brand_check 
CHECK (brand = ANY (ARRAY['GMC'::text, 'Chevrolet'::text, 'Stellantis'::text, 'Nissan'::text, 'Ford'::text, 'Mazda'::text, 'Honda'::text, 'Other'::text]));