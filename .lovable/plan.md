
## Plan: Show linked Issue name next to To-Do title in the email

### Root cause
The `send-todos-email` edge function's todos query does not include `issue_id` in the SELECT, and there's no fetch of issues to build a title lookup map. So even if the template tried to show an issue name, the data isn't there.

### Changes — `supabase/functions/send-todos-email/index.ts`

1. **Update the todos `select`** on line 64 to include `issue_id`:
   ```
   .select("id, title, description, status, severity, due_date, assigned_to, issue_id")
   ```

2. **After fetching todos**, add a fetch for all issues in the department and build an `issueMap`:
   ```ts
   const { data: issues } = await supabaseClient
     .from("issues")
     .select("id, title")
     .eq("department_id", departmentId);
   const issueMap: Record<string, string> = {};
   (issues || []).forEach(i => { issueMap[i.id] = i.title; });
   ```

3. **Update `buildTodoRow`** to accept `issueMap` and render a small inline pill immediately after the todo title span when `todo.issue_id` is present:
   ```html
   <span style="display:inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; background: #eff6ff; color: #3b82f6; margin-left: 6px; vertical-align: middle;">
     ↳ {issueName}
   </span>
   ```

That's the only file that needs to change. Redeploy after.
