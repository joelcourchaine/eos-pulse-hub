
## Delete Non-Report KPIs from River City Ram Technicians

Looking at the database, each technician at River City Ram has **6 KPIs**:
- From the report: `Available Hours`, `Closed Hours`, `Open and Closed Hours`, `Productivity`
- NOT from the report: `Total Hours`, `Total Labour Sales`

The import code only creates/writes to the 3 report-specific KPIs by exact name match — so these extra KPIs don't technically block data from loading. However, cleaning them out is a valid diagnostic step and keeps the scorecard tidy.

**The real parsing issue remains** — the parser still isn't finding any technicians in the RAM file. The debug panel we added will confirm the exact layout once the file is re-uploaded.

---

### Plan: Remove `Total Hours` and `Total Labour Sales` from technicians at River City Ram

**No code changes needed** — this is a targeted database cleanup via a migration.

**SQL to run:**

```sql
DELETE FROM kpi_definitions
WHERE name IN ('Total Hours', 'Total Labour Sales')
  AND assigned_to IN (
    SELECT p.id FROM profiles p
    JOIN stores s ON s.id = p.store_id
    WHERE s.name ILIKE '%river city ram%'
  );
```

This deletes only those two extra KPI definitions (and their associated `scorecard_entries` will cascade-delete or remain orphaned depending on FK config — I'll check).

I also need to verify whether `scorecard_entries` has a cascade delete on `kpi_id` so no orphan data is left behind.

**After this cleanup:** Re-upload the RAM technician productivity report. The debug panel will show what the parser detected. If 0 technicians still come back, the debug info will tell us the exact column layout of the RAM file so the parser can be fixed precisely.

**Files to change: 0 (DB-only migration)**

| Action | Details |
|---|---|
| Delete KPIs | `Total Hours` and `Total Labour Sales` from all technicians at River City Ram |
| No code changes | The import flow is unaffected |
