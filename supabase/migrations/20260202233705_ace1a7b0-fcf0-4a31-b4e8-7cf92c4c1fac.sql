-- Add action_link column to auth_tokens table for storing Supabase auth links
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS action_link text;

COMMENT ON COLUMN auth_tokens.action_link IS 
  'Stores the Supabase auth action_link for retrieval during token validation';