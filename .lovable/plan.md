

# Direct Password Setting Without Redirect

## Overview
Simplify the password setup flow by eliminating the redirect to Supabase's `action_link`. Instead, when a user clicks their invitation link with a custom token, they'll go directly to the password form and set their password via a new edge function that uses the admin API.

## Why This Change?
The current flow redirects users through Supabase's magic link system, which:
- Adds extra redirects and complexity
- Can be confusing when the Supabase token expires (1 hour) but our custom token hasn't (7 days)
- Creates issues with email security scanners consuming tokens

The new flow keeps everything on your domain and uses the custom token directly.

## Changes Required

### 1. New Edge Function: `set-password-with-token`

Create `supabase/functions/set-password-with-token/index.ts`:

**Functionality:**
- Accepts `{ token: string, password: string }`
- Validates the custom token (checks: exists, not used, not expired)
- Uses `supabaseAdmin.auth.admin.updateUserById()` to set the user's password
- Marks the token as used
- Updates `password_set_at` in profiles table
- Returns success/error response

**Security Considerations:**
- No authentication required (public endpoint - token IS the authentication)
- Token can only be used once
- Token has expiration (7 days for invites, 24 hours for resets)
- Password validation (minimum 6 characters)

### 2. Update Frontend: `SetPassword.tsx`

**Key Changes:**
- Remove the redirect to `action_link` when token is valid
- Store `userId` and `userName` from token validation response
- Go directly to 'ready' state when token validates
- In `handleSetPassword`, call the new `set-password-with-token` edge function instead of `supabase.auth.updateUser()`
- Remove dependency on having an active Supabase session

**Flow Diagram:**
```text
User clicks email link (/set-password?token=xyz)
        |
        v
Validate token via validate-auth-token
        |
        +-- Invalid/Expired --> Show error page
        |
        +-- Valid --> Store user info, show password form
                          |
                          v
                    User enters password
                          |
                          v
              Call set-password-with-token edge function
                          |
                          +-- Error --> Show error message
                          |
                          +-- Success --> Show success, redirect to login
```

### 3. Update Config: `supabase/config.toml`

Add the new edge function configuration:
```toml
[functions.set-password-with-token]
verify_jwt = false
```

## Technical Implementation Details

### Edge Function Logic

```typescript
// Pseudocode for set-password-with-token

1. Parse request: { token, password }
2. Validate password (min 6 chars)
3. Query auth_tokens table for token
4. Check: token exists, not used, not expired
5. Get user_id from token record
6. Call supabaseAdmin.auth.admin.updateUserById(user_id, { password })
7. Update auth_tokens: set used_at = now()
8. Update profiles: set password_set_at = now()
9. Return { success: true }
```

### Frontend State Changes

Replace `user: User | null` and `profile` state with simpler:
- `userId: string | null`
- `userName: string | null`  
- `userEmail: string`

### Files to Modify

1. **Create** `supabase/functions/set-password-with-token/index.ts` - New edge function
2. **Edit** `src/pages/SetPassword.tsx` - Updated flow without redirect
3. **Edit** `supabase/config.toml` - Add new function configuration

## Testing Checklist

- [ ] Create a new user and verify invitation email is sent
- [ ] Click invitation link and verify password form appears (no redirect)
- [ ] Set password and verify success message
- [ ] Login with new password
- [ ] Verify token is marked as used (clicking link again shows "already used" error)
- [ ] Test expired token scenario
- [ ] Test password reset flow (existing users) works the same way

