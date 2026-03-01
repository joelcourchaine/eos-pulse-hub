
## Plan: Make Email Optional in Inline Technician Creation

### Problem
The "Create new user" inline form in `TechnicianImportPreviewDialog.tsx` requires both `fullName` AND `email` to enable the Create Technician button. Email is unnecessary — the `create-user` edge function already auto-generates a dummy email (`user-{uuid}@test.local`) when none is provided.

### Changes to `src/components/scorecard/TechnicianImportPreviewDialog.tsx`

1. **Remove the Email `<Input>` field** from the inline create form (lines ~531–586)
2. **Update the button disabled condition** — remove `!newUserForm.email` from line ~560
3. **Pass empty string for email** in the `createUserMutation` call — it already handles this

That's it — one file, three small edits.
