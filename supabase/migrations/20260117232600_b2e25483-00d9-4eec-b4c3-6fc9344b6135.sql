-- Drop and recreate the trigger to also fire on INSERT
DROP TRIGGER IF EXISTS track_answer_changes_trigger ON public.department_answers;

-- Update the function to handle both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.track_answer_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Track initial value creation (previous is NULL)
    IF NEW.answer_value IS NOT NULL THEN
      INSERT INTO public.department_answer_history (
        answer_id,
        question_id,
        department_id,
        previous_value,
        new_value,
        changed_by
      ) VALUES (
        NEW.id,
        NEW.question_id,
        NEW.department_id,
        NULL,
        NEW.answer_value,
        NEW.updated_by
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only track if the value actually changed
    IF (OLD.answer_value IS DISTINCT FROM NEW.answer_value) THEN
      INSERT INTO public.department_answer_history (
        answer_id,
        question_id,
        department_id,
        previous_value,
        new_value,
        changed_by
      ) VALUES (
        NEW.id,
        NEW.question_id,
        NEW.department_id,
        OLD.answer_value,
        NEW.answer_value,
        NEW.updated_by
      );
    END IF;
    RETURN NEW;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for both INSERT and UPDATE
CREATE TRIGGER track_answer_changes_trigger
  AFTER INSERT OR UPDATE ON public.department_answers
  FOR EACH ROW
  EXECUTE FUNCTION track_answer_changes();