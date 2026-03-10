
## Summary

Add an `executive` role to the system and make issues created by `executive` or `super_admin` users default to a purple severity color (`#7c3aed`).

## What needs to happen

### 1. Add `executive` to the `app_role` enum (database migration)
```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executive';
```
This is needed before any code references it, since the types file is auto-generated.

### 2. Fetch the current user's role inside `IssueManagementDialog`
The dialog currently has no knowledge of who is opening it. We need to check if the current user is `super_admin` or `executive`, then default severity to `"executive"` (a new purple value).

The cleanest approach: in `IssueManagementDialog.tsx`, call `supabase.auth.getUser()` + `user_roles` query on mount to determine the role, then set the default severity to `"executive"` when the role matches.

### 3. Add `"executive"` as a severity option in the issue system
The severity field currently accepts: `low`, `medium`, `high`. Add `executive` as a fourth value that maps to purple (`#7c3aed`). This means:

- `IssueManagementDialog.tsx`: add `executive` to the severity `<Select>` with a purple dot, and default to it for executive/super_admin users
- `IssuesAndTodosPanel.tsx`: update `getSeverityBorderColor` and `getSeverityDotColor` to handle `"executive"` → purple classes (`border-purple-400 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40`)
- `TodosPanel.tsx`: same update to `getSeverityBorderColor` and `getSeverityDotColor`

### 4. Update `use-user-role.tsx`
Add `isExecutive` flag and include `executive` in appropriate role checks.

## Files to change

| File | Change |
|------|--------|
| Database migration | `ALTER TYPE app_role ADD VALUE 'executive'` |
| `src/hooks/use-user-role.tsx` | Add `isExecutive = hasRole("executive")` |
| `src/components/issues/IssueManagementDialog.tsx` | Fetch current user role on mount; default severity to `"executive"` for `super_admin`/`executive`; add purple `executive` option to severity select |
| `src/components/issues/IssuesAndTodosPanel.tsx` | Add `executive` → purple to `getSeverityBorderColor` and `getSeverityDotColor` |
| `src/components/todos/TodosPanel.tsx` | Add `executive` → purple to `getSeverityBorderColor` and `getSeverityDotColor` |

## Purple color reference
The exact purple from the enterprise notes column: `#7c3aed` (Tailwind `purple-700`).

For the Tailwind border/bg classes: `border-purple-400 dark:border-purple-600 bg-purple-100 dark:bg-purple-900/40` (matching the existing emerald/amber/red pattern).

## No changes needed
- No changes to `AdminUsersTab.tsx` badge colors (that's a separate concern)
- The `executive` severity value is stored as a string in the `issues.severity` column which has no DB constraint on specific values — this is safe to add without a migration
