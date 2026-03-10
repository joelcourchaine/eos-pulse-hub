
## Problem

In `TodoManagementDialog.tsx`, the `useEffect` that seeds the form fields only fires in the `else if (!open)` branch (lines 77-83). This seeds the form **when the dialog closes** (resetting it for next time it opens). 

The **right-click path** works because:
1. Dialog starts closed → effect fires `!open` → seeds `title = "Todo: [issue title]"`, `description`, `severity`
2. Dialog opens → fields already populated ✅

The **drag path** breaks because:
1. Dialog is rendered with `open={true}` immediately (line 728 in `IssuesAndTodosPanel.tsx`)
2. Effect runs with `open = true` and `todo = undefined` — neither branch matches
3. Fields remain empty ❌

## Fix — one file: `src/components/todos/TodoManagementDialog.tsx`

Change the `useEffect` condition so that when `open` is `true` AND there's no `todo` (create mode) AND there's a `linkedIssueTitle`, it seeds the form:

```ts
// Before:
useEffect(() => {
  if (todo && open) {
    // edit mode population
  } else if (!open) {
    // reset/seed for next open — only fires on close
    setTitle(linkedIssueTitle ? `Todo: ${linkedIssueTitle}` : "");
    ...
  }
}, [todo, open, linkedIssueTitle, linkedIssueSeverity]);

// After:
useEffect(() => {
  if (todo && open) {
    // edit mode population (unchanged)
  } else if (open && !todo) {
    // create mode — seed from linked issue props if present
    setTitle(linkedIssueTitle ? `Todo: ${linkedIssueTitle}` : "");
    setDescription(initialDescription || "");
    setAssignedTo("");
    setDueDate("");
    setSeverity(linkedIssueSeverity || "medium");
  } else if (!open) {
    // reset on close
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setDueDate("");
    setSeverity("medium");
  }
}, [todo, open, linkedIssueTitle, linkedIssueSeverity, initialDescription]);
```

This makes both paths behave identically:
- Drag drop: dialog opens with `open=true`, effect fires `open && !todo` branch, seeds title/description/severity from the dragged issue
- Right-click: dialog opens from closed, same branch fires, same result

## Files to change

| File | Change |
|------|--------|
| `src/components/todos/TodoManagementDialog.tsx` | Fix `useEffect` condition: add `open && !todo` branch to seed fields when opened programmatically (drag path) |

Single-file, single-function fix.
