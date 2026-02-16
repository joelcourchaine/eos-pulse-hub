
# Add Drag-and-Drop Reordering for Steps and Stages

## Overview

Enable users to reorder both **stages** (the horizontal tabs) and **steps** (the cards within a stage) by dragging them to a new position. This uses the native HTML Drag and Drop API, consistent with how drag-and-drop is already implemented elsewhere in the project (e.g., KPI reordering, issues panel).

Drag handles are only active in **edit mode**.

---

## Changes

### `src/pages/ProcessDetail.tsx`

#### 1. Step Reordering (drag cards up/down within a stage)

- Add drag state: `dragStepId` to track which step is being dragged.
- On the existing `GripVertical` handle (already rendered in edit mode), add `draggable`, `onDragStart`, `onDragEnd` handlers.
- On each step `Card`, add `onDragOver` and `onDrop` handlers that:
  - Swap the dragged step with the hovered step in local state.
  - Apply a visual indicator (e.g., top border highlight) on the drop target.
- On drop, persist the new `display_order` values to the database in a batch update.

#### 2. Stage Reordering (drag tabs left/right)

- Add drag state: `dragStageId` to track which stage tab is being dragged.
- Make each `TabsTrigger` draggable (only in edit mode) with a subtle grab cursor.
- On `onDragOver`/`onDrop` of another stage tab, reorder the stages array locally.
- On drop, persist updated `display_order` values for all affected stages.

#### 3. Persist helper function

- Add a `persistStepOrder` function that takes an array of steps for a stage and batch-updates their `display_order` in the database.
- Add a `persistStageOrder` function that batch-updates `display_order` for all stages.

---

## Technical Details

**Drag state tracking:**
```text
dragStepId: string | null   -- which step card is being dragged
dragStageId: string | null   -- which stage tab is being dragged
```

**Reorder logic** (shared pattern for both steps and stages):
```text
1. onDragStart: store the dragged item ID
2. onDragOver: preventDefault to allow drop, optionally highlight target
3. onDrop: reorder the array by moving dragged item to target position,
           update display_order values, persist to DB
4. onDragEnd: clear drag state and any visual indicators
```

**Database persistence** -- updates are batched using Promise.all:
```text
Promise.all(
  reorderedItems.map((item, index) =>
    supabase.from("table").update({ display_order: index }).eq("id", item.id)
  )
)
```

**Visual feedback:**
- Dragged step card gets reduced opacity (`opacity-50`)
- Drop target gets a top border highlight (`border-t-2 border-primary`)
- Stage tabs show a left/right border indicator when a tab is dragged over them
- The existing `GripVertical` icon serves as the drag affordance for steps
