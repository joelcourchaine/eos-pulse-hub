

# Custom Token System for Extended Invite/Reset Links

## Overview
Implement a custom token system that replaces Supabase's 1-hour OTP tokens with longer-lived tokens stored in the `auth_tokens` table. Invite links will expire in 7 days and password reset links in 24 hours.

## Current State Analysis

### Existing Infrastructure
- **`auth_tokens` table**: Already exists with columns: `id`, `token`, `token_type`, `user_id`, `email`, `expires_at`, `used_at`, `created_by`, `created_at`
- **`create_auth_token` function**: Database function that generates tokens, invalidates old tokens of the same type, and inserts with 7-day expiry
- **`generate_auth_token` function**: Generates 256-bit hex tokens using `encode(gen_random_bytes(32), 'hex')`
- **Edge functions using Supabase links**: `resend-user-invite`, `send-password-reset`, `create-user` all generate 1-hour Supabase OTP links

### Current Flow
1. Admin triggers invite/reset
2. Edge function generates Supabase auth link (1-hour expiry)
3. Email sent with `?continue=` parameter to prevent scanner consumption
4. User clicks link → redirected to Supabase → session established → password form shown

### Target Flow
1. Admin triggers invite/reset
2. Edge function generates Supabase auth link AND custom token
3. Custom token stored in `auth_tokens` with original Supabase link
4. Email sent with custom token: `/set-password?token=<custom_token>`
5. User clicks link → `validate-auth-token` validates token → returns Supabase link → user completes flow

## Implementation Plan

### Phase 1: Database Changes

**Add `action_link` column to store Supabase link for later retrieval:**

```sql
ALTER TABLE auth_tokens ADD COLUMN action_link text;

COMMENT ON COLUMN auth_tokens.action_link IS 
  'Stores the Supabase auth action_link for retrieval during token validation';
```

### Phase 2: Update `resend-user-invite` Edge Function

**Key changes:**

| Section | Current | New |
|---------|---------|-----|
| Token Generation | Uses only Supabase link | Also generates custom UUID token |
| Token Storage | None | Stores in `auth_tokens` with Supabase link |
| Email Link | `?continue=${encodedSupabaseLink}` | `?token=${customToken}` |
| Invite Expiry Text | "1 hour" | "7 days" |
| Reset Expiry Text | "1 hour" | "24 hours" |

**Implementation details:**

1. After generating Supabase auth link, generate custom token:
```typescript
const customToken = crypto.randomUUID();
const tokenType = hasSetPassword ? 'password_reset' : 'invite';
const expiresAt = hasSetPassword 
  ? new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 hours
  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
```

2. Store token in database:
```typescript
// Invalidate any existing unused tokens for this user
await supabaseAdmin
  .from('auth_tokens')
  .update({ used_at: new Date().toISOString() })
  .eq('user_id', user_id)
  .eq('token_type', tokenType)
  .is('used_at', null);

// Insert new token with Supabase action_link
await supabaseAdmin.from('auth_tokens').insert({
  token: customToken,
  token_type: tokenType,
  user_id: user_id,
  email: realEmail,
  expires_at: expiresAt.toISOString(),
  created_by: user.id,  // admin who initiated
  action_link: actionLink  // original Supabase link
});
```

3. Update email link:
```typescript
const continueLink = hasSetPassword
  ? `${appUrl}/reset-password?token=${customToken}`
  : `${appUrl}/set-password?token=${customToken}`;
```

4. Update email templates:
- Invite: "This link will expire in 7 days."
- Reset: "This link will expire in 24 hours."

### Phase 3: Create `validate-auth-token` Edge Function

**New file: `supabase/functions/validate-auth-token/index.ts`**

Purpose: Securely validate custom tokens before allowing password setup.

**Functionality:**
- Accept POST request with `{ token: string }`
- Query `auth_tokens` table to find the token
- Validate: exists, not expired, not used
- If valid: return `{ valid: true, user_id, email, token_type, action_link }`
- If invalid: return `{ valid: false, error: 'expired' | 'already_used' | 'invalid' }`

**Security:**
- No authentication required (used before user is logged in)
- Uses service role key to query database
- Does NOT mark token as used (that happens on successful password set)

```typescript
// Pseudocode for validation logic
const { data: tokenRecord } = await supabaseAdmin
  .from('auth_tokens')
  .select('*')
  .eq('token', token)
  .single();

if (!tokenRecord) {
  return { valid: false, error: 'invalid' };
}

if (tokenRecord.used_at) {
  return { valid: false, error: 'already_used' };
}

if (new Date(tokenRecord.expires_at) < new Date()) {
  return { valid: false, error: 'expired' };
}

return { 
  valid: true, 
  user_id: tokenRecord.user_id,
  email: tokenRecord.email,
  token_type: tokenRecord.token_type,
  action_link: tokenRecord.action_link
};
```

