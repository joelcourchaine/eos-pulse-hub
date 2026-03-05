
## Problem Summary

Three issues in the weekly scorecard email:

1. **Department manager KPIs appear in the Technician email** — the `kpisByOwner` filtering excludes owners whose role doesn't match, but `"department_manager"` may be stored as `"fixed_ops_manager"` or similar, and the profiles.role join may not catch all cases. Need to also exclude `"fixed_ops_manager"` when filtering for non-manager roles.

2. **The email has a separate table with repeated week headers per owner** — the current code creates a brand new `<table>` block for each owner group, each with its own `<thead>` week headers row. The UI renders ONE table with owner-separator rows inside `<tbody>`.

3. **Visual mismatch** — the email uses pale cell backgrounds for non-weekly cells, while the UI uses saturated green/amber/red everywhere in weekly view.

---

## The Fix — Edge Function Only

Rewrite the weekly HTML builder in `supabase/functions/send-scorecard-email/index.ts` so that for `mode === "weekly"`:

### Structure change: ONE table, ONE header, owner rows as separators

**Current (broken):**
```
[Navy header]
  [Owner 1 name banner]
  <table>
    <thead> KPI | Target | WK1...WK13 | Q-Total </thead>
    <tbody> kpi rows... </tbody>
  </table>
  [Owner 2 name banner]
  <table>
    <thead> KPI | Target | WK1...WK13 | Q-Total </thead>   ← REPEATED
    <tbody> kpi rows... </tbody>
  </table>
```

**Fixed (matches UI):**
```
[Navy header]
<table>
  <thead> KPI | Target | WK1...WK13 | Q-Total </thead>   ← ONCE only
  <tbody>
    [owner separator row — full-width navy, owner name]
    kpi row
    kpi row
    [Q-Total row for this owner group]
    [owner separator row]
    kpi row
    ...
  </tbody>
</table>
```

### Role filtering fix

When `roleFilter` is set and is not "all", also exclude `fixed_ops_manager` from the non-manager filtered results. More importantly: ensure that when `roleFilter === "technician"`, the filter correctly drops owners with role `"department_manager"` OR `"fixed_ops_manager"`. The current logic already does this correctly IF the role is stored in `user_roles` or `profiles.role`. 

The real fix is: **also remove the "Department Manager" option from the email popover's role selector in ScorecardGrid.tsx**. There's no reason to email a "department manager" scorecard — that's confusing the user. Remove that SelectItem. If the user wants all roles, they can use the Dashboard email button.

### Q-Total per owner group (totals row)

After all KPI rows for an owner, add a **"Σ Totals" row** (styled like the UI's totals strip — slate background) showing the Q-Total aggregate per week column. This matches the UI's `Σ Totals` summary section.

### Saturated colors throughout

Ensure all weekly data cells use the saturated palette (`#059669`, `#d97706`, `#dc2626`) not the pale variants. The `getCellStyle` function with `isWeekly=true` already does this — just need to make sure it's called correctly everywhere.

---

## Files to change

### 1. `supabase/functions/send-scorecard-email/index.ts`

Rewrite the weekly HTML section (~lines 703–867) to:
- Build ONE `<table>` with a single `<thead>` 
- Inside `<tbody>`, for each owner group:
  - Render a full-width owner separator `<tr>` (navy background, spans all columns)
  - Render each KPI data row (with saturated color cells and Q-Total)
  - Render a totals `<tr>` (Σ Totals row) showing per-week aggregate and Q-Total
- Close the single `</table>` after all owners

### 2. `src/components/scorecard/ScorecardGrid.tsx` (~line 3779)

Remove the `<SelectItem value="department_manager">Department Manager</SelectItem>` from the email popover role selector — there is no use case for emailing only the dept manager's scorecard via this button.
