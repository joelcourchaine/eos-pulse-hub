-- Add birthday and start date fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS birthday_month INTEGER CHECK (birthday_month >= 1 AND birthday_month <= 12),
ADD COLUMN IF NOT EXISTS birthday_day INTEGER CHECK (birthday_day >= 1 AND birthday_day <= 31),
ADD COLUMN IF NOT EXISTS start_month INTEGER CHECK (start_month >= 1 AND start_month <= 12),
ADD COLUMN IF NOT EXISTS start_day INTEGER CHECK (start_day >= 1 AND start_day <= 31);

-- Update the handle_new_user function to save these fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role,
    birthday_month,
    birthday_day,
    start_month,
    start_day
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'department_manager',
    (NEW.raw_user_meta_data->>'birthday_month')::INTEGER,
    (NEW.raw_user_meta_data->>'birthday_day')::INTEGER,
    (NEW.raw_user_meta_data->>'start_month')::INTEGER,
    (NEW.raw_user_meta_data->>'start_day')::INTEGER
  );
  RETURN NEW;
END;
$function$;