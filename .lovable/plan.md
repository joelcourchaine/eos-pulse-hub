
## Current Behaviour — No Automatic Domain Guiding

The app does **not** guide users to `smggrowth.ca` or `murraygrowth.ca` based on their store group. Here's exactly how the flow works today:

### Invitation email
The `create-user` edge function hardcodes the invite link to:
```
https://dealergrowth.solutions/set-password?token=...
```
This is the generic URL regardless of which store group the new user belongs to.

### Set Password → redirect to login
After setting their password, `SetPassword.tsx` always redirects to:
```
navigate("/auth")  // i.e. same domain they're already on
```

### Login page
`Auth.tsx` always redirects to `/dashboard` after sign-in — no domain-based redirect.

### The domain filtering that DOES exist
The `HomeRoute` in `App.tsx` and the `Dashboard` page use `window.location.hostname` to check if you're **already on** `murraygrowth.ca` or `smggrowth.ca`, and shows the branded UI. But this is passive — it only works if the user navigated there themselves.

---

## What Would Need to Change (if you want this)

To guide users to their branded domain, there are two places to update:

**1. Invite email link** — `supabase/functions/create-user/index.ts` (line 303/363)
Currently: `const appUrl = "https://dealergrowth.solutions"`
Need to: Look up the new user's `store_group_id` and map it to the correct domain:
- Murray Group (`c386eaed-...`) → `https://murraygrowth.ca`
- Steve Marshall Group (`9fc8d816-...`) → `https://smggrowth.ca`
- Everything else → `https://dealergrowth.solutions`

**2. After password set / after login** — `src/pages/SetPassword.tsx` and `src/pages/Auth.tsx`
After password is set or login succeeds, redirect to the correct domain based on the user's `store_group_id` from their profile.

---

## Short Answer

Right now: **No.** A new SMG or Murray user receives an invite link to `dealergrowth.solutions`, sets their password there, logs in there, and sees the generic UI — unless they manually navigate to the branded domain.

Would you like me to implement domain-guided invitations so:
- SMG users get invite links pointing to `smggrowth.ca`
- Murray users get invite links pointing to `murraygrowth.ca`
- After login, users are redirected to their branded domain if they signed in on the wrong one?
