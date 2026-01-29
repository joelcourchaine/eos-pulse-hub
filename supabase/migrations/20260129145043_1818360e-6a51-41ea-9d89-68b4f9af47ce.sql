-- Create payplan_scenarios table for storing commission scenario configurations
CREATE TABLE public.payplan_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  base_salary_annual NUMERIC NOT NULL DEFAULT 0,
  commission_rules JSONB NOT NULL DEFAULT '{"rules": []}',
  department_names TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payplan_scenarios ENABLE ROW LEVEL SECURITY;

-- Create policies for user access (users can only see/edit their own scenarios)
CREATE POLICY "Users can view their own payplan scenarios" 
ON public.payplan_scenarios 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payplan scenarios" 
ON public.payplan_scenarios 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payplan scenarios" 
ON public.payplan_scenarios 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payplan scenarios" 
ON public.payplan_scenarios 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payplan_scenarios_updated_at
BEFORE UPDATE ON public.payplan_scenarios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups by user
CREATE INDEX idx_payplan_scenarios_user_id ON public.payplan_scenarios(user_id);
CREATE INDEX idx_payplan_scenarios_is_active ON public.payplan_scenarios(is_active);