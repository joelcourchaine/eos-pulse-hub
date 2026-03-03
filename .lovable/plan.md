
## Plan: Replace "Create Issue" with "Create To-Do" in Top 10 right-click menu

### Changes — `src/components/top-10/Top10ItemRow.tsx` only

**1. Remove `IssueManagementDialog` import, add `TodoManagementDialog`**

**2. Remove `IssueManagementDialog`-related state** (`selectedCellContent`, `issueDialogOpen`) and replace with todo equivalents (`todoDialogOpen`).

**3. Build a rich `notes` string** from all non-empty row columns:
```
From Top 10 List: Top 10 Oldest RO's

RO Date: Jan 5, 2026
Customer Last Name: Smith
RO #: 12345
Advisor: Jane
RO Value: $1,200
# of Days: 28
Status: Open
```
Format date columns using `format(..., "MMM d, yyyy")`, currency columns using `formatAsCurrency`, others as plain text.

**4. Context menu** — change label from "Create Issue from this" → "Create To-Do from this", open `todoDialogOpen`.

**5. Render `TodoManagementDialog`** (controlled open/onOpenChange):
- `departmentId` → passed through
- `profiles={[]}` — dialog will load its own profiles from the department; passing empty array is fine (the dialog loads profiles internally if needed, but `TodoManagementDialog` uses the passed `profiles` prop for the assignee dropdown — so we need to either load profiles or pass `[]` and accept no assignee pre-selection)
- `onTodoAdded` → close dialog + call `onIssueCreated?.()` (reuse the existing callback)
- `linkedIssueTitle` → the list title (pre-fills the dialog title as `Todo: <listTitle>`)  
- Pre-populate `description` via a new prop... 

Looking at `TodoManagementDialog`: it accepts `linkedIssueTitle` and `linkedIssueSeverity` but **not** an `initialDescription`. The description is only pre-filled in edit mode. 

**Best approach**: Add `initialDescription` prop to `TodoManagementDialog` (similar to how `IssueManagementDialog` has `initialDescription`), and use it to pre-fill the notes. This is a small 3-line addition.

**Files changed:**
- `src/components/top-10/Top10ItemRow.tsx` — swap Issue for Todo, build notes string, update context menu
- `src/components/todos/TodoManagementDialog.tsx` — add `initialDescription` prop and use it to pre-fill description on open

### Notes string format
Iterate all `columns`, include only entries where `localData[col.key]` is truthy. Format dates and currency. Prefix with `From Top 10 List: {listTitle}\n\n`.
