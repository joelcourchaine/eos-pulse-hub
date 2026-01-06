-- Create user_store_access table for multi-store user assignments
CREATE TABLE public.user_store_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID,
  UNIQUE(user_id, store_id)
);

-- Enable RLS
ALTER TABLE public.user_store_access ENABLE ROW LEVEL SECURITY;

-- Super admins and store GMs can manage store access
CREATE POLICY "Super admins and store GMs can manage store access"
ON public.user_store_access
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'store_gm'::app_role)
);

-- Users can view their own store access
CREATE POLICY "Users can view their own store access"
ON public.user_store_access
FOR SELECT
USING (auth.uid() = user_id);

-- Create helper function to get user's accessible stores
CREATE OR REPLACE FUNCTION public.get_user_stores_access(_user_id UUID)
RETURNS TABLE(store_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT usa.store_id
  FROM public.user_store_access usa
  WHERE usa.user_id = _user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;