-- Create department questions table
CREATE TABLE public.department_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_text TEXT NOT NULL,
  question_category TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'text', -- text, number, boolean, textarea
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create department answers table
CREATE TABLE public.department_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.department_questions(id) ON DELETE CASCADE,
  answer_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id),
  UNIQUE(department_id, question_id)
);

-- Create department answer history table
CREATE TABLE public.department_answer_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES public.department_answers(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.department_questions(id),
  department_id UUID NOT NULL REFERENCES public.departments(id),
  previous_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.department_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_answer_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for department_questions
CREATE POLICY "Users can view questions"
  ON public.department_questions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super admins can manage questions"
  ON public.department_questions
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for department_answers
CREATE POLICY "Users can view answers"
  ON public.department_answers
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can manage their department answers"
  ON public.department_answers
  FOR ALL
  USING (
    has_role(auth.uid(), 'super_admin'::app_role) OR
    has_role(auth.uid(), 'store_gm'::app_role) OR
    department_id = get_user_department(auth.uid())
  );

-- RLS policies for department_answer_history
CREATE POLICY "Users can view answer history"
  ON public.department_answer_history
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert history"
  ON public.department_answer_history
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger to track answer changes
CREATE OR REPLACE FUNCTION public.track_answer_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if the value actually changed
  IF (TG_OP = 'UPDATE' AND OLD.answer_value IS DISTINCT FROM NEW.answer_value) THEN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER track_answer_changes_trigger
  AFTER UPDATE ON public.department_answers
  FOR EACH ROW
  EXECUTE FUNCTION public.track_answer_changes();

-- Insert initial questions from the image
INSERT INTO public.department_questions (question_text, question_category, answer_type, display_order) VALUES
  -- Service Rates
  ('CP Labour Rate', 'Service Rates', 'number', 1),
  ('CP High Tech Rate', 'Service Rates', 'number', 2),
  ('Labour Matrix', 'Service Rates', 'text', 3),
  ('Fleet Rate', 'Service Rates', 'number', 4),
  ('EV Rate', 'Service Rates', 'number', 5),
  ('Quick Maintenance Rate', 'Service Rates', 'number', 6),
  ('Warranty Rate', 'Service Rates', 'number', 7),
  ('Internal Rate', 'Service Rates', 'number', 8),
  ('Employee Rate', 'Service Rates', 'number', 9),
  ('Shop Supplies Labour Calculation', 'Service Rates', 'text', 10),
  ('Shop Supplies Parts Calculation', 'Service Rates', 'text', 11),
  ('Environmental Fee', 'Service Rates', 'number', 12),
  
  -- Hours of Operation
  ('Weekdays', 'Hours of Operation', 'text', 13),
  ('Saturdays', 'Hours of Operation', 'text', 14),
  ('Sundays', 'Hours of Operation', 'text', 15),
  
  -- Customer Service
  ('Loaners', 'Customer Service', 'text', 16),
  ('Write Down Procedure', 'Customer Service', 'textarea', 17),
  ('Service Drive', 'Customer Service', 'text', 18),
  ('Free Service Washes', 'Customer Service', 'text', 19),
  
  -- Opportunity
  ('Bays with Hoists', 'Opportunity', 'number', 20),
  ('Empty Bays', 'Opportunity', 'number', 21),
  ('Alignment Rack', 'Opportunity', 'text', 22),
  
  -- Tech Stack
  ('DMS', 'Tech Stack', 'text', 23),
  ('Version', 'Tech Stack', 'text', 24),
  ('Texting Tool', 'Tech Stack', 'text', 25),
  ('Advisor Training Program', 'Tech Stack', 'text', 26),
  ('Tech Training Program', 'Tech Stack', 'text', 27),
  ('Online Booking Program', 'Tech Stack', 'text', 28),
  ('Other Digital Tools', 'Tech Stack', 'textarea', 29),
  
  -- Accounting
  ('Fixed Expense Allocation', 'Accounting', 'text', 30),
  ('PBS Version', 'Accounting', 'text', 31),
  
  -- Internal Process
  ('Does sales give us the ability to auto approve work under a designated dollar amount? If yes, what is the threshold?', 'Internal Process', 'textarea', 32);