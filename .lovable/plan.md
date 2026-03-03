
## Root Cause

The UI shows "in progress" on an issue when it has **at least one linked to-do** (`issueHasLinkedTodo`). The actual `status` value in the database for those issues is still `"open"` — the "in progress" label is purely a UI display trick based on whether linked todos exist.

So in the edge function, `.neq("status", "in_progress")` does nothing useful — no issue in the database actually has `status = "in_progress"`. All issues with linked todos are stored as `status = "open"` and just displayed differently in the UI.

## Fix — `supabase/functions/send-todos-email/index.ts`

Change the issues query to **also exclude issues that have at least one linked todo** (i.e., the same `issueHasLinkedTodo` logic but server-side).

The cleanest approach: after fetching issues, also fetch `todos` for the department and filter out issues that have a linked todo in that list:

```ts
// After fetching todos, build a set of issue IDs that have linked todos
const linkedIssueIds = new Set(
  (todos || []).map(t => t.issue_id).filter(Boolean)
);

// Filter open issues to exclude those with linked todos ("in progress" in UI)
const openIssues = (issues || []).filter(i => !linkedIssueIds.has(i.id));
```

Also remove the now-redundant `.neq("status", "in_progress")` line since no issue actually has that status value.

### Only file changed
- `supabase/functions/send-todos-email/index.ts` — redeploy after
