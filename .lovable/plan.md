
## Root Cause

The `set-password-with-token` edge function hits Supabase's HaveIBeenPwned password check when Aaron (or any user) sets a commonly-breached password. Supabase rejects it with `AuthWeakPasswordError` / code `weak_password`. 

The edge function catches this in the generic `updateError` block and returns:
```json
{ "success": false, "error": "Failed to set password" }
```
with **status 500** — which the Supabase client SDK treats as a non-2xx error, triggering the cryptic "edge function returned a non-2xx status code" toast rather than showing the actual "password is compromised" message.

## Fix

Single change to `supabase/functions/set-password-with-token/index.ts`:

**Before** (lines 95-101) — catches all errors generically as 500:
```ts
if (updateError) {
  console.error('Error updating password:', updateError);
  return new Response(
    JSON.stringify({ success: false, error: 'Failed to set password' }),
    { status: 500, ... }
  );
}
```

**After** — detect `weak_password` / pwned password specifically and return a **400** with a clear user-facing message:
```ts
if (updateError) {
  console.error('Error updating password:', updateError);
  
  // Detect HaveIBeenPwned / weak password rejection
  const isWeakPassword = 
    updateError.code === 'weak_password' || 
    updateError.name === 'AuthWeakPasswordError' ||
    updateError.message?.toLowerCase().includes('weak') ||
    updateError.message?.toLowerCase().includes('pwned');

  if (isWeakPassword) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'This password has appeared in a data breach and cannot be used. Please choose a different password.' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({ success: false, error: 'Failed to set password. Please try again.' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Why 400 matters**: The Supabase JS client only throws "non-2xx status code" when the HTTP status is 4xx/5xx without a parseable JSON body OR when there's truly no `error` in the response data. By keeping it 400 with a valid JSON body, the `data.error` field in `SetPassword.tsx` line 198 catches it cleanly:
```ts
if (!data.success) {
  throw new Error(data.error || 'Failed to set password'); // ← shows the clear message
}
```

The user will now see: **"This password has appeared in a data breach and cannot be used. Please choose a different password."** — actionable and clear.

## Files to change

- `supabase/functions/set-password-with-token/index.ts` — lines 95-101 only
