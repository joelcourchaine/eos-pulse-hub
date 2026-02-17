

# Allow Editing Process Title in Builder Mode

## Problem

The process title ("Customer Journey" in the screenshot) is displayed as static text and cannot be edited, even when the user is in edit mode.

## Fix

### File: `src/pages/ProcessDetail.tsx`

**Replace the static `<h1>` title (line 571) with a conditional render:**

- **In edit mode**: Show an `<Input>` field pre-filled with the current title. On blur (or Enter key), persist the change to the `processes` table and update local state.
- **In view mode**: Keep the existing static `<h1>`.

Also make the description editable in the same way -- swap the `<p>` tag (line 573) for a `<Textarea>` when editing.

### Implementation Details

1. **Add local state** for the editable title and description values, initialized from `process.title` / `process.description`.
2. **Render logic** at ~line 571:
   ```
   {editing ? (
     <Input
       value={editTitle}
       onChange={...}
       onBlur={saveTitle}
       className="text-2xl font-bold h-auto py-1 px-2"
     />
   ) : (
     <h1 className="text-2xl font-bold">{process.title}</h1>
   )}
   ```
3. **Save handler** (`saveTitle`): calls `supabase.from("processes").update({ title }).eq("id", processId)` and updates local `process` state. Same pattern for description.
4. Sync the local edit values whenever `process` or `editing` state changes.

This follows the existing decoupled state pattern used elsewhere in the builder (local instant updates, DB persistence on blur).
