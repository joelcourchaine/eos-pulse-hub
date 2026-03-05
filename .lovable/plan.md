
## Root Cause

Two bugs are working against each other:

**Bug 1 — `handleDragEnd` clears `draggedIssue` before `onDrop` fires**
`onDragEnd` is on the draggable issue `<div>`. It always fires when any drag operation ends (including drops onto the To-Dos panel). It calls `setDraggedIssue(null)` in the `finally` block. The browser fires events in this order: `drop` → `dragend`. But because `setDraggedIssue(null)` is inside an `async` function with `await` calls, by the time React flushes state the `drop` handler reads `draggedIssue` as `null`. Even if timing were perfect, the `handleDragEnd` function is also saving issue order to the DB unnecessarily when you're dropping to the To-Dos side.

**Bug 2 — `handleDragOver` on each issue card only handles intra-list reordering**
The drag-over handler on issue cards calls `e.preventDefault()` — but only for the issues list. The To-Dos panel `onDragOver` has its own `e.preventDefault()` but only if `draggedIssue` is truthy. Since state can be stale in closures, this may not reliably allow the drop.

## Fix

**1. Use a `ref` for `draggedIssue` instead of (or in addition to) state**

Add `draggedIssueRef = useRef<Issue | null>(null)` that's set alongside `setDraggedIssue`. The `onDrop` handler reads from the ref synchronously — immune to React's batched state update timing.

**2. Guard `handleDragEnd` to NOT process order-saving when dropping on the To-Dos panel**

Add a `droppedOnTodosRef = useRef(false)`. In `onDrop` on the To-Dos panel, set `droppedOnTodosRef.current = true` before clearing state. In `handleDragEnd`, check this ref and skip the order-save + toast if it's `true`.

```
onDrop (To-Dos panel):
  droppedOnTodosRef.current = true
  setIsDragOverTodos(false)
  setIsSelectedIssueFromDrag(true)
  setSelectedIssueForTodo(draggedIssueRef.current)  ← reads ref, not state
  setDraggedIssue(null)

handleDragEnd:
  if (droppedOnTodosRef.current) {
    droppedOnTodosRef.current = false
    setDraggedIssue(null)
    return   ← skip order save
  }
  // ... existing order save logic
```

**3. Ensure `e.preventDefault()` is always called in To-Dos `onDragOver`**

Remove the `if (draggedIssue)` guard — just always call `e.preventDefault()` and `setIsDragOverTodos(true)`, since the visual indicator is harmless and the conditional was the stale-closure trap.

## Files Changed

| File | Change |
|---|---|
| `src/components/issues/IssuesAndTodosPanel.tsx` | Add `draggedIssueRef` + `droppedOnTodosRef`, guard `handleDragEnd`, fix `onDrop` to read ref, always preventDefault in To-Dos onDragOver |
