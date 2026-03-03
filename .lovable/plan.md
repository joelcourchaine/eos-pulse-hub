
## Two fixes in `send-todos-email/index.ts`

### Fix 1 — Exclude "in_progress" issues (line 77)
Add `.neq("status", "in_progress")` to the issues query so only truly `open` issues appear:
```ts
.neq("status", "resolved")
.neq("status", "in_progress")  // ← add this
```

### Fix 2 — Date showing one day ahead (line 108)
The edge function runs in UTC. When it's March 2 at 10pm in the user's timezone, the server clock reads March 3 UTC, so `new Date().toLocaleDateString()` returns March 3.

**Fix**: pass `clientDate` from the browser in the request payload and use it in the email instead of computing it server-side.

**Client side** (`src/components/issues/EmailTodosDialog.tsx` or wherever the function is invoked) — add `clientDate` to the request body:
```ts
clientDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
```

**Edge function** — read `clientDate` from the request and fall back to server date if absent:
```ts
const { departmentId, recipientEmails, clientDate } = await req.json();
const dateStr = clientDate || now.toLocaleDateString("en-US", { ... });
```

### Files changed
- `supabase/functions/send-todos-email/index.ts` — 2 small changes, redeploy
- `src/components/issues/EmailTodosDialog.tsx` (or equivalent call site) — pass `clientDate`
