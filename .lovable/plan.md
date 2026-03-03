
## Plan: Single "Expand Notes" button for both Issues and To-Dos

**Root**: Currently there are two separate expand buttons — one in each panel header. The user wants just one shared button, placed next to the "Issues & To-Dos" title in the `CollapsibleIssuesPanel` header.

### Approach

Lift the `expandAll` state up to `CollapsibleIssuesPanel` and pass it down as a prop to `IssuesAndTodosPanel`.

### Changes

**`src/components/issues/CollapsibleIssuesPanel.tsx`**
- Add `expandAllNotes` state (boolean)
- Add an "Expand Notes" / "Collapse Notes" button next to the "Issues & To-Dos" title (stop click propagation so it doesn't toggle the collapsible)
- Pass `expandAllNotes` as a prop to `IssuesAndTodosPanel`

**`src/components/issues/IssuesAndTodosPanel.tsx`**
- Add optional `expandAllNotes?: boolean` prop
- Remove the two separate `expandAllIssues` / `expandAllTodos` state variables
- Replace them with the incoming `expandAllNotes` prop (falls back to `false`)
- Remove the two individual "Expand Notes" / "Collapse Notes" buttons from the Issues and To-Dos section headers
