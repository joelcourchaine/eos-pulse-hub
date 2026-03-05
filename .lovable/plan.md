
## Why some Productivity cells are blank

### Root cause

The blank cells are caused by the `manually_edited` protection filter in the import pipeline (lines 371–398 of `TechnicianImportPreviewDialog.tsx`):

```
protectedWeeklyKeys / protectedMonthlyKeys
→ filteredWeekly = allWeeklyEntries.filter(e => !protectedWeeklyKeys.has(...))
```

When a Productivity cell was previously imported (or touched), it got `manually_edited = true` in the DB. On re-import, the import engine **skips writing new values for those protected keys** — so weeks where the new import produces `null` (clockedInHrs < 1) never get a NULL written to the DB. The old stale value sits there instead, but weeks where the new parser produces a valid number are also blocked if `manually_edited = true`.

The image shows Kiel: Productivity shows for some weeks (not previously protected) and is blank for others (previously protected and now blocked from update).

### The fix

Productivity is a **calculated, non-manual KPI** — it should never be protected by `manually_edited`. The fix is two-part:

1. **Clear `manually_edited = true` for all Productivity KPI entries in the DB** — a SQL migration that sets `manually_edited = false` for every `scorecard_entries` row where the linked `kpi_definitions.name = 'Productivity'`. This unblocks re-imports for all technicians and all brands going forward.

2. **Exclude Productivity from the protection filter in the import code** — in `TechnicianImportPreviewDialog.tsx` at lines 371–398, add a filter so Productivity KPI IDs are never added to `protectedWeeklyKeys` / `protectedMonthlyKeys`. This prevents the issue from recurring on future imports.

### Files to change

- **DB migration**: `UPDATE scorecard_entries SET manually_edited = false WHERE kpi_id IN (SELECT id FROM kpi_definitions WHERE name = 'Productivity')`
- **`src/components/scorecard/TechnicianImportPreviewDialog.tsx`** lines 371–398: exclude Productivity KPI IDs from the protected keys sets
