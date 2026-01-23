-- Create consulting_travel_destinations table for destination-to-color mapping
CREATE TABLE public.consulting_travel_destinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create consulting_travel table for travel periods
CREATE TABLE public.consulting_travel (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT end_date_after_start CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE public.consulting_travel_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consulting_travel ENABLE ROW LEVEL SECURITY;

-- RLS policies for consulting_travel_destinations
CREATE POLICY "Super admins can manage travel destinations"
  ON public.consulting_travel_destinations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Consulting schedulers can manage travel destinations"
  ON public.consulting_travel_destinations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'consulting_scheduler'
    )
  );

-- RLS policies for consulting_travel
CREATE POLICY "Super admins can manage travel"
  ON public.consulting_travel
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Consulting schedulers can manage travel"
  ON public.consulting_travel
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'consulting_scheduler'
    )
  );

-- Create index for date range queries
CREATE INDEX idx_consulting_travel_dates ON public.consulting_travel(start_date, end_date);