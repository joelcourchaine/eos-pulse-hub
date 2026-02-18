
-- Fix foreign keys referencing auth.users that block user deletion
-- Change ON DELETE NO ACTION → ON DELETE SET NULL for audit/tracking columns

-- 1. user_roles.assigned_by
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_assigned_by_fkey;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. user_department_access.granted_by
ALTER TABLE public.user_department_access DROP CONSTRAINT IF EXISTS user_department_access_granted_by_fkey;
ALTER TABLE public.user_department_access ADD CONSTRAINT user_department_access_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. department_forecasts.created_by
ALTER TABLE public.department_forecasts DROP CONSTRAINT IF EXISTS department_forecasts_created_by_fkey;
ALTER TABLE public.department_forecasts ADD CONSTRAINT department_forecasts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. financial_copy_metadata.copied_by
ALTER TABLE public.financial_copy_metadata DROP CONSTRAINT IF EXISTS financial_copy_metadata_copied_by_fkey;
ALTER TABLE public.financial_copy_metadata ADD CONSTRAINT financial_copy_metadata_copied_by_fkey
  FOREIGN KEY (copied_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. forecast_submetric_notes.created_by
ALTER TABLE public.forecast_submetric_notes DROP CONSTRAINT IF EXISTS forecast_submetric_notes_created_by_fkey;
ALTER TABLE public.forecast_submetric_notes ADD CONSTRAINT forecast_submetric_notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 6. forecast_submetric_notes.resolved_by
ALTER TABLE public.forecast_submetric_notes DROP CONSTRAINT IF EXISTS forecast_submetric_notes_resolved_by_fkey;
ALTER TABLE public.forecast_submetric_notes ADD CONSTRAINT forecast_submetric_notes_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7. announcements.created_by
ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS announcements_created_by_fkey;
ALTER TABLE public.announcements ADD CONSTRAINT announcements_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 8. top_10_list_templates.created_by
ALTER TABLE public.top_10_list_templates DROP CONSTRAINT IF EXISTS top_10_list_templates_created_by_fkey;
ALTER TABLE public.top_10_list_templates ADD CONSTRAINT top_10_list_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 9. scorecard_column_templates.created_by
ALTER TABLE public.scorecard_column_templates DROP CONSTRAINT IF EXISTS scorecard_column_templates_created_by_fkey;
ALTER TABLE public.scorecard_column_templates ADD CONSTRAINT scorecard_column_templates_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
