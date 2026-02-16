-- Add KTRV as a brand and update the store currently using 'Other'

-- Insert KTRV into the brands table
INSERT INTO public.brands (name) VALUES ('KTRV')
ON CONFLICT (name) DO NOTHING;

-- Update any stores currently branded as 'Other' that should be KTRV
-- (The KTRV store was temporarily listed under 'Other')
UPDATE public.stores
SET brand = 'KTRV',
    brand_id = (SELECT id FROM public.brands WHERE name = 'KTRV')
WHERE brand = 'Other';
