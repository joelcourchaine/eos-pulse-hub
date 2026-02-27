
## Plan: Move Severity Inline with Assignee & Due Date

Currently todos have two rows below the title:
1. Row 1: severity select (alone, with `mt-2`)
2. Row 2: assignee + due date (separate `div` with `mt-2`)

### Change in `src/components/issues/IssuesAndTodosPanel.tsx` (lines 593–632)

Merge both `div`s into a single row: `severity select` + `assignee` + `due date` all on one `flex items-center gap-2 mt-1` line. Remove the separate assignee/due date `div` entirely.

Result: todo cards will be the same compact single-row-of-metadata height as issues.
