

## Add Current User as Email Recipient

### Problem
The email dialog only fetches super_admins and store_gms as potential recipients. Users who have Enterprise access (e.g., controllers, department managers, fixed ops managers) don't appear in the list and can't email themselves.

### Solution
Add the currently logged-in user to the recipient list automatically, so they always see themselves as an option regardless of role. They will appear at the top of the list labeled with "You" for easy identification.

### Technical Changes

**File: `src/components/enterprise/EmailComparisonDialog.tsx`**

1. Get the current user's session at the start of `fetchRecipients` via `supabase.auth.getUser()`
2. After building the existing recipient list (super_admins + GMs), check if the current user is already in the list
3. If not, fetch their profile and prepend them to the list with role label "You"
4. If already present (e.g., they are a super_admin), update their role label to include "(You)" so they can easily spot themselves

No database changes or edge function changes required -- this is a frontend-only change to the recipient fetching logic.
