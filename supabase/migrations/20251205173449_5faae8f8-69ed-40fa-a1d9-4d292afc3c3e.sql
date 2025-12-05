-- Add severity column to issues table
ALTER TABLE public.issues 
ADD COLUMN severity text NOT NULL DEFAULT 'medium';

-- Add severity column to todos table  
ALTER TABLE public.todos 
ADD COLUMN severity text NOT NULL DEFAULT 'medium';