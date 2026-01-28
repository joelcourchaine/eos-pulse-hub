

# 7-Day Invite/Reset Token Implementation

## Overview

Implement a custom token system that gives users 7 days (instead of 1 hour) to click invite and password reset links. When clicked, our system validates the long-lived token and generates a fresh Supabase token just-in-time.

---

## How It Works

```text
User Created/Invited
        |
        v
Custom Token Created (7-day expiry)
        |
        v
Email Sent with link: /accept-invite?token=xxx
        |
        v
User Clicks Link (within 7 days)
        |
        v
validate-auth-token function:
  - Validates token (exists, unused, not expired)
  - Generates fresh Supabase link (1-hour, used immediately)
  - Marks token as used
  - Redirects to Supabase link
        |
        v
Supabase processes token
        |
        v
Redirects to /set-password or /reset-password
        |
        v
User sets password - Done!
```

---

## Existing Infrastructure (No Changes Needed)

| Component | Status |
|-----------|--------|
| `auth_tokens` table | Already exists with all required fields |
| `create_auth_token()` DB function | Already creates 7-day tokens |
| `generate_auth_token()` DB function | Already generates secure tokens |

---

## Implementation Steps

### Step 1: Create Edge Function `validate-auth-token`

New file: `supabase/functions/validate-auth-token/index.ts`

This function will:
1. Accept a token from the request
2. Look up the token in `auth_tokens` table
3. Validate: exists, not used, not expired
4. Generate a fresh Supabase auth link (invite or recovery based on `token_type`)
5. Mark the token as used
6. Return the redirect URL to the frontend

### Step 2: Create Frontend Page `AcceptInvite.tsx`

New file: `src/pages/AcceptInvite.tsx`

A simple page that:
1. Extracts the token from URL query params
2. Calls the `validate-auth-token` edge function
3. Shows a loading spinner while processing
4. On success: redirects to the Supabase action link
5. On error: shows user-friendly error message with option to request new link

### Step 3: Add Route to `App.tsx`

Add a new route:
```
/accept-invite → AcceptInvite component
```

### Step 4: Modify `create-user/index.ts`

Change from sending Supabase's 1-hour link directly to:
1. Create user in auth (no email sent by Supabase)
2. Create custom 7-day token using the `create_auth_token` database function
3. Send invite email with link pointing to `/accept-invite?token=xxx`
4. Update email template text from "24 hours" to "7 days"

### Step 5: Modify `resend-user-invite/index.ts`

Same pattern as create-user:
1. Create custom 7-day token
2. Send email with link to `/accept-invite?token=xxx`
3. Update email template text from "1 hour" to "7 days"

### Step 6: Update `send-auth-email/index.ts`

Update the email templates to say "7 days" instead of "24 hours" or "1 hour".

---

## File Summary

| File | Action |
|------|--------|
| `supabase/functions/validate-auth-token/index.ts` | CREATE |
| `src/pages/AcceptInvite.tsx` | CREATE |
| `src/App.tsx` | MODIFY (add route) |
| `supabase/functions/create-user/index.ts` | MODIFY |
| `supabase/functions/resend-user-invite/index.ts` | MODIFY |
| `supabase/functions/send-auth-email/index.ts` | MODIFY |
| `supabase/config.toml` | MODIFY (add new function config) |

---

## Technical Details

### validate-auth-token Edge Function

```typescript
// Key validation logic
const { data: tokenRecord } = await supabaseAdmin
  .from('auth_tokens')
  .select('*')
  .eq('token', token)
  .is('used_at', null)
  .single();

if (!tokenRecord) return { error: 'Invalid or already used token' };
if (new Date(tokenRecord.expires_at) < new Date()) return { error: 'Token expired' };

// Generate fresh Supabase link
const redirectTo = tokenRecord.token_type === 'invite' 
  ? `${appUrl}/set-password` 
  : `${appUrl}/reset-password`;

const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
  type: tokenRecord.token_type === 'invite' ? 'invite' : 'recovery',
  email: tokenRecord.email,
  options: { redirectTo }
});

// Mark token as used
await supabaseAdmin
  .from('auth_tokens')
  .update({ used_at: new Date().toISOString() })
  .eq('id', tokenRecord.id);

return { redirect_url: linkData.properties.action_link };
```

### Token Creation in create-user

```typescript
// Create 7-day token using existing DB function
const { data: customToken, error: tokenError } = await supabaseAdmin
  .rpc('create_auth_token', {
    _token_type: 'invite',
    _user_id: userId,
    _email: email,
    _created_by: user.id
  });

// Build invite link
const inviteLink = `${appUrl}/accept-invite?token=${customToken}`;

// Send email with our custom link
await sendInviteEmailViaResend(email, inviteLink, full_name);
```

### AcceptInvite Page Flow

```typescript
// On mount:
const token = searchParams.get('token');
const { data, error } = await supabase.functions.invoke('validate-auth-token', {
  body: { token }
});

if (data?.redirect_url) {
  window.location.href = data.redirect_url;
} else {
  setError(error?.message || 'This link is invalid or has expired');
}
```

---

## Benefits

1. **7-day window** - Users have plenty of time to click the link
2. **One-time use** - Token is marked used after first click, preventing reuse
3. **Secure** - Fresh Supabase tokens generated just-in-time
4. **Backward compatible** - Uses existing `auth_tokens` infrastructure
5. **Scanner-resistant** - The validate function only marks token used when generating the real link, so email scanners clicking links won't consume the token

