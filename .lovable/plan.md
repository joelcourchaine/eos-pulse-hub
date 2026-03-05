
## Two bugs to fix in `supabase/functions/send-combined-report-email/index.ts`

---

### Bug 1 — Cells colored red when they should be white (no color)

**Root cause confirmed via DB queries:**

The `kpi_targets` query in the combined email is missing `.eq("entry_type", "weekly")`:

```ts
// Current (wrong) — fetches BOTH weekly AND monthly targets
supabase.from("kpi_targets")
  .select("kpi_id, target_value")
  .eq("year", year).eq("quarter", quarter)
  .in("kpi_id", kpiIds)
```

Some KPIs (like Available Hours) have a target set in `kpi_targets` for `entry_type: "monthly"` but **not** for weekly. Without the `entry_type` filter, the email picks up monthly targets and uses them to color weekly cells — incorrectly making Available Hours cells red when the technician didn't hit 40 hours. The UI filters by `entry_type: "weekly"` (ScorecardGrid.tsx line 1104-1105), so it never sees these monthly targets for the weekly view.

**Fix:** Add `.eq("entry_type", "weekly")` to the `kpi_targets` query inside `buildScorecardSection` in the combined email (line ~257).

---

### Bug 2 — Top 10 lists not included in the email

**Root cause:** When a user checks the "Top 10 Lists" section checkbox but hasn't individually selected any list IDs (e.g., because the lists weren't visible yet or they just checked the parent box), `customTop10ListIds = []` and the edge function silently skips Top 10.

Additionally, there's a UX gap: the user may not realize they need to select individual lists after checking the section.

**Fix in edge function:** When `sections` includes `"top10"` but `top10ListIds` is empty, fall back to fetching ALL active lists for the department and including them all.

```ts
} else if (section === "top10") {
  let listIds = top10ListIds;
  // If section was checked but no specific lists selected, include all
  if (!listIds.length) {
    const { data: allLists } = await supabaseClient
      .from("top_10_lists")
      .select("id")
      .eq("department_id", departmentId)
      .eq("is_active", true)
      .order("display_order");
    listIds = (allLists || []).map((l: any) => l.id);
  }
  if (listIds.length > 0) {
    const html = await buildTop10Section(supabaseClient, listIds);
    sectionBlocks.push(`<div style="padding: 0 32px;">${html}</div>`);
  }
}
```

---

### Files changed

| File | Change |
|---|---|
| `supabase/functions/send-combined-report-email/index.ts` | Add `.eq("entry_type", "weekly")` to kpi_targets query; auto-include all department lists when section=top10 but no IDs specified |
