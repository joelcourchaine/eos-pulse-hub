
## Drag an Issue onto the To-Dos Panel

### What it does today
- Issues are draggable (for reordering) using native HTML5 drag events (`draggable`, `onDragStart`, `onDragOver`, `onDragEnd`)
- Right-clicking an issue shows a context menu "Create To-Do from Issue" which opens `TodoManagementDialog` pre-filled
- `TodoManagementDialog` accepts `linkedIssueId`, `linkedIssueTitle`, `linkedIssueSeverity` — all the wiring is already there

### What to add
Extend the existing drag-and-drop to also handle dropping an **issue onto the To-Dos panel**. The To-Dos panel will act as a drop target: when an issue is dropped there, it opens `TodoManagementDialog` pre-filled exactly like the right-click context menu already does.

### Changes — `src/components/issues/IssuesAndTodosPanel.tsx` only

**1. Track drag target context**
Add a `dragTarget` state: `"reorder" | "todo-panel"`. When the mouse enters the To-Dos panel while dragging an issue, set it to `"todo-panel"`.

**2. To-Dos panel drop zone**
Add `onDragOver` + `onDrop` handlers to the To-Dos panel `<div>` (line 519):
```typescript
onDragOver={(e) => {
  if (draggedIssue) e.preventDefault(); // allow drop
}}
onDrop={(e) => {
  e.preventDefault();
  if (draggedIssue) {
    setSelectedIssueForTodo(draggedIssue); // reuses existing logic
    setDraggedIssue(null);
  }
}}
```

**3. Prevent reorder-save when drop target is To-Dos panel**
`handleDragEnd` fires after any drop. Guard it: if `selectedIssueForTodo` was just set (i.e. we dropped on the todo panel), skip the reorder save. The simplest way: check `draggedIssue` is null (already set to null in the drop handler) before saving.

Actually cleaner: in `onDrop` on the to-dos panel, call `e.stopPropagation()` and set `draggedIssue` to null before `handleDragEnd` fires. Since `handleDragEnd` checks `if (!draggedIssue) return`, the reorder save is skipped automatically. ✓

**4. Visual feedback on the To-Dos panel**
Add a `isDragOverTodos` state. When dragging an issue and hovering the to-dos panel, highlight it with a dashed border and a "+ Link to Issue" hint label. Remove the highlight on `onDragLeave` or `onDrop`.

```typescript
const [isDragOverTodos, setIsDragOverTodos] = useState(false);
```

Apply to the To-Dos panel wrapper:
```typescript
className={`... transition-all ${isDragOverTodos && draggedIssue ? "ring-2 ring-primary ring-dashed bg-primary/5" : ""}`}
```

**5. Update the subtitle hint on Issues panel**
Change "Drag to reorder by importance" to "Drag to reorder · Drop onto To-Dos to link" so users discover the feature.

### Summary of state additions
- `isDragOverTodos: boolean` — highlights the drop zone

### No new dependencies
Pure HTML5 drag-and-drop events, same as what's already used. No library needed.

### File to change
- `src/components/issues/IssuesAndTodosPanel.tsx` (single file, ~15 lines changed/added)
