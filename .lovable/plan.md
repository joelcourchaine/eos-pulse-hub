
## Plan: Add Open Issues section to the To-Do summary email

The `issues` table has: `id`, `department_id`, `title`, `description`, `status`, `severity`, `display_order`.

### What "open issues" means
Issues where `status != 'resolved'` (or whatever the closed/done status is). Need to check — but the table has a free-text `status` column. Looking at the app code it uses values like `"open"`, `"in_progress"`, `"resolved"`. We'll fetch all non-resolved issues.

### Changes — `supabase/functions/send-todos-email/index.ts` only

1. **Update the existing issues fetch** (line 71-76) — currently only fetching `id, title` for the `issueMap`. Expand to fetch full issue data for display, and filter to only **open** (non-resolved) issues:
   ```ts
   const { data: issues } = await supabaseClient
     .from("issues")
     .select("id, title, description, status, severity")
     .eq("department_id", departmentId)
     .neq("status", "resolved");
   ```
   Still build the `issueMap` from this data.

2. **Add `buildIssueRow` helper** — similar style to `buildTodoRow` but simpler (no due date / assignee), with severity dot and status badge. Use a slightly different left border accent color (red/orange for issues).

3. **Add `buildIssuesSection`** — calls `buildIssueRow` for each open issue, same `buildSection` pattern with a 🔥 icon and red accent `#ef4444`.

4. **Update summary pills** — add a third pill showing open issues count (e.g. `🔥 N Issues`).

5. **Insert issues section** into the HTML — place it **before** the to-dos sections so readers see the issues context first, then the action items.

6. **Redeploy** the edge function.

### Files changed
- `supabase/functions/send-todos-email/index.ts` only — redeploy after
