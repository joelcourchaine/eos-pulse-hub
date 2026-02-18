

# Fix: Add Team Member Button Not Visible

## Problem
The "Add Team Member" button is hidden due to a race condition. The page shows content as soon as the profile loads (`loading` from `fetchProfile`), but the user's **roles** may not have loaded yet at that point. Since `canManage` defaults to `false` while roles are loading, the button never appears during that window -- and depending on render timing, it may stay hidden.

## Solution
Use the `loading` state from `useUserRole` to defer rendering the header actions until roles are confirmed. This is a small change to `src/pages/MyTeam.tsx`.

## Technical Details

**File: `src/pages/MyTeam.tsx`**

1. Destructure `loading` from `useUserRole` (rename to `rolesLoading` to avoid conflict):

```tsx
const { isSuperAdmin, isStoreGM, isDepartmentManager, isFixedOpsManager, loading: rolesLoading } = useUserRole(user?.id);
```

2. Update the page's loading gate (around line 88) to also wait for roles:

```tsx
if (loading || rolesLoading) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
```

This ensures the page (including the header with the button) only renders after both the profile **and** roles have been fetched, so `canManage` reflects the user's actual permissions.

No other changes needed -- the `canManage` logic and `AddTeamMemberDialog` rendering are already correct.
