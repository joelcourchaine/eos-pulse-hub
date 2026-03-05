
## Root Cause Identified: Duplicate Unique Constraints Blocking Monthly Upserts

### What's happening
The import logs show **success** with 9 technicians and 3 KPIs each — but **zero scorecard entries** were actually written. The import is silently failing on the database upsert step.

**The bug:** There are two conflicting unique constraints on `scorecard_entries` for monthly data:
- `unique_kpi_month` → `UNIQUE (kpi_id, month)` — **no `entry_type` column**
- `scorecard_entries_kpi_month_entry_unique` → `UNIQUE (kpi_id, month, entry_type)` — what the code targets

The import code runs:
```typescript
supabase.from("scorecard_entries").upsert(entries, { onConflict: "kpi_id,month,entry_type" })
```

This tells Postgres: "on conflict on `(kpi_id, month, entry_type)`, do an UPDATE." But when Postgres tries to insert a row that conflicts on the **narrower** `unique_kpi_month` constraint `(kpi_id, month)`, that conflict is **not handled** by the targeted upsert — Postgres throws an error that `supabase-js` swallows silently. The batch returns no error to the client but writes nothing.

There's a similar duplication for weekly: `unique_kpi_week` and `scorecard_entries_kpi_id_week_start_date_key` both cover `(kpi_id, week_start_date)`. The weekly upsert targets `"kpi_id,week_start_date"` so it happens to work, but the duplicate is still redundant.

### Fix: Drop the redundant constraints via migration

```sql
-- Drop redundant narrow monthly constraint (kept: scorecard_entries_kpi_month_entry_unique)
ALTER TABLE scorecard_entries DROP CONSTRAINT unique_kpi_month;

-- Drop one of the two duplicate weekly constraints (kept: unique_kpi_week)
ALTER TABLE scorecard_entries DROP CONSTRAINT scorecard_entries_kpi_id_week_start_date_key;
```

After dropping these, the monthly upsert `onConflict: "kpi_id,month,entry_type"` will work correctly against the remaining `scorecard_entries_kpi_month_entry_unique` constraint.

**No code changes needed** — the import code is correct. The database schema has redundant constraints that conflict with each other.

### After the fix
The next import run will write data correctly. Since previous imports logged "success" but wrote nothing, we may want to re-import the report file for 2026-02 to populate the data.

| Change | Detail |
|---|---|
| DB migration | Drop `unique_kpi_month` constraint |
| DB migration | Drop `scorecard_entries_kpi_id_week_start_date_key` constraint |
| No code changes | Import logic is correct |
