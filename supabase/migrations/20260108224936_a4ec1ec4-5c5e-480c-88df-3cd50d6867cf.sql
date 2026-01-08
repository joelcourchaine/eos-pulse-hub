-- Fix: Financial Data Could Be Viewed by Competitors
-- Drop overly permissive SELECT policy that allows any authenticated user in store group to view all financial data
DROP POLICY IF EXISTS "Users can view financial entries in their store group" ON public.financial_entries;

-- Super admins can view all financial entries
CREATE POLICY "super_admin_view_financial_entries"
ON public.financial_entries
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Store GMs can view financial entries for departments in their store
CREATE POLICY "store_gm_view_financial_entries"
ON public.financial_entries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'store_gm'::app_role)
  AND department_id IN (
    SELECT id FROM public.departments 
    WHERE store_id = public.get_user_store_no_rls(auth.uid())
  )
);

-- Fixed ops managers can view financial entries for departments in their store (service-related)
CREATE POLICY "fixed_ops_manager_view_financial_entries"
ON public.financial_entries
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'fixed_ops_manager'::app_role)
  AND department_id IN (
    SELECT id FROM public.departments 
    WHERE store_id = public.get_user_store_no_rls(auth.uid())
  )
);

-- Department managers can view financial entries for their managed departments or departments they have explicit access to
CREATE POLICY "dept_manager_view_financial_entries"
ON public.financial_entries
FOR SELECT
TO authenticated
USING (
  department_id IN (
    SELECT department_id FROM public.user_department_access 
    WHERE user_id = auth.uid()
  )
  OR department_id IN (
    SELECT id FROM public.departments 
    WHERE manager_id = auth.uid()
  )
);