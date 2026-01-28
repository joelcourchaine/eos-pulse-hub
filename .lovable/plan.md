

# Plan: Allow Adding Tasks Without a Deployed Routine

## Overview
Currently, the "+ Add task" feature only works when there's an existing routine deployed for that cadence. When no routine exists, users see "No {cadence} routines assigned" with no way to add tasks.

This plan enables Department Managers, Fixed Ops Managers, Store GMs, and Super Admins to add tasks to any cadence, even if no routine has been deployed yet. The system will automatically create a new routine record on-the-fly when the first task is added.

---

## Current Behavior
- **With deployed routine**: Shows checklist with "+ Add task" button at the bottom
- **Without deployed routine**: Shows empty state message with no action available

## Proposed Behavior
- **With deployed routine**: No change - works as before
- **Without deployed routine**: Show an "+ Add task" button in the empty state that creates a new routine when used

---

## Technical Approach

### 1. Create New Component: `AddRoutineWithTask.tsx`
A new inline component that:
- Appears in the empty state when `canAddItems` is true
- On task submission, creates a new `department_routines` record with the first task
- After creation, triggers a refetch so the full `RoutineChecklist` takes over

**Key logic:**
```text
┌────────────────────────────────────────┐
│  User clicks "+ Add task" in empty state│
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│  Show inline input field               │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│  INSERT into department_routines:      │
│  - department_id (from props)          │
│  - cadence (from active tab)           │
│  - title: "{Cadence} Tasks"            │
│  - items: [{ id, title, order: 1 }]    │
│  - is_active: true                     │
└──────────────────┬─────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────┐
│  Call onRoutineCreated() to refetch    │
└────────────────────────────────────────┘
```

### 2. Update `RoutineSidebar.tsx`
Modify the empty state (lines 436-442) to show the add button when `canAddItems` is true:

**Before:**
```tsx
<div className="flex flex-col items-center...">
  <p>No {activeCadence} routines assigned</p>
</div>
```

**After:**
```tsx
<div className="flex flex-col items-center...">
  <p>No {activeCadence} routines assigned</p>
  {canAddItems && (
    <AddRoutineWithTask
      departmentId={departmentId}
      cadence={activeCadence}
      onRoutineCreated={fetchRoutines}
    />
  )}
</div>
```

### 3. Update `RoutineDrawer.tsx`
Apply the same pattern to the mobile drawer's empty state (lines 320-326).

### 4. Update Barrel Export
Add the new component to `src/components/routines/index.ts`.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/routines/AddRoutineWithTask.tsx` | **Create** - New component for adding first task |
| `src/components/routines/RoutineSidebar.tsx` | **Modify** - Add component to empty state |
| `src/components/routines/RoutineDrawer.tsx` | **Modify** - Add component to empty state |
| `src/components/routines/index.ts` | **Modify** - Export new component |

---

## Database Considerations
- **RLS Policy**: The existing `department_routines` RLS policy already permits inserts for users with department access, store GMs, and super admins
- **No Migration Needed**: Using existing table structure with all required columns

---

## New Routine Record Structure
When creating a routine on-the-fly:
```json
{
  "department_id": "<from props>",
  "title": "Daily Tasks",  // or Weekly/Monthly/Quarterly/Yearly
  "cadence": "daily",
  "items": [
    { "id": "<uuid>", "title": "<user input>", "order": 1 }
  ],
  "is_active": true,
  "template_id": null,
  "due_day_config": null
}
```

---

## User Experience
1. User navigates to a cadence with no deployed routine
2. Sees "No {cadence} routines assigned" message
3. Below the message, sees "+ Add task" button (if authorized)
4. Clicks button → inline input appears
5. Types task title → presses Enter or clicks Add
6. System creates routine with first task
7. UI refreshes to show the new routine with checklist interface

