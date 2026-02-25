
## Problem

In `AddTeamMemberDialog.tsx`, the validation on line 47 requires both `name` and `position`:

```typescript
if (!name.trim() || !position) {
  toast({ title: "Missing fields", description: "Name and Position are required.", variant: "destructive" });
  return;
}
```

When `isVacant` is true, name should be optional — the position alone is enough to represent a vacant slot on the org chart. The name should default to something like "Vacant" or just use the position label as the display name.

## Changes

### `src/components/team/AddTeamMemberDialog.tsx`

1. **Relax validation**: When `isVacant` is true, only require `position` (not `name`)
2. **Auto-fill name**: If `isVacant` is true and name is empty, use `"Vacant"` as the name when inserting (so the org chart still has something to display)
3. **UX tweak**: When the user toggles `isVacant` on, grey out / disable the Name input and clear it, making it visually obvious it's not needed

### `src/components/team/TeamMemberDetailPanel.tsx`

Same fix — when editing an existing member and `isVacant` is toggled on, the name field should become optional and auto-fill to "Vacant" if blank.

## Files Changed
- `src/components/team/AddTeamMemberDialog.tsx`
- `src/components/team/TeamMemberDetailPanel.tsx`
