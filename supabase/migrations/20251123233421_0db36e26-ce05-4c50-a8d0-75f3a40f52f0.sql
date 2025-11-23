-- CRITICAL SECURITY UPDATE: Ensure complete isolation between store groups
-- Users from different store groups must never access each other's data

-- First, update the stores RLS policy to include store group filtering
DROP POLICY IF EXISTS "Users can view their stores" ON public.stores;

CREATE POLICY "Users can view stores in their group"
ON public.stores
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    group_id = get_user_store_group(auth.uid()) OR
    id IN (SELECT store_id FROM profiles WHERE id = auth.uid())
  )
);

-- Update departments policy to ensure group-level filtering
DROP POLICY IF EXISTS "Users can view departments in their store" ON public.departments;

CREATE POLICY "Users can view departments in their store group"
ON public.departments
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    store_id IN (
      SELECT id FROM stores 
      WHERE group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Update profiles policy to ensure users only see profiles from their group
DROP POLICY IF EXISTS "Users can view profiles from their store or group" ON public.profiles;

CREATE POLICY "Users can view profiles from their store group only"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    (store_group_id IS NOT NULL AND store_group_id = get_user_store_group(auth.uid())) OR
    (store_id IS NOT NULL AND store_id IN (
      SELECT id FROM stores WHERE group_id = get_user_store_group(auth.uid())
    )) OR
    id = auth.uid()
  )
);

-- Ensure KPI definitions are group-isolated through departments
DROP POLICY IF EXISTS "Users can view KPI definitions" ON public.kpi_definitions;

CREATE POLICY "Users can view KPI definitions in their group"
ON public.kpi_definitions
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure scorecard entries are group-isolated
DROP POLICY IF EXISTS "Users can view scorecard entries" ON public.scorecard_entries;

CREATE POLICY "Users can view scorecard entries in their group"
ON public.scorecard_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    kpi_id IN (
      SELECT kpi.id FROM kpi_definitions kpi
      JOIN departments d ON kpi.department_id = d.id
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure financial entries are group-isolated
DROP POLICY IF EXISTS "Users can view financial entries" ON public.financial_entries;

CREATE POLICY "Users can view financial entries in their group"
ON public.financial_entries
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure financial targets are group-isolated
DROP POLICY IF EXISTS "Users can view financial targets" ON public.financial_targets;

CREATE POLICY "Users can view financial targets in their group"
ON public.financial_targets
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure rocks are group-isolated
DROP POLICY IF EXISTS "Users can view rocks" ON public.rocks;

CREATE POLICY "Users can view rocks in their group"
ON public.rocks
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure todos are group-isolated
DROP POLICY IF EXISTS "Users can view todos" ON public.todos;

CREATE POLICY "Users can view todos in their group"
ON public.todos
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure director notes are group-isolated
DROP POLICY IF EXISTS "Users can view director notes" ON public.director_notes;

CREATE POLICY "Users can view director notes in their group"
ON public.director_notes
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Ensure meeting notes are group-isolated
DROP POLICY IF EXISTS "Users can view meeting notes" ON public.meeting_notes;

CREATE POLICY "Users can view meeting notes in their group"
ON public.meeting_notes
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    department_id IN (
      SELECT d.id FROM departments d
      JOIN stores s ON d.store_id = s.id
      WHERE s.group_id = get_user_store_group(auth.uid())
    )
  )
);

-- Update management policies to respect group boundaries
DROP POLICY IF EXISTS "Admins can manage departments" ON public.departments;

CREATE POLICY "Admins can manage departments in their group"
ON public.departments
FOR ALL
USING (
  has_role(auth.uid(), 'super_admin') OR (
    has_role(auth.uid(), 'store_gm') AND
    store_id IN (
      SELECT id FROM stores WHERE group_id = get_user_store_group(auth.uid())
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR (
    has_role(auth.uid(), 'store_gm') AND
    store_id IN (
      SELECT id FROM stores WHERE group_id = get_user_store_group(auth.uid())
    )
  )
);