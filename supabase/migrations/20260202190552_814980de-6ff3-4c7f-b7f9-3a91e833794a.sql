-- Add RLS policies for user-owned resources

-- Allow authenticated users to INSERT resources for their own store
CREATE POLICY "Users can create resources for their store" ON resources
FOR INSERT WITH CHECK (
  store_id = get_current_user_store() 
  AND store_group_id = get_current_user_store_group()
  AND created_by = auth.uid()
);

-- Allow users to UPDATE their own resources
CREATE POLICY "Users can update their own resources" ON resources
FOR UPDATE USING (
  created_by = auth.uid()
);

-- Allow users to DELETE their own resources
CREATE POLICY "Users can delete their own resources" ON resources
FOR DELETE USING (
  created_by = auth.uid()
);