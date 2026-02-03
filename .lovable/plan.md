

# Fix User Login After Token Password Set

## Problem
When users set their password via the custom token flow (bypassing Supabase's native invite), their email is never confirmed (`email_confirmed_at` remains null). This causes login failures with "email invalid" errors.

## Root Cause
The `set-password-with-token` edge function only sets the password:
```typescript
await supabaseAdmin.auth.admin.updateUserById(
  tokenData.user_id,
  { password: password }  // Missing email_confirm: true
);
```

## Solution
Add `email_confirm: true` to the Admin API call, which sets `email_confirmed_at` to the current timestamp.

## Change Required

**File:** `supabase/functions/set-password-with-token/index.ts`

**Lines 70-74** - Update the `updateUserById` call:

```typescript
// Set the user's password AND confirm email using Admin API
// This is critical: when bypassing Supabase's native invite flow,
// we must manually confirm the email or the user won't be able to log in
const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
  tokenData.user_id,
  { 
    password: password,
    email_confirm: true  // Confirms the user's email
  }
);
```

## Additional Step: Fix Existing User
For the user who already set their password but can't log in, run this SQL in Lovable Cloud:

```sql
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE id = '08d1a5de-e669-4ec3-8902-f44c7f71494a';
```

## Files to Modify
1. `supabase/functions/set-password-with-token/index.ts` - Add `email_confirm: true`

