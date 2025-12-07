-- Add recurrence columns to todos table
ALTER TABLE public.todos
ADD COLUMN is_recurring boolean NOT NULL DEFAULT false,
ADD COLUMN recurrence_interval integer,
ADD COLUMN recurrence_unit text CHECK (recurrence_unit IN ('days', 'weeks', 'months')),
ADD COLUMN parent_todo_id uuid REFERENCES public.todos(id) ON DELETE SET NULL;

-- Add index for parent_todo_id lookups
CREATE INDEX idx_todos_parent_todo_id ON public.todos(parent_todo_id);

-- Create function to generate next recurring task when due date arrives
CREATE OR REPLACE FUNCTION public.generate_recurring_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_due_date date;
BEGIN
  -- Only process if this is a recurring task that's being completed or if due date has passed
  IF OLD.is_recurring = true AND OLD.recurrence_interval IS NOT NULL AND OLD.recurrence_unit IS NOT NULL THEN
    -- Check if a next task already exists for this parent
    IF NOT EXISTS (
      SELECT 1 FROM public.todos 
      WHERE parent_todo_id = COALESCE(OLD.parent_todo_id, OLD.id) 
      AND status = 'pending'
      AND id != OLD.id
    ) THEN
      -- Calculate new due date
      CASE OLD.recurrence_unit
        WHEN 'days' THEN
          new_due_date := COALESCE(OLD.due_date, CURRENT_DATE) + (OLD.recurrence_interval || ' days')::interval;
        WHEN 'weeks' THEN
          new_due_date := COALESCE(OLD.due_date, CURRENT_DATE) + (OLD.recurrence_interval || ' weeks')::interval;
        WHEN 'months' THEN
          new_due_date := COALESCE(OLD.due_date, CURRENT_DATE) + (OLD.recurrence_interval || ' months')::interval;
        ELSE
          new_due_date := COALESCE(OLD.due_date, CURRENT_DATE) + interval '7 days';
      END CASE;
      
      -- Create the next occurrence
      INSERT INTO public.todos (
        title,
        description,
        severity,
        due_date,
        department_id,
        assigned_to,
        created_by,
        status,
        is_recurring,
        recurrence_interval,
        recurrence_unit,
        parent_todo_id
      ) VALUES (
        OLD.title,
        OLD.description,
        OLD.severity,
        new_due_date,
        OLD.department_id,
        OLD.assigned_to,
        OLD.created_by,
        'pending',
        true,
        OLD.recurrence_interval,
        OLD.recurrence_unit,
        COALESCE(OLD.parent_todo_id, OLD.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for generating next recurring task when a task is completed
CREATE TRIGGER trigger_generate_recurring_task
AFTER UPDATE OF status ON public.todos
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
EXECUTE FUNCTION public.generate_recurring_task();