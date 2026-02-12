ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
UPDATE profiles SET last_active_at = COALESCE(last_sign_in_at, created_at);