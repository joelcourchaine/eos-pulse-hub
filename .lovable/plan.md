

## Fix Stale "Last Login" Date for Craig (and All Users)

### Problem
The "Last Login" column in both the Admin Users Tab and the User Management Dialog uses `last_sign_in_at`, which only updates during full password-based logins. Users who stay logged in via token refresh (like Craig) show a stale date. The `last_active_at` field on profiles is the accurate timestamp -- it updates every time a user opens their dashboard.

### Changes

**File: `src/components/admin/AdminUsersTab.tsx`**

1. Add `last_active_at` to the select query (line 56)
2. Update the "Last Login" display (line 262) to prefer `last_active_at` over `last_sign_in_at`
3. Update the pending/active filters to also consider `last_active_at`

**File: `src/components/users/UserManagementDialog.tsx`**

1. Add `last_active_at` to the Profile type and select query
2. Update `hasActuallyLoggedIn` to check `last_active_at` as well
3. Update the "Last Login" display to prefer `last_active_at` over `last_sign_in_at`

### Logic
For both files, the display logic becomes:
- Show `last_active_at` if available (most accurate)
- Fall back to `last_sign_in_at` if `last_active_at` is null
- Show "Never" if neither exists (or if it matches the creation timestamp)

