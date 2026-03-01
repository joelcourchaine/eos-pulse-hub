
## Root Cause

Monthly scorecard entries use a `month` column (format `"YYYY-MM"`) and conflict key `kpi_id,month`. The technician import instead sets `week_start_date = mo.month + "-01"` and uses conflict `kpi_id,week_start_date,entry_type`. The `month` field is never populated, so the scorecard's `.in("month", [...])` filter returns empty results.

Weekly entries also have a subtle issue — the scorecard queries `scorecard_entries` filtered by `week_start_date` with no `month` filter, so weekly data may actually be loading but hidden by the technician role filter. The monthly data is definitively broken.

## Fix — `TechnicianImportPreviewDialog.tsx` only

### Monthly entries (lines 374–396)
Change the monthly upsert to:
- Set `month: mo.month` (not `week_start_date`)
- Use `onConflict: "kpi_id,month,entry_type"` to match the correct unique key

```typescript
// BEFORE (broken)
await supabase.from("scorecard_entries").upsert(
  { kpi_id: ..., week_start_date: mo.month + "-01", entry_type: "monthly", ... },
  { onConflict: "kpi_id,week_start_date,entry_type" }
);

// AFTER (correct)
await supabase.from("scorecard_entries").upsert(
  { kpi_id: ..., month: mo.month, entry_type: "monthly", ... },
  { onConflict: "kpi_id,month" }
);
```

### Weekly entries (lines 341–370)
Weekly entries look structurally correct (`week_start_date` + `onConflict: "kpi_id,week_start_date,entry_type"`), but verify the conflict key matches the DB. Also add `entry_type: "weekly"` explicitly to ensure the filter works.

This is a one-file change to `TechnicianImportPreviewDialog.tsx`.
