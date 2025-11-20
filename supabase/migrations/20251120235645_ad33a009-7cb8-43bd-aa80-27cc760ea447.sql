-- Add columns for answer descriptions and reference images
ALTER TABLE public.department_questions 
ADD COLUMN answer_description TEXT,
ADD COLUMN reference_image_url TEXT;

-- Update existing questions with helpful descriptions
UPDATE public.department_questions 
SET answer_description = 'Enter the hourly rate charged for Customer Pay labour'
WHERE question_text = 'CP Labour Rate';

UPDATE public.department_questions 
SET answer_description = 'Enter the hourly rate for high-tech diagnostic work'
WHERE question_text = 'CP High Tech Rate';

UPDATE public.department_questions 
SET answer_description = 'Describe your labour rate matrix structure'
WHERE question_text = 'Labour Matrix';

UPDATE public.department_questions 
SET answer_description = 'Specify your operating hours for weekdays (e.g., 7:30 AM - 6:00 PM)'
WHERE question_text = 'Weekdays';