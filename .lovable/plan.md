

## Fix: Track Actual User Activity Instead of Relying on Stale Login Timestamps

### Problem
`last_sign_in_at` in both `auth.users` and `profiles` only updates when a user does a fresh password login. Users who stay logged in via token refresh (which is most users, since sessions persist) show stale dates -- sometimes days or weeks old. This makes the Admin "Recent Logins" list and "Active Users" chart inaccurate.

**Example from today:**
- Joel Courchaine: Active today (Feb 12) via token refresh, but `last_sign_in_at` shows Feb 4
- Bryce V: Active today, but shows Feb 11

### Solution
Add a `last_active_at` column to `profiles` and update it whenever the app detects an active session. This captures actual app usage, not just password logins.

### Steps

**1. Database Migration**
- Add `last_active_at` column to `profiles` table (timestamptz, default now())
- Backfill existing rows from `last_sign_in_at` so historical data isn't lost

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
UPDATE profiles SET last_active_at = COALESCE(last_sign_in_at, created_at);
```

**2. Update the Dashboard to track activity**

**File: `src/pages/Dashboard.tsx`**

Add a lightweight call when the dashboard loads (after session is confirmed) to update `last_active_at`:

```typescript
// After session is confirmed, update last_active_at
await supabase
  .from('profiles')
  .update({ last_active_at: new Date().toISOString() })
  .eq('id', session.user.id);
```

This is throttled to avoid excessive writes -- only fires on page load, not on every re-render.

**3. Update Admin Overview to use `last_active_at`**

**File: `src/components/admin/AdminOverviewTab.tsx`**

Change the "Recent Logins" query to sort by `last_active_at` instead of `last_sign_in_at`:

```typescript
// Before
.select("id, full_name, email, last_sign_in_at")
.not("last_sign_in_at", "is", null)
.order("last_sign_in_at", { ascending: false })

// After
.select("id, full_name, email, last_active_at")
.not("last_active_at", "is", null)
.order("last_active_at", { ascending: false })
```

**4. Update Admin Login Chart to use `last_active_at`**

**File: `src/components/admin/AdminLoginChart.tsx`**

Change all references from `last_sign_in_at` to `last_active_at` for accurate activity tracking in the chart.

### What This Fixes
- Admin dashboard shows actual user activity, not stale password-login timestamps
- Users who stay logged in via token refresh are correctly shown as active
- The "Active Users" chart reflects real usage patterns

### What Stays the Same
- The existing `last_sign_in_at` column and trigger remain for backward compatibility
- No changes to authentication flow
- No changes to RLS policies (profiles already has update policies)

