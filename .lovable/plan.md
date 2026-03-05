
## Two fixes needed in `src/pages/Dashboard.tsx` and `supabase/functions/send-combined-report-email/index.ts`

---

### Fix 1 — Add role selector to Custom Report's Scorecard section

**The gap**: The standalone "Weekly Scores" email (via `send-scorecard-email`) supports a `roleFilter` param that filters KPIs to only show those assigned to users with that role. The Custom Report's scorecard section uses `send-combined-report-email`, which has `roleFilter` in its TypeScript interface but `buildScorecardSection()` ignores it entirely.

**Changes**:

**`src/pages/Dashboard.tsx`**:
1. Add state: `const [customScorecardRole, setCustomScorecardRole] = useState<string>("all")`
2. Inside the Custom Report → Scorecard sub-section (after the Weekly/Monthly/Yearly radio group), add a role dropdown when scorecard is checked:
```
Role: [ All | Store GM | Department Manager | Service Advisor ]
```
3. Pass `roleFilter: customScorecardRole` in the `send-combined-report-email` request body (alongside existing `scorecardMode`, `year`, `quarter`).

**`supabase/functions/send-combined-report-email/index.ts`**:
1. Destructure `roleFilter` from the request body (it's already in the `CombinedReportRequest` interface).
2. Pass it into `buildScorecardSection()`.
3. In `buildScorecardSection`, add the same role-filtering logic that `send-scorecard-email` uses — group KPIs by `assigned_to`, fetch `user_roles` + `profiles.role` for those owners, and filter to only include KPI groups whose owner matches the requested role.

---

### Fix 2 — Top 10 lists not being found

**The gap**: The `top_10_lists` query inside `loadData()` (runs when the email dialog opens) is missing `eq("is_active", true)`. The `Top10ListsPanel` uses that filter, so inactive lists are stored but never shown in the panel. When the email dialog queries without this filter, it can return 0 active lists and show "No Top 10 lists found."

More importantly: active lists in the panel might not be returned because the dialog query uses `order("title")` rather than matching the actual active lists visible in the panel.

**Change in `src/pages/Dashboard.tsx`**:
- Add `.eq("is_active", true)` to the `top_10_lists` query in the `loadData()` callback inside the email dialog's `onOpenChange`.

```typescript
// Before
const { data: lists } = await supabase
  .from("top_10_lists")
  .select("id, title")
  .eq("department_id", selectedDepartment)
  .order("title");

// After
const { data: lists } = await supabase
  .from("top_10_lists")
  .select("id, title")
  .eq("department_id", selectedDepartment)
  .eq("is_active", true)
  .order("display_order", { ascending: true });
```

---

### Files changed

| File | Change |
|---|---|
| `src/pages/Dashboard.tsx` | Add `customScorecardRole` state, role selector UI under Scorecard checkbox, pass `roleFilter` in request body, fix Top 10 query with `is_active = true` |
| `supabase/functions/send-combined-report-email/index.ts` | Destructure `roleFilter` from request, pass to `buildScorecardSection`, implement role filtering logic inside that function |
