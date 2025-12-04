-- Fix RLS policies for store_groups to be permissive
DROP POLICY IF EXISTS "Super admins can manage store groups" ON public.store_groups;
DROP POLICY IF EXISTS "Users can view store groups" ON public.store_groups;

CREATE POLICY "Super admins can manage store groups" 
ON public.store_groups 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view store groups" 
ON public.store_groups 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix RLS policies for brands to be permissive
DROP POLICY IF EXISTS "Super admins can manage brands" ON public.brands;
DROP POLICY IF EXISTS "Users can view brands" ON public.brands;

CREATE POLICY "Super admins can manage brands" 
ON public.brands 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view brands" 
ON public.brands 
FOR SELECT 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Fix RLS policies for stores to be permissive
DROP POLICY IF EXISTS "Super admins can manage stores" ON public.stores;
DROP POLICY IF EXISTS "Users can view stores in their group" ON public.stores;

CREATE POLICY "Super admins can manage stores" 
ON public.stores 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Users can view stores in their group" 
ON public.stores 
FOR SELECT 
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin'::app_role) OR 
    group_id = get_user_store_group_no_rls(auth.uid()) OR 
    id = get_user_store_no_rls(auth.uid())
  )
);