-- Change start_day to start_year
ALTER TABLE profiles 
DROP COLUMN IF EXISTS start_day,
ADD COLUMN IF NOT EXISTS start_year INTEGER CHECK (start_year >= 1950 AND start_year <= 2100);

-- Update the handle_new_user function to save start_year instead of start_day
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
    start_year
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'department_manager',
    (NEW.raw_user_meta_data->>'birthday_month')::INTEGER,
    (NEW.raw_user_meta_data->>'birthday_day')::INTEGER,
    (NEW.raw_user_meta_data->>'start_month')::INTEGER,
    (NEW.raw_user_meta_data->>'start_year')::INTEGER
  );
  RETURN NEW;
END;
$function$;