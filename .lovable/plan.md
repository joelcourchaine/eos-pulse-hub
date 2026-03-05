
## Carry Over Issue Description When Dragging to To-Do

### The gap
When an issue is dragged to the To-Dos panel, `IssuesAndTodosPanel.tsx` already passes `linkedIssueTitle` and `linkedIssueSeverity` to `TodoManagementDialog`. But the issue's **description** is never passed — so the description field in the dialog opens blank.

`TodoManagementDialog` already has an `initialDescription` prop that wires directly into the description field (line 79 of the dialog). It just isn't being used from the drag path.

### Fix — one line change in `IssuesAndTodosPanel.tsx`

At line 713 (the `TodoManagementDialog` rendered for the drag/right-click path), add:

```typescript
initialDescription={selectedIssueForTodo.description || ""}
```

That's the only change needed. The dialog's `useEffect` already reads `initialDescription` and sets the description field when `open` transitions to true.

### Files changed
| File | Change |
|---|---|
| `src/components/issues/IssuesAndTodosPanel.tsx` | Add `initialDescription` prop to the "Create To-Do from Issue" `TodoManagementDialog` |
