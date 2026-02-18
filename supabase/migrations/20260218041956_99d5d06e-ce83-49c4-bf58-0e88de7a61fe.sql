
-- Create team_members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  created_by uuid,
  name text NOT NULL,
  position text NOT NULL,
  reports_to uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see team members in their store(s)
CREATE POLICY "Users can view team members in their stores"
ON public.team_members FOR SELECT
USING (
  store_id IN (SELECT public.get_user_stores(auth.uid()))
  OR store_id IN (SELECT public.get_user_stores_access(auth.uid()))
  OR public.has_role(auth.uid(), 'super_admin')
);

-- INSERT: managers can add team members to their stores
CREATE POLICY "Managers can insert team members"
ON public.team_members FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'store_gm') AND store_id IN (SELECT public.get_user_stores(auth.uid())))
  OR (public.has_role(auth.uid(), 'department_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
  OR (public.has_role(auth.uid(), 'fixed_ops_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
);

-- UPDATE: managers can update team members in their stores
CREATE POLICY "Managers can update team members"
ON public.team_members FOR UPDATE
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'store_gm') AND store_id IN (SELECT public.get_user_stores(auth.uid())))
  OR (public.has_role(auth.uid(), 'department_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
  OR (public.has_role(auth.uid(), 'fixed_ops_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
);

-- DELETE: managers can delete team members in their stores
CREATE POLICY "Managers can delete team members"
ON public.team_members FOR DELETE
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR (public.has_role(auth.uid(), 'store_gm') AND store_id IN (SELECT public.get_user_stores(auth.uid())))
  OR (public.has_role(auth.uid(), 'department_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
  OR (public.has_role(auth.uid(), 'fixed_ops_manager') AND store_id IN (SELECT public.get_user_store_ids_via_departments(auth.uid())))
);

-- Trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
BEFORE UPDATE ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
