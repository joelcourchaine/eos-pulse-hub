-- Rework rock_monthly_targets RLS to match rocks access (super_admin/store_gm + explicit department access)
DROP POLICY IF EXISTS "Users can view rock targets for accessible departments" ON public.rock_monthly_targets;
DROP POLICY IF EXISTS "Users can insert rock targets for accessible departments" ON public.rock_monthly_targets;
DROP POLICY IF EXISTS "Users can update rock targets for accessible departments" ON public.rock_monthly_targets;
DROP POLICY IF EXISTS "Users can delete rock targets for accessible departments" ON public.rock_monthly_targets;

-- SELECT
CREATE POLICY "Users can view rock targets for accessible departments"
ON public.rock_monthly_targets
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rocks r
    WHERE r.id = rock_monthly_targets.rock_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'store_gm'::app_role)
        OR r.department_id IN (
          SELECT department_id FROM public.get_user_departments(auth.uid())
        )
      )
  )
);

-- INSERT
CREATE POLICY "Users can insert rock targets for accessible departments"
ON public.rock_monthly_targets
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rocks r
    WHERE r.id = rock_monthly_targets.rock_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'store_gm'::app_role)
        OR r.department_id IN (
          SELECT department_id FROM public.get_user_departments(auth.uid())
        )
      )
  )
);

-- UPDATE
CREATE POLICY "Users can update rock targets for accessible departments"
ON public.rock_monthly_targets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.rocks r
    WHERE r.id = rock_monthly_targets.rock_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'store_gm'::app_role)
        OR r.department_id IN (
          SELECT department_id FROM public.get_user_departments(auth.uid())
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.rocks r
    WHERE r.id = rock_monthly_targets.rock_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'store_gm'::app_role)
        OR r.department_id IN (
          SELECT department_id FROM public.get_user_departments(auth.uid())
        )
      )
  )
);

-- DELETE
CREATE POLICY "Users can delete rock targets for accessible departments"
ON public.rock_monthly_targets
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.rocks r
    WHERE r.id = rock_monthly_targets.rock_id
      AND (
        public.has_role(auth.uid(), 'super_admin'::app_role)
        OR public.has_role(auth.uid(), 'store_gm'::app_role)
        OR r.department_id IN (
          SELECT department_id FROM public.get_user_departments(auth.uid())
        )
      )
  )
);