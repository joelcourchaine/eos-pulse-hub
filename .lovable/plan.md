
## Two fixes: drag broken + issue should disappear on drop

### Problem 1 — Drag not working
`ContextMenuTrigger` (Radix) intercepts pointer events, which breaks the browser's native HTML5 drag-and-drop. The `draggable` attribute and `onDragStart` are on a `<div>` **inside** `<ContextMenuTrigger>`, so Radix swallows the drag initiation.

**Fix**: Restructure so the draggable `<div>` wraps the `<ContextMenu>` instead of being inside `<ContextMenuTrigger>`. Move `draggable`, `onDragStart`, `onDragOver`, `onDragEnd` to the outer wrapper div, and keep `<ContextMenu>/<ContextMenuTrigger>` as the inner content.

```text
BEFORE:
<ContextMenu>
  <ContextMenuTrigger>
    <div draggable onDragStart ...>   ← blocked by ContextMenuTrigger
      ...
    </div>
  </ContextMenuTrigger>
</ContextMenu>

AFTER:
<div draggable onDragStart onDragOver onDragEnd>  ← drag works
  <ContextMenu>
    <ContextMenuTrigger asChild>
      <div className="...">           ← visual card
        ...
      </div>
    </ContextMenuTrigger>
  </ContextMenu>
</div>
```

### Problem 2 — Issue should disappear after drop

When a to-do is **created from a dragged issue** (not the right-click path), the issue should be deleted from the DB after the to-do is saved.

**Fix**: Add an optional `onIssueLinked` prop to `TodoManagementDialog`. When a linked issue to-do is created successfully, call `onIssueLinked?.()` after the insert. In `IssuesAndTodosPanel`, pass a callback that deletes the issue:

```typescript
// In IssuesAndTodosPanel, inside the "Create To-Do from Issue Dialog":
onIssueLinked={async () => {
  await supabase.from("issues").delete().eq("id", selectedIssueForTodo!.id);
  loadIssues();
}}
```

The right-click "Create To-Do from Issue" context menu path does **not** pass `onIssueLinked`, so it keeps the existing behavior (issue stays, status → "in progress").

Only the **drag-and-drop** path passes `onIssueLinked` to trigger deletion. This is controlled by a separate `isFromDrag` ref/state so the two entry points behave differently.

### Files changed
| File | Change |
|---|---|
| `src/components/issues/IssuesAndTodosPanel.tsx` | Restructure drag wrapper outside ContextMenu; pass `onIssueLinked` + `deleteAfterLink` flag only for drag path |
| `src/components/todos/TodoManagementDialog.tsx` | Add optional `onIssueLinked?: () => void` prop; call it after successful create when `linkedIssueId` is set |
