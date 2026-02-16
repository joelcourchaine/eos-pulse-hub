

# Fix Sub-Process Deletion and Stage Title Overflow

## Issue 1: Sub-Process Deletion

In `src/pages/ProcessDetail.tsx`, the delete button is only rendered for top-level steps (`!step.is_sub_process`). The "Remove" button and "Sub-process" button are wrapped in a conditional that excludes sub-processes entirely (around line 270):

```tsx
{editing && !step.is_sub_process && (
  <div className="flex gap-2">
    <Button ...> Sub-process</Button>
    <Button ...> Remove</Button>
  </div>
)}
```

**Fix**: Show the "Remove" button for sub-processes too. Keep the "Add Sub-process" button restricted to top-level steps only (no nested sub-processes).

```tsx
{editing && !step.is_sub_process && (
  <Button ...> Sub-process</Button>
)}
{editing && (
  <Button ... onClick={() => deleteStep(step.id)}> Remove</Button>
)}
```

---

## Issue 2: Stage Title Overflow

Stage tabs currently have no width constraint in view mode and use a narrow fixed `w-24` input in edit mode. Long titles get cut off or break the layout.

**Fix**:
- In view mode: add `max-w-[10rem] truncate` to the tab trigger text so long titles are truncated with an ellipsis.
- In edit mode: widen the input from `w-24` to `w-40` so users have more room to type and read the title.
- Add a `title` attribute so hovering reveals the full stage name.

---

## Files Changed

**`src/pages/ProcessDetail.tsx`** -- two targeted edits:
1. Separate the "Remove" button from the `!step.is_sub_process` guard so sub-processes can be deleted.
2. Add `truncate` and `max-w` styling to stage tab triggers and widen the edit input.

