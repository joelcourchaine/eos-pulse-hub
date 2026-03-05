
## What's Actually Happening

The logs confirm the **new HTML template IS deployed and working**. The email the user received came from the **old Dashboard-level email button** (no `roleFilter` parameter sent → all 37 KPIs included, no filtering). The new Email button inside the GO Scorecard header is working correctly and DOES support role filtering.

**Two real problems to fix:**

### Problem 1 — Role filter doesn't exclude dept manager KPIs reliably
The edge function filters `user_roles` table but many users have their role stored in `profiles.role` as a fallback. If a department manager's role is only in `profiles.role` (not in `user_roles`), the filter won't exclude them.

Fix: Also query `profiles` table to get roles, merged with `user_roles` data.

### Problem 2 — The popover role selector includes "all" option implicitly via `selectedRoleFilter` default  
When the popover opens it syncs to `selectedRoleFilter` which could be "all" — meaning no filtering is applied. Need to ensure when `emailRoleFilter === "all"`, the behavior is clear.

Also: The **Dashboard email dialog** (`src/pages/Dashboard.tsx`) should be updated or a note added in the popover UI that users should use the GO Scorecard header Email button for role-filtered sends.

---

## Fix Plan

### 1. Edge function — make role filter robust (`send-scorecard-email/index.ts`)

After the existing `user_roles` query (line ~572), also query `profiles` for users whose role is only stored there:

```typescript
// After user_roles query:
const { data: profileRolesData } = await supabaseClient
  .from("profiles")
  .select("id, role")
  .in("id", allOwnerIds);

// Merge: user_roles takes precedence, profiles.role as fallback
const ownerRoleMap = new Map<string, string>();
profileRolesData?.forEach(p => { if (p.role) ownerRoleMap.set(p.id, p.role); });
userRolesData?.forEach(ur => { ownerRoleMap.set(ur.user_id, ur.role); }); // overwrite with user_roles

const usersWithRole = new Set(
  Array.from(ownerRoleMap.entries())
    .filter(([_, role]) => role === roleFilter)
    .map(([userId]) => userId)
);
```

### 2. ScorecardGrid — ensure "all" roleFilter gets handled + improve UX clarity

When `emailRoleFilter === "all"`, the edge function skips filtering (already correct). But the default should be a real role, not "all", when the popover opens. Currently it syncs to `selectedRoleFilter` which could be "all".

Fix: When the popover opens and `selectedRoleFilter === "all"`, default to `"service_advisor"` instead.

Change line ~3755:
```tsx
if (open) { 
  setEmailRoleFilter(selectedRoleFilter === "all" ? "service_advisor" : selectedRoleFilter); 
}
```

Also add an "All Roles" option to the Select so the user can explicitly send all if desired.

### Files to change
- `supabase/functions/send-scorecard-email/index.ts` (~line 572–587): fix role filter to check `profiles.role` fallback
- `src/components/scorecard/ScorecardGrid.tsx` (~line 3755): fix default roleFilter when opening popover
