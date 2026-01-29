

# 7-Day Invite/Reset Token Implementation

## Status: ✅ IMPLEMENTED

## Overview

Implemented a custom token system that gives users 7 days (instead of 1 hour) to click invite and password reset links. When clicked, our system validates the long-lived token and generates a fresh Supabase token just-in-time.

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

## Implemented Components

| Component | Status |
|-----------|--------|
| `auth_tokens` table | ✅ Already existed |
| `create_auth_token()` DB function | ✅ Already existed |
| `generate_auth_token()` DB function | ✅ Already existed |
| `validate-auth-token` edge function | ✅ Created |
| `AcceptInvite.tsx` page | ✅ Created |
| `/accept-invite` route | ✅ Added |
| `create-user` 7-day tokens | ✅ Updated |
| `resend-user-invite` 7-day tokens | ✅ Updated |
| Email templates (7 days text) | ✅ Updated |

---

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/validate-auth-token/index.ts` | ✅ CREATED |
| `src/pages/AcceptInvite.tsx` | ✅ CREATED |
| `src/App.tsx` | ✅ MODIFIED (added route) |
| `supabase/functions/create-user/index.ts` | ✅ MODIFIED |
| `supabase/functions/resend-user-invite/index.ts` | ✅ MODIFIED |
| `supabase/functions/send-auth-email/index.ts` | ✅ MODIFIED |
| `supabase/config.toml` | ✅ MODIFIED (added function config) |

---

## Benefits

1. **7-day window** - Users have plenty of time to click the link
2. **One-time use** - Token is marked used after first click, preventing reuse
3. **Secure** - Fresh Supabase tokens generated just-in-time
4. **Backward compatible** - Uses existing `auth_tokens` infrastructure
5. **Scanner-resistant** - The validate function only marks token used when generating the real link, so email scanners clicking links won't consume the token
