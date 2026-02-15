-- Activity log table for tracking user activity history
-- Replaces the single last_active_at timestamp with a full event log

CREATE TABLE public.activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'page_view',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by user
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);

-- Index for time-range queries (admin charts)
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);

-- Composite index for user + time range lookups
CREATE INDEX idx_activity_log_user_created ON public.activity_log(user_id, created_at DESC);

-- Index for event type filtering
CREATE INDEX idx_activity_log_event_type ON public.activity_log(event_type);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Users can insert their own activity
CREATE POLICY "Users can insert own activity"
ON public.activity_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Only super admins can read activity logs
CREATE POLICY "Super admins can read activity logs"
ON public.activity_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

-- Auto-cleanup: delete activity logs older than 1 year
-- This can be run periodically via a cron job or Supabase pg_cron
COMMENT ON TABLE public.activity_log IS
'Tracks user activity events (page_view, login, excel_import, etc).
Consider periodic cleanup of rows older than 12 months via:
DELETE FROM activity_log WHERE created_at < now() - interval ''1 year'';';
