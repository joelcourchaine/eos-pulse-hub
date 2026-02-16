

# Add Delete Process Capability

## Overview

Add a delete button to each process row on the Processes page, allowing authorized users to remove processes. The delete will soft-delete by setting `is_active = false` (already filtered out by the existing query).

---

## Changes

### `src/pages/Processes.tsx`

1. Import `Trash2` icon from lucide-react and the `AlertDialog` components for a confirmation prompt.
2. Add a delete handler function that sets `is_active = false` on the process and removes it from local state.
3. On each process row (around line 140), add a trash icon button (visible only when `canEdit` is true) that triggers a confirmation dialog before deleting.
4. The confirmation dialog asks "Are you sure you want to delete this process?" with Cancel/Delete buttons.

### No database changes needed

The existing `is_active` column and RLS UPDATE policies already support this. The query already filters by `is_active = true`, so setting it to `false` effectively removes it from view.

---

## Technical Details

- **Soft delete pattern**: `UPDATE processes SET is_active = false WHERE id = ?` -- preserves data for potential recovery
- **Permission gating**: Delete button only shown when `canEdit` is true (same roles: super_admin, store_gm, department_manager, fixed_ops_manager)
- **Confirmation**: Uses existing `AlertDialog` component to prevent accidental deletion
- **UI**: Small trash icon on the right side of each process row, with `stopPropagation` to prevent navigating into the process when clicking delete

