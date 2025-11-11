-- Drop the existing update policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies for profile updates
-- Users can update their own profile completely
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Managers and admins can update certain fields for all users
CREATE POLICY "Managers can update user details"
ON profiles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin'::app_role) 
  OR has_role(auth.uid(), 'store_gm'::app_role) 
  OR has_role(auth.uid(), 'department_manager'::app_role)
);