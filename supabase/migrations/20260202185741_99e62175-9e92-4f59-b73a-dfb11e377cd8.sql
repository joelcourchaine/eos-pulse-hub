-- Add store_id column to resources table
ALTER TABLE resources ADD COLUMN store_id uuid REFERENCES stores(id);

-- Create helper function for current user's store
CREATE OR REPLACE FUNCTION get_current_user_store()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT store_id FROM profiles WHERE id = auth.uid() LIMIT 1
$$;

-- Drop and recreate the SELECT policy to include store-level filtering
DROP POLICY IF EXISTS "Users can view active resources" ON resources;

CREATE POLICY "Users can view active resources" ON resources
FOR SELECT USING (
  is_active = true
  AND (store_group_id IS NULL OR store_group_id = get_current_user_store_group())
  AND (store_id IS NULL OR store_id = get_current_user_store())
);