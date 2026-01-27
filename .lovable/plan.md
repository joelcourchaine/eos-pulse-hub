
## Update APP_BASE_URL Pattern to Strip Trailing Slashes

This change ensures consistent URL handling across all edge functions by removing any trailing slashes from the `APP_BASE_URL` environment variable.

### Summary
Add `.replace(/\/+$/, '')` to strip trailing slashes from the app base URL in the two remaining edge functions that don't have this fix yet.

---

### Files to Update

**1. `supabase/functions/send-ticket-notification/index.ts` (line 58)**

Change:
```typescript
const appBaseUrl = Deno.env.get("APP_BASE_URL") || "https://app.dealergrowth.solutions";
```

To:
```typescript
const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "https://app.dealergrowth.solutions").replace(/\/+$/, '');
```

---

**2. `supabase/functions/submit-signature/index.ts` (line 330)**

Change:
```typescript
const appUrl = Deno.env.get("APP_BASE_URL") || 'https://dealergrowth.solutions';
```

To:
```typescript
const appUrl = (Deno.env.get("APP_BASE_URL") || 'https://dealergrowth.solutions').replace(/\/+$/, '');
```

---

### Already Fixed (No Changes Needed)
- `supabase/functions/send-signature-request/index.ts` - already has `.replace(/\/+$/, "")`
- `supabase/functions/send-questionnaire-email/index.ts` - already has `.replace(/\/+$/, '')`

### Why This Matters
This prevents URL construction issues like `https://app.domain.com//admin/tickets` (double slashes) when the environment variable is set with a trailing slash.
