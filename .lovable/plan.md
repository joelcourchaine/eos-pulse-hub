
## Root Cause: Wrong conflict key on weekly upsert

The weekly batch upsert uses:
```typescript
{ onConflict: "kpi_id,week_start_date,entry_type" }
```

But the database unique index is:
```
CREATE UNIQUE INDEX unique_kpi_week ON public.scorecard_entries (kpi_id, week_start_date)
```

`entry_type` is **not** part of the unique index. When `onConflict` specifies columns that don't match any unique constraint, Supabase/PostgreSQL rejects or ignores the upsert silently — **no error is thrown, but no rows are written either**. This is why the scorecard shows all dashes.

The monthly upsert is correct (`kpi_id,month,entry_type` matches the `scorecard_entries_kpi_month_entry_unique` index).

## Fix

One-line change in `TechnicianImportPreviewDialog.tsx`:

```typescript
// FROM:
{ onConflict: "kpi_id,week_start_date,entry_type" }

// TO:
{ onConflict: "kpi_id,week_start_date" }
```

This matches the existing `unique_kpi_week` index `(kpi_id, week_start_date)` and the upsert will correctly insert or update weekly entries.

**File to change:** `src/components/scorecard/TechnicianImportPreviewDialog.tsx` — line ~412
