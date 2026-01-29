

# Robust Password Setup Detection for Resend Invite

## Problem Summary

When using "Resend Invite" for users who clicked an invite link but never completed password setup, the system incorrectly sends a "Password Reset" email instead of a "Set Your Password" email. This happens because:

- **Current logic**: Checks `email_confirmed_at` from auth.users
- **Issue**: `email_confirmed_at` gets set when the invite link is clicked (even if the user never finishes setting their password)
- **Result**: Users like Charlie receive "Reset Password" emails when they should receive "Set Your Password" emails

## Solution

Add a `password_set_at` column to track when users have actually completed password setup, and use this instead of `email_confirmed_at` for flow detection.

---

## Implementation Steps

### Step 1: Database Migration

Add a new column to the `profiles` table:

```sql
ALTER TABLE public.profiles 
ADD COLUMN password_set_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.password_set_at IS 
'Timestamp when user successfully set their password. Used to determine invite vs reset flow.';
```

---

### Step 2: Update SetPassword.tsx

After successful password update (around line 172-175), add a profile update to record the timestamp:

| Location | Change |
|----------|--------|
| Line ~173-175 | After `supabase.auth.updateUser()` succeeds, update the profile with `password_set_at: new Date().toISOString()` |

**Logic:**
```typescript
// After password is successfully set
const { error: profileError } = await supabase
  .from('profiles')
  .update({ password_set_at: new Date().toISOString() })
  .eq('id', user.id);

if (profileError) {
  console.error('Failed to update password_set_at:', profileError);
  // Non-blocking - password was still set successfully
}
```

---

### Step 3: Update ResetPassword.tsx

Same logic after successful password reset in `handleUpdatePassword` (around line 158-170):

| Location | Change |
|----------|--------|
| Line ~170-171 | After password update succeeds and user verification, update `password_set_at` |

**Logic:**
```typescript
// After successful password update
const { data: { user: currentUser } } = await supabase.auth.getUser();
if (currentUser) {
  await supabase
    .from('profiles')
    .update({ password_set_at: new Date().toISOString() })
    .eq('id', currentUser.id);
}
```

---

### Step 4: Update resend-user-invite/index.ts

Change the detection logic (currently at line 282):

| Current (Unreliable) | New (Reliable) |
|---------------------|----------------|
| `const isConfirmed = authUser.user.email_confirmed_at != null;` | Check `password_set_at` from profiles table |

**New Logic:**
```typescript
// Get password_set_at from profiles (we already have profile data from line 246)
// Update the profile query to include password_set_at
const { data: profile, error: profileError } = await supabaseAdmin
  .from('profiles')
  .select('email, password_set_at')  // Add password_set_at
  .eq('id', user_id)
  .single();

// Later, replace the isConfirmed check
const hasSetPassword = profile?.password_set_at != null;

if (hasSetPassword) {
  // Send password reset email (user has completed setup before)
} else {
  // Send invite email (user has never completed setup)
}
```

---

## Summary of File Changes

| File | Change |
|------|--------|
| **Migration** | Add `password_set_at TIMESTAMPTZ` column to `profiles` |
| `src/pages/SetPassword.tsx` | Update profile with timestamp after successful password creation |
| `src/pages/ResetPassword.tsx` | Update profile with timestamp after successful password reset |
| `supabase/functions/resend-user-invite/index.ts` | Use `password_set_at` instead of `email_confirmed_at` for flow detection |

---

## Technical Notes

- The `password_set_at` column is nullable to handle existing users (those without a value are treated as "never set password")
- Both SetPassword and ResetPassword update this field, ensuring it's always set regardless of which flow the user completes
- The profile update is non-blocking - if it fails, the password was still set successfully
- Existing users who have already logged in will have `password_set_at = NULL` initially, but will get it set on their next password change