### Phase 4: Update Frontend Pages

**`src/pages/SetPassword.tsx` changes:**

1. Check for `?token=` query parameter first
2. If present, call `validate-auth-token` edge function
3. If valid, redirect to the stored `action_link` (Supabase link)
4. If invalid/expired, show appropriate error with "Request new link" option

**New flow:**
```
User clicks email link
    ↓
SetPassword checks ?token= param
    ↓
Calls validate-auth-token
    ↓
If valid → window.location.href = action_link (Supabase link)
    ↓
Supabase processes token → establishes session
    ↓
SetPassword detects session → shows password form
```

**`src/pages/ResetPassword.tsx` changes:**

Same pattern as SetPassword - check for custom token, validate, redirect to action_link.

### Phase 5: Mark Token as Used

**Update password submission flow:**

When password is successfully set (in both SetPassword and ResetPassword), call a new endpoint or inline logic to mark the token as used:

```typescript
// After successful password update
if (customToken) {
  await supabase.functions.invoke('mark-token-used', {
    body: { token: customToken }
  });
}
```

Alternatively, create a `complete-auth-token` edge function that:
1. Validates token one more time
2. Marks token as used (`used_at = NOW()`)
3. Returns success

### Phase 6: Update Related Functions

**`supabase/functions/send-password-reset/index.ts`:**
- Same pattern as `resend-user-invite` for password reset requests
- Generate custom token with 24-hour expiry
- Store with `token_type: 'password_reset'`
- Update email link to use custom token
- Update expiry text to "24 hours"

**`supabase/functions/create-user/index.ts`:**
- Generate custom token with 7-day expiry for initial invites
- Store with `token_type: 'invite'`
- Update email link to use custom token
- Update expiry text to "7 days" (currently says "24 hours")

## Files to Modify

| File | Changes |
|------|---------|
| **Database Migration** | Add `action_link` column to `auth_tokens` |
| `supabase/functions/resend-user-invite/index.ts` | Generate custom tokens, store with action_link, update email links |
| `supabase/functions/send-password-reset/index.ts` | Generate custom tokens, update email links |
| `supabase/functions/create-user/index.ts` | Generate custom tokens for new user invites |
| `supabase/functions/validate-auth-token/index.ts` | **New file** - Token validation endpoint |
| `src/pages/SetPassword.tsx` | Check for custom token, validate, redirect to action_link |
| `src/pages/ResetPassword.tsx` | Check for custom token, validate, redirect to action_link |

## Token Lifecycle

```text
┌──────────────────────────────────────────────────────────────────┐
│                    Token Lifecycle                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CREATION (Edge Function)                                     │
│     ├─ Generate Supabase auth link                               │
│     ├─ Generate custom UUID token                                │
│     ├─ Invalidate previous tokens for same user/type             │
│     └─ Store token + action_link in auth_tokens                  │
│                                                                  │
│  2. VALIDATION (validate-auth-token)                             │
│     ├─ Look up token in auth_tokens                              │
│     ├─ Check: exists? not expired? not used?                     │
│     └─ Return action_link if valid                               │
│                                                                  │
│  3. CONSUMPTION (Frontend)                                       │
│     ├─ Redirect to action_link (Supabase link)                   │
│     ├─ Supabase establishes session                              │
│     └─ User sets password                                        │
│                                                                  │
│  4. COMPLETION (After password set)                              │
│     └─ Mark token as used (used_at = NOW())                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Expiry Times

| Token Type | Duration | Use Case |
|------------|----------|----------|
| `invite` | 7 days | New user invitation |
| `password_reset` | 24 hours | Existing user password reset |

## Security Considerations

1. **Token invalidation**: When a new token is generated, previous unused tokens of the same type are invalidated
2. **One-time use**: Tokens are marked as used after successful password set
3. **Secure storage**: Tokens are 256-bit random UUIDs
4. **No enumeration**: validate-auth-token returns generic errors that don't reveal token existence
5. **Scanner protection**: Two-step flow (validate token → redirect to Supabase) prevents email scanners from consuming tokens

## Testing Plan

| Phase | Test | Verification |
|-------|------|--------------|
| 1 | Token stored in DB | Query `auth_tokens` after sending invite |
| 1 | Email contains new link format | Check email for `/set-password?token=<uuid>` |
| 2 | Valid token returns success | Call validate-auth-token with valid token |
| 2 | Expired token rejected | Manually expire token, verify rejection |
| 2 | Used token rejected | Manually set used_at, verify rejection |
| 3 | Password form appears | Click invite link, verify form shows |
| 3 | Token marked used after password set | Check auth_tokens after successful password set |
| 3 | Token cannot be reused | Try same link again, verify rejection |
| Full | End-to-end invite flow | Admin sends invite → User sets password → User logs in |
| Full | End-to-end reset flow | User requests reset → User resets password → User logs in |

