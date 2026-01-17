-- Create consulting_clients table
CREATE TABLE public.consulting_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department_name TEXT,
  contact_names TEXT,
  call_value DECIMAL(10,2) DEFAULT 0,
  is_adhoc BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create consulting_calls table
CREATE TABLE public.consulting_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.consulting_clients(id) ON DELETE CASCADE,
  call_date DATE NOT NULL,
  call_time TIME,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consulting_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies for consulting_clients (super_admin only)
CREATE POLICY "Super admins can view consulting clients"
  ON public.consulting_clients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can insert consulting clients"
  ON public.consulting_clients FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can update consulting clients"
  ON public.consulting_clients FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can delete consulting clients"
  ON public.consulting_clients FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- RLS policies for consulting_calls (super_admin only)
CREATE POLICY "Super admins can view consulting calls"
  ON public.consulting_calls FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can insert consulting calls"
  ON public.consulting_calls FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can update consulting calls"
  ON public.consulting_calls FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

CREATE POLICY "Super admins can delete consulting calls"
  ON public.consulting_calls FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ));

-- Create indexes for performance
CREATE INDEX idx_consulting_clients_is_adhoc ON public.consulting_clients(is_adhoc);
CREATE INDEX idx_consulting_clients_is_active ON public.consulting_clients(is_active);
CREATE INDEX idx_consulting_calls_client_id ON public.consulting_calls(client_id);
CREATE INDEX idx_consulting_calls_call_date ON public.consulting_calls(call_date);