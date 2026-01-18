-- Drop existing RLS policies on consulting_clients
DROP POLICY IF EXISTS "Super admins can view consulting clients" ON consulting_clients;
DROP POLICY IF EXISTS "Super admins can insert consulting clients" ON consulting_clients;
DROP POLICY IF EXISTS "Super admins can update consulting clients" ON consulting_clients;
DROP POLICY IF EXISTS "Super admins can delete consulting clients" ON consulting_clients;

-- Create new RLS policies for consulting_clients using has_role function
CREATE POLICY "Authorized users can view consulting clients"
  ON consulting_clients FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can insert consulting clients"
  ON consulting_clients FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can update consulting clients"
  ON consulting_clients FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can delete consulting clients"
  ON consulting_clients FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

-- Drop existing RLS policies on consulting_calls
DROP POLICY IF EXISTS "Super admins can view consulting calls" ON consulting_calls;
DROP POLICY IF EXISTS "Super admins can insert consulting calls" ON consulting_calls;
DROP POLICY IF EXISTS "Super admins can update consulting calls" ON consulting_calls;
DROP POLICY IF EXISTS "Super admins can delete consulting calls" ON consulting_calls;

-- Create new RLS policies for consulting_calls using has_role function
CREATE POLICY "Authorized users can view consulting calls"
  ON consulting_calls FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can insert consulting calls"
  ON consulting_calls FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can update consulting calls"
  ON consulting_calls FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );

CREATE POLICY "Authorized users can delete consulting calls"
  ON consulting_calls FOR DELETE
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR 
    public.has_role(auth.uid(), 'consulting_scheduler'::app_role)
  );