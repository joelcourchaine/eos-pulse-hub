-- Add domain column to store_groups for branded domain routing
ALTER TABLE public.store_groups ADD COLUMN domain text UNIQUE;

UPDATE public.store_groups SET domain = 'https://murraygrowth.ca'
  WHERE id = 'c386eaed-1b72-48a0-8fcd-506ae24ed13f';

UPDATE public.store_groups SET domain = 'https://smggrowth.ca'
  WHERE id = '9fc8d816-7659-4b4b-9103-239901e69a25';
