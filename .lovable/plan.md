
## The Problem

When a new technician is created, the UI doesn't show them in the dropdown or auto-select them after creation. There are two race conditions:

1. **Profile race**: The `create-user` edge function sets `store_id` on the profile *after* creating the user. The `refetchUsers()` call in `onSuccess` fires immediately, potentially before the profile update completes, so the new user (filtered by `store_id`) doesn't appear in results.

2. **Auto-select timing**: `setMappings` runs to auto-select the new user, but since `storeUsers` doesn't include them yet, the badge shows `"Mapped"` instead of their name — and on next render the mapping may also reset (since `storeUsers` is null for that ID).

## Fix Plan

### `src/components/scorecard/TechnicianImportPreviewDialog.tsx`

In the `createUserMutation.onSuccess` handler (lines 196–211):

1. **Add a small delay before refetching** — wait 500ms to let the edge function finish writing the `store_id` to the profile before the frontend queries it.

2. **Invalidate the query key** in addition to calling `refetchUsers()`, to ensure React Query marks it stale and triggers a fresh fetch.

3. **Move the `setMappings` auto-select AFTER the await** so it runs once the updated `storeUsers` is available, ensuring the new user is in the list when they get auto-selected.

```typescript
onSuccess: async (data, _vars) => {
  toast({ title: "User created", description: `${_vars.fullName} added as Technician` });
  
  // Wait for edge function to finish writing store_id to profile
  await new Promise((resolve) => setTimeout(resolve, 600));
  
  // Invalidate + refetch so the new user appears in the list
  await queryClient.invalidateQueries({ queryKey: ["store-users-tech-import", storeId] });
  await refetchUsers();
  
  // Auto-select the newly created user
  if (data?.user?.id && newUserForm.techIndex !== null) {
    setMappings((prev) => {
      const updated = [...prev];
      updated[newUserForm.techIndex!] = {
        ...updated[newUserForm.techIndex!],
        selectedUserId: data.user.id,
        isNew: false,
      };
      return updated;
    });
  }
  setNewUserForm({ techIndex: null, fullName: "", email: "", isSubmitting: false });
},
```

That's the only change needed — one file, the `onSuccess` callback.
