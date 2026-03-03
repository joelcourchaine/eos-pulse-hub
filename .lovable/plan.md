
## Plan: "Expand All Notes" button + inline notes editing for Issues & To-Dos

### What the user wants
1. A button to expand all notes at once (so they don't have to click each item individually)
2. Ability to add/edit notes inline while expanded — no need to open the full edit dialog

### Approach

#### 1. "Expand All Notes" toggle button
- Add an `expandAll` boolean state to `IssuesAndTodosPanel`
- Add a single "Expand Notes" / "Collapse Notes" button in both the Issues and To-Dos section headers (or one global button in the `CollapsibleIssuesPanel` header)
- When `expandAll` is true, all items show their notes regardless of `expandedIssueId` / `expandedTodoId`
- Individual chevron click still works for single-item expand/collapse (override per-item)

#### 2. Inline notes editing
- When an item's notes are expanded (either via expand-all or individual click), replace the static `<p>` with an inline `<Textarea>` 
- Add a local `editingNotes` state map: `{ [id]: string }` — tracks draft text per item
- On blur OR on a small "Save" button click, call `supabase.from("issues").update({ description: ... })` or `supabase.from("todos").update({ description: ... })`
- If the description is currently null/empty and the user types, this creates a new note
- Show a subtle placeholder: "Add notes..." to invite adding notes even when empty

### Changes — `src/components/issues/IssuesAndTodosPanel.tsx` only

1. **New state**:
   ```ts
   const [expandAllIssues, setExpandAllIssues] = useState(false);
   const [expandAllTodos, setExpandAllTodos] = useState(false);
   const [editingIssueNotes, setEditingIssueNotes] = useState<{[id: string]: string}>({});
   const [editingTodoNotes, setEditingTodoNotes] = useState<{[id: string]: string}>({});
   ```

2. **Header buttons** — next to "Add Issue" / "Add To-Do":
   - `<Button variant="outline" size="sm">` with `NotebookPen` or `AlignLeft` icon + label "Notes ▾ / Notes ▴"

3. **Issue item**: 
   - Show notes area when `expandAllIssues || expandedIssueId === issue.id`
   - Always show the textarea (even when description is null) so user can add notes
   - `<Textarea value={editingIssueNotes[issue.id] ?? issue.description ?? ""} onChange=... onBlur=... />`
   - `onBlur`: save to DB if changed

4. **To-Do item**: same pattern

5. **Save function**:
   ```ts
   const saveIssueNotes = async (issueId: string, notes: string) => {
     await supabase.from("issues").update({ description: notes || null }).eq("id", issueId);
     loadIssues();
   };
   ```

### UX details
- Textarea is compact (2 rows), auto-grows with content via `rows={2}`
- Placeholder text: "Add notes..."
- Save happens on blur (no explicit save button needed — familiar autosave UX)
- The chevron icons still appear on items that have descriptions for individual expand/collapse
- Items with no description still show a faint "Add notes..." area only when expand-all is active (encouraging note-taking)

### Files changed
- **`src/components/issues/IssuesAndTodosPanel.tsx`** only — all changes contained here
