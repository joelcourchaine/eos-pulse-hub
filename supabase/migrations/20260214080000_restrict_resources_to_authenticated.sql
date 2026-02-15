-- Fix: resources table SELECT policy allows unauthenticated access
-- The existing policy checks store_group_id and store_id with IS NULL fallbacks,
-- but doesn't require authentication. This means anonymous users can read
-- resources where store_group_id IS NULL and store_id IS NULL.
-- Fix: require auth.uid() IS NOT NULL on the SELECT policy.

DROP POLICY IF EXISTS "Users can view active resources" ON resources;

CREATE POLICY "Users can view active resources" ON resources
FOR SELECT USING (
  auth.uid() IS NOT NULL
  AND is_active = true
  AND (store_group_id IS NULL OR store_group_id = get_current_user_store_group())
  AND (store_id IS NULL OR store_id = get_current_user_store())
);
