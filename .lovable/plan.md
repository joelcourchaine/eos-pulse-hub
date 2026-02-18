

# Fix User Deletion: Foreign Key Constraints Blocking Delete

## Problem

When a Super Admin tries to delete a user, the backend function fails with "Database error deleting user". This happens because 9 columns across 7 tables have foreign keys to `auth.users` with `ON DELETE NO ACTION`, which blocks the delete.

## Solution

Run a database migration to change all these audit/tracking columns from `NO ACTION` to `SET NULL`. This means when a user is deleted:
- The record (forecast, announcement, etc.) is preserved
- The `created_by` / `assigned_by` / etc. column is set to NULL
- The delete succeeds cleanly

No code changes needed -- only a database migration.

## Columns to Fix

| Table | Column |
|---|---|
| user_roles | assigned_by |
| user_department_access | granted_by |
| department_forecasts | created_by |
| financial_copy_metadata | copied_by |
| forecast_submetric_notes | created_by |
| forecast_submetric_notes | resolved_by |
| announcements | created_by |
| top_10_list_templates | created_by |
| scorecard_column_templates | created_by |

## Technical Details

The migration will drop each existing foreign key constraint and re-create it with `ON DELETE SET NULL`. Each column is already nullable (they are audit fields), so no schema change is needed beyond the constraint update. This is a safe, non-destructive change.

