
## The Problem

The `create-user` edge function has a `validRoles` allowlist (lines 246–258) that hardcodes every accepted role value. `"executive"` was never added to it. When the frontend sends `role: "executive"`, the function returns a 400 error.

Additionally, since only super admins should be able to create executive users (same restriction as `super_admin` and `consulting_scheduler`), the guard at line 270 needs to include `"executive"`.

## Changes Required

**`supabase/functions/create-user/index.ts`** — two edits:

1. **Line 257** — add `"executive"` to `validRoles`:
```ts
const validRoles = [
  "super_admin",
  "store_gm",
  ...
  "consulting_scheduler",
  "executive",   // ← add this
];
```

2. **Line 270** — add `"executive"` to the super-admin-only guard:
```ts
if ((role === "super_admin" || role === "consulting_scheduler" || role === "executive") && callerRole !== "super_admin") {
```

That's the complete fix — two lines in one file, then redeploy the edge function.
