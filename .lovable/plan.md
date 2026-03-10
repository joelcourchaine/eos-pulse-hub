
## Where to Add Executive Users

Here's the current state and what's needed:

### Where users are created today
The **Add User** dialog (`AdminUsersTab` → "Add User" button on the Super Admin Dashboard) has the role dropdown. Currently it lists: Super Admin, Store GM, Consulting Scheduler, Controller, Department Manager, Fixed Ops Manager, Read Only, Sales Advisor, Service Advisor, Technician, Parts Advisor.

**`executive` is not in either list** — it was added to the database enum but never added to the role `<SelectItem>` lists in `AddUserDialog.tsx` or `UserManagementDialog.tsx`.

### What needs to change

Two files need `executive` added as a role option, both gated to `isSuperAdmin`:

**`src/components/users/AddUserDialog.tsx`** — line ~297 in the role `<Select>`:
```tsx
{isSuperAdmin && <SelectItem value="executive">Executive</SelectItem>}
```
Executive users also need a **store group** assigned (not a specific store), since they see the whole group — the existing store group picker already handles this.

**`src/components/users/UserManagementDialog.tsx`** — line ~678 in the role `<Select>` inside the table:
```tsx
{isSuperAdmin && <SelectItem value="executive">Executive</SelectItem>}
```

**`src/components/admin/AdminUsersTab.tsx`** — add a purple badge color for the `executive` role in `roleColors`:
```ts
executive: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
```

### Summary of changes

| File | Change |
|------|--------|
| `src/components/users/AddUserDialog.tsx` | Add `executive` `SelectItem` (super admin only) |
| `src/components/users/UserManagementDialog.tsx` | Add `executive` `SelectItem` (super admin only) |
| `src/components/admin/AdminUsersTab.tsx` | Add purple badge color for `executive` role |

### How to use it after this change
1. Go to **Super Admin Dashboard → Users tab**
2. Click **"Add User"**
3. Set Role to **"Executive"**
4. Assign a **Store Group** (the "OR" section under Store Access) — this gives them group-wide access
5. Send the invite
