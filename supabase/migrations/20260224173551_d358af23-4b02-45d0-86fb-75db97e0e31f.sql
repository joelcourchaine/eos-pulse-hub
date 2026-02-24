CREATE POLICY "Department managers can manage aliases for their store"
ON public.scorecard_user_aliases
FOR ALL
USING (
  store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_manager_or_above(auth.uid())
)
WITH CHECK (
  store_id = (SELECT store_id FROM public.profiles WHERE id = auth.uid())
  AND public.is_manager_or_above(auth.uid())
);