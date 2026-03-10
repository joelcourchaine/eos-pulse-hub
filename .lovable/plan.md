
## Problem

The drag handlers (`onDragOver`, `onDragLeave`, `onDrop`) are only attached to the **inner scrollable content `div`** (the list area). When the to-do list is full, individual todo `div` rows fill that entire space. Hovering over a todo row causes the browser to fire `onDragLeave` on the content div (because you've moved onto a child), killing the drop zone highlight and blocking the drop.

```text
<Card>                          ← no drag handlers
  <div header>                  ← no drag handlers
  <div scrollable content>      ← onDragOver / onDragLeave / onDrop
    <div todo row>              ← no drag handlers → blocks events ❌
    <div todo row>              ← no drag handlers → blocks events ❌
    <div todo row>              ← no drag handlers → blocks events ❌
```

## Fix — `src/components/issues/IssuesAndTodosPanel.tsx`

**Two-part change:**

1. **Move drag handlers up to the `Card`** so the entire right panel is the drop target, not just the scrollable content area. The `Card` wraps both the header and the list — dragging anywhere in the right panel will work.

2. **Add `onDragOver={e => e.preventDefault()}` to each individual todo item row** so the browser doesn't fire `onDragLeave` when the cursor crosses from the container into a child element. This is the standard fix for nested drag-drop in HTML5.

```text
<Card                           ← onDragOver / onDragLeave / onDrop  ✅
  <div header>                  ← cursor enters here = still works   ✅
  <div scrollable content>
    <div todo row               ← onDragOver={e=>e.preventDefault()} ✅
    <div todo row               ← onDragOver={e=>e.preventDefault()} ✅
```

Additionally, when dragging is active over the todos panel, the visual feedback indicator (the "Drop to link issue as a to-do" overlay) should still only show in the content area — that behavior stays the same, just the drop zone is the whole card now.

## Files to change

| File | Change |
|------|--------|
| `src/components/issues/IssuesAndTodosPanel.tsx` | Move `onDragOver`/`onDragLeave`/`onDrop` from the content `div` to the `Card`. Add `onDragOver={e => e.preventDefault()}` to each todo item row. |
