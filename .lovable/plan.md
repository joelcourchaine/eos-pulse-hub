

# Fix Token Validation Fall-Through Race Condition

## Problem
When a user visits `/set-password?token=...` with a URL that also contains legacy Supabase error hash parameters (e.g., `#error=access_denied`), the custom token validation succeeds but then the code falls through to the hash error check, incorrectly triggering an "expired" state.

## Root Cause
The `if (tokenParam)` block in both `SetPassword.tsx` and `ResetPassword.tsx` validates custom tokens and redirects to the Supabase action_link. However, if additional state handling is added (e.g., setting `userEmail` from the token response), the code may not have a proper early `return` to prevent subsequent legacy error checks from executing.

## Solution
Ensure that after successfully validating a custom token and extracting user info, there is an explicit `return` statement before the code can reach the hash-based error checking logic.

## Files to Modify

### 1. `src/pages/SetPassword.tsx`

**Current flow (lines 74-83):**
```typescript
// Token is valid - redirect to the Supabase action_link
if (data.action_link) {
  console.log('Token valid, redirecting to Supabase action link...');
  window.location.href = data.action_link;
  return;
} else {
  setFlowState('error');
  setErrorMessage('Invalid invitation link configuration. Please contact support.');
  return;
}
```

**Enhanced flow - Add user info extraction before redirect:**
```typescript
// Token is valid - capture user info for display if needed
if (data.email) {
  setUserEmail(data.email);
  if (!user) {
    setUser({ email: data.email, id: data.user_id } as User);
  }
}

// Redirect to the Supabase action_link
if (data.action_link) {
  console.log('Token valid, redirecting to Supabase action link...');
  window.location.href = data.action_link;
  return;
} else {
  setFlowState('error');
  setErrorMessage('Invalid invitation link configuration. Please contact support.');
  return;
}
```

Note: The existing `return` statements already prevent fall-through. However, if in the future someone adds code after the `if (data.action_link)` block without a return, the race condition would occur. The key is ensuring the block is properly terminated.

### 2. `src/pages/ResetPassword.tsx`

Same pattern - add user info extraction:

**Current flow (lines 65-73):**
```typescript
// Token is valid - redirect to the Supabase action_link
if (data.action_link) {
  console.log('Token valid, redirecting to Supabase action link...');
  window.location.href = data.action_link;
  return;
} else {
  setFlowState('expired');
  return;
}
```

**Enhanced flow:**
```typescript
// Token is valid - capture user info for use if redirect fails
if (data.email) {
  setUserEmail(data.email);
}

// Redirect to the Supabase action_link
if (data.action_link) {
  console.log('Token valid, redirecting to Supabase action link...');
  window.location.href = data.action_link;
  return;
} else {
  setFlowState('expired');
  return;
}
```

## Summary of Changes

| File | Change |
|------|--------|
| `SetPassword.tsx` | Add `setUserEmail(data.email)` and mock `setUser()` before the action_link redirect block |
| `ResetPassword.tsx` | Add `setUserEmail(data.email)` before the action_link redirect block |

Both files already have proper `return` statements, but this change ensures user info is captured for display purposes (e.g., in error states or if the redirect fails) while the existing returns prevent fall-through to legacy hash checking.

## Testing

1. Visit `/set-password?token=valid_token#error=access_denied` 
2. Verify the custom token validation succeeds and redirects correctly
3. Verify the hash error is NOT processed
4. Test expired token scenario still shows proper error
5. Test already-used token scenario still shows proper error

