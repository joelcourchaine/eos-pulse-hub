
## Root Cause: Two Issues Found

### Issue 1 — Wrong display_order (from the duplicate cleanup)
When we deleted the duplicate "Open and Closed Hours" KPIs last session, we accidentally kept the **newer** IDs (created at higher display_orders) instead of the original ones. This means for 5 out of 7 technicians, "Open and Closed Hours" now sits **after** Productivity in display order:

| Technician | Available | Open & Closed | Productivity | Status |
|---|---|---|---|---|
| Andrew | 10008 | **10017** | 10010 | ❌ O&C after Productivity |
| Gavin | 9993 | **10012** | 9995 | ❌ |
| Ken | 9996 | **10013** | 9998 | ❌ |
| Martin | 10002 | **10015** | 10004 | ❌ |
| Noah | 10005 | **10016** | 10007 | ❌ |
| Jim E | 9990 | 9991 | 9992 | ✅ correct |
| Kiel | 9999 | 10000 | 10001 | ✅ correct |
| Branden | 10018 | 10019 | 10020 | ✅ correct |

### Issue 2 — Import code doesn't enforce display_order on existing KPIs
The `kpiSpecs` array is in the correct order `[Available Hours, Open and Closed Hours, Productivity]` and new KPIs get assigned `nextDisplayOrder++`. But when a KPI already exists, `display_order` is never updated — so reshuffled KPIs stay wrong after any future re-import.

---

### Fix Plan

**Part 1 — DB migration**: Fix the 5 technicians with wrong order by setting "Open and Closed Hours" display_order to be `available_order + 1` and "Productivity" to `available_order + 2`, shifting any conflicts out of the way:

```sql
-- Andrew: Available=10008, set O&C=10009, Productivity=10010 → need to shift existing 10009/10010
UPDATE kpi_definitions SET display_order = display_order + 10 WHERE display_order IN (10009, 10010) AND department_id = (SELECT department_id FROM kpi_definitions WHERE id = '8d04230c-bb16-4ea8-a09f-adf43d5baf3f');
UPDATE kpi_definitions SET display_order = 10009 WHERE id = '33ff857c-f93d-4cd0-b6de-c60fe8db5edf'; -- Andrew O&C
UPDATE kpi_definitions SET display_order = 10010 WHERE id = 'ed3b8e84-57b4-4cd6-a1c7-4526158e39aa'; -- Andrew Productivity

-- (same pattern for Gavin, Ken, Martin, Noah)
```

**Part 2 — Code fix in TechnicianImportPreviewDialog.tsx**: After resolving each KPI's ID (whether existing or new), enforce the display_order so that Available=N, Open&Closed=N+1, Productivity=N+2 by doing an `UPDATE` on existing KPIs too:

```typescript
// After kpiIdMap is populated, enforce correct display_order
const baseOrder = nextDisplayOrder; // or find existing min order for this tech
await supabase.from("kpi_definitions")
  .update({ display_order: baseOrder })
  .eq("id", kpiIdMap["Available Hours"]);
await supabase.from("kpi_definitions")
  .update({ display_order: baseOrder + 1 })
  .eq("id", kpiIdMap[SOLD_HRS_KPI_NAME]);
await supabase.from("kpi_definitions")
  .update({ display_order: baseOrder + 2 })
  .eq("id", kpiIdMap["Productivity"]);
```

### Column mapping confirmation
After carefully reading the uploaded report, the column mapping is **correct**:
- "Clocked In Hrs" (col 6) → `clockedInHrs` → **Available Hours** ✅
- "Sold Hrs" (col 4) → `soldHrs` → **Open and Closed Hours** ✅

No column mapping changes needed.

### Summary of changes

| Change | Detail |
|---|---|
| DB migration | Fix display_order for Andrew, Gavin, Ken, Martin, Noah |
| Code: TechnicianImportPreviewDialog.tsx | After resolving KPI IDs, enforce correct display_order sequence on all 3 KPIs per technician |
