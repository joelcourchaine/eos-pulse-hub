
## Plan: Collapsible Descriptions for Issues & To-Dos

The descriptions are always visible, making cards tall. The fix is to hide descriptions by default and only show them when a card is clicked/expanded.

### Changes to `src/components/issues/IssuesAndTodosPanel.tsx`

1. Add `expandedIssueId` and `expandedTodoId` state (string | null)
2. **Issues**: Wrap the description `<p>` in a conditional — only render when `expandedIssueId === issue.id`. Make the card clickable (excluding buttons/select) to toggle expansion. Add a subtle `ChevronDown`/`ChevronUp` indicator when a description exists.
3. **Todos**: Same pattern — wrap description in conditional toggled by `expandedTodoId`. Make card body clickable to expand.
4. Cards without descriptions are unaffected — no toggle indicator shown.

### Result
- Cards shrink significantly (title + badges only by default)
- Click a card to reveal its description inline
- Only one issue and one todo can be expanded at a time
