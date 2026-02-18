
-- Fix remaining foreign key constraints to use ON DELETE SET NULL for user deletion support

ALTER TABLE public.scorecard_entries DROP CONSTRAINT IF EXISTS scorecard_entries_created_by_fkey;
ALTER TABLE public.scorecard_entries ADD CONSTRAINT scorecard_entries_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.scorecard_cell_mappings DROP CONSTRAINT IF EXISTS scorecard_cell_mappings_created_by_fkey;
ALTER TABLE public.scorecard_cell_mappings ADD CONSTRAINT scorecard_cell_mappings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.scorecard_import_logs DROP CONSTRAINT IF EXISTS scorecard_import_logs_imported_by_fkey;
ALTER TABLE public.scorecard_import_logs ADD CONSTRAINT scorecard_import_logs_imported_by_fkey
  FOREIGN KEY (imported_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.scorecard_user_aliases DROP CONSTRAINT IF EXISTS scorecard_user_aliases_created_by_fkey;
ALTER TABLE public.scorecard_user_aliases ADD CONSTRAINT scorecard_user_aliases_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_assigned_to_fkey;
ALTER TABLE public.todos ADD CONSTRAINT todos_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_created_by_fkey;
ALTER TABLE public.todos ADD CONSTRAINT todos_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.rocks DROP CONSTRAINT IF EXISTS rocks_assigned_to_fkey;
ALTER TABLE public.rocks ADD CONSTRAINT rocks_assigned_to_fkey
  FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.issues DROP CONSTRAINT IF EXISTS issues_created_by_fkey;
ALTER TABLE public.issues ADD CONSTRAINT issues_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.meeting_notes DROP CONSTRAINT IF EXISTS meeting_notes_created_by_fkey;
ALTER TABLE public.meeting_notes ADD CONSTRAINT meeting_notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.director_notes DROP CONSTRAINT IF EXISTS director_notes_created_by_fkey;
ALTER TABLE public.director_notes ADD CONSTRAINT director_notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.consulting_clients DROP CONSTRAINT IF EXISTS consulting_clients_created_by_fkey;
ALTER TABLE public.consulting_clients ADD CONSTRAINT consulting_clients_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.consulting_travel DROP CONSTRAINT IF EXISTS consulting_travel_created_by_fkey;
ALTER TABLE public.consulting_travel ADD CONSTRAINT consulting_travel_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.department_answers DROP CONSTRAINT IF EXISTS department_answers_updated_by_fkey;
ALTER TABLE public.department_answers ADD CONSTRAINT department_answers_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.department_answer_history DROP CONSTRAINT IF EXISTS department_answer_history_changed_by_fkey;
ALTER TABLE public.department_answer_history ADD CONSTRAINT department_answer_history_changed_by_fkey
  FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.financial_attachments DROP CONSTRAINT IF EXISTS financial_attachments_uploaded_by_fkey;
ALTER TABLE public.financial_attachments ADD CONSTRAINT financial_attachments_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.questionnaire_tokens DROP CONSTRAINT IF EXISTS questionnaire_tokens_sent_by_fkey;
ALTER TABLE public.questionnaire_tokens ADD CONSTRAINT questionnaire_tokens_sent_by_fkey
  FOREIGN KEY (sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
